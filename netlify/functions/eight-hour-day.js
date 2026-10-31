// POST /.netlify/functions/eight-hour-day   Authorization: Bearer <Firebase ID token>
// Body: { action: 'state' | 'plan' | 'start' | 'schedule' | 'progress', ... }
// Evening mode: 'start' accepts blocks:[{time,hours}] (split day), 'schedule' adds later blocks; due blocks start on their own (see autoStart).
//
// Server-authoritative 8-hour day. The server clock decides when the window starts and ends, the server writes the locked values
// (window, task count, points per task, daily target) to eightHour/{uid} (admin-only; clients can read but never write, see firestore.rules),
// and the server settles the day (streak / one-time target bump). Because everything lives in Firestore, the lock survives restarts,
// device clock or time-zone changes and reinstalls.
//
// AI: points per task and the target come from the deterministic heuristic in lib/eightHourCore.js, which is the COMPLETE fallback and needs no key.
// If OPENAI_API_KEY is configured on the server (same env var as ai.js, never sent to the client) AND the user has given AI consent, the model may
// refine complexity/minutes per task and nudge the target ratio upward. Everything that needs the key is marked "REQUIRES SERVER AI" below.
// The model never writes points or targets directly: its numbers are clamped and run through the same formulas.
const core = require('./lib/eightHourCore');
const { verifyUser } = require('./lib/notify');
const { getAdmin } = require('./lib/firebaseAdmin');

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, extra });

const tsMs = (t) => (t == null ? null : typeof t === 'number' ? t : typeof t.toMillis === 'function' ? t.toMillis() : t._seconds != null ? t._seconds * 1000 + Math.floor((t._nanoseconds || 0) / 1e6) : t.ms != null ? t.ms : null);
const defaultTs = (ms) => getAdmin().firestore.Timestamp.fromMillis(ms);
const taskKeyOf = (t) => `${t?.createdAt || ''}|${t?.title || ''}`;
const stableIdOf = (t) => (t && (t.id != null && t.id !== '' ? `id:${t.id}` : `k:${taskKeyOf(t)}`)) || '';
// Points earned on the locked set. Each lock slot n belongs to the task stored at lock.indexes[n] when the day started; match it by its
// stable id (lock.ids[n]) so reorders/inserts after Start Day can't shift points onto another task, falling back to lock.indexes[n]
// for locks written before ids existed. Never tasks[n] (that was the bug: slot n is not array position n).
const lockedEarned = (lock, tasks) => {
  const list = tasks || []; const byId = new Map(); list.forEach((t) => { const k = stableIdOf(t); if (k && !byId.has(k)) byId.set(k, t); });
  let earned = 0, done = 0;
  (lock.points || []).forEach((p, n) => {
    const id = lock.ids && lock.ids[n]; const idx = lock.indexes ? lock.indexes[n] : undefined;
    const t = id && byId.has(id) ? byId.get(id) : (idx != null ? list[idx] : undefined);
    if (t && t.completed) { earned += Number(p) || 0; done += 1; }
  });
  return { earned, done };
};

// Tasks that count toward the day: the visible ones (recurring copies with a later activeFrom are hidden today).
const pruneStale = (tasks, tz, dayKey) => tasks.filter((t) => { if (!t || t.type !== 'one-time' || !t.completed || !t.completedAt) return true;
  const ms = Date.parse(t.completedAt); return !Number.isFinite(ms) || core.dayKeyIn(tz, ms) >= dayKey; });
const countable = (tasks, dayKey) => tasks.map((t, i) => ({ t, i })).filter(({ t }) => t && !(t.activeFrom && dayKey < t.activeFrom));

// ── REQUIRES SERVER AI (OPENAI_API_KEY + user consent). Without them this returns null and the heuristic is used. ──
const aiRefine = async (items, stats, { fetch: f, apiKey }) => {
  if (!apiKey || !f) return null;
  const list = items.map((x, n) => ({ n, title: String(x.title || '').slice(0, 120), notes: String(x.notes || '').slice(0, 200), minutes: x.minutes, priority: x.priority || '' }));
  const body = {
    model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You rate to-do tasks for a strict fixed-length productivity day (3 to 12 hours). Reply with JSON only: {"tasks":[{"n":0,"complexity":1-5,"minutes":1-600}],"targetRatio":0.8-1.0}. complexity 1=trivial, 5=very demanding. targetRatio is the share of total points the user must earn (use higher values for easy, short plans and a tight schedule).' },
      { role: 'user', content: JSON.stringify({ tasks: list, streak: stats.streak || 0, lastResult: stats.lastResult || '' }) },
    ],
  };
  try {
    const r = await f('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const data = await r.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const rows = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const byN = new Map(rows.map((x) => [Number(x.n), x]));
    const out = items.map((_, n) => {
      const x = byN.get(n); if (!x) return null;
      const complexity = Math.round(Number(x.complexity)), minutes = Math.round(Number(x.minutes));
      return Number.isFinite(complexity) && Number.isFinite(minutes) ? { complexity: core.clamp(complexity, 1, 5), minutes: core.clamp(minutes, 1, 600) } : null;
    });
    const ratio = Number(parsed.targetRatio);
    return { tasks: out, ratio: Number.isFinite(ratio) ? core.clamp(ratio, 0.8, 1) : null };
  } catch (e) { return null; }
};

const publicLock = (l) => (l ? { hours: core.clampHours(l.hours), dayKey: l.dayKey, dayName: l.dayName, tz: l.tz, wakeTime: l.wakeTime, startMs: l.startMs, endMs: l.endMs, taskCount: l.taskCount, plannedCount: l.plannedCount,
  points: l.points, totalPoints: l.totalPoints, target: l.target, targetSource: l.targetSource, estimateSource: l.estimateSource, earned: l.earned || 0, done: l.done || 0, settled: !!l.settled,
  index: core.blockIndex(l), scheduled: !!l.scheduled, pending: core.pendingOf(l).map((b) => ({ dayKey: b.dayKey, index: b.index, startMs: b.startMs, endMs: b.endMs, hours: b.hours })) } : null);
// What firestore.rules read: startAt/endAt bound the edit lock, shutUntil the read-only hard stop (= endMs while a later block is pending).
const lockWrite = (ctx, lock) => ({ ...lock, startAt: ctx.ts(lock.startMs), endAt: ctx.ts(lock.endMs), shutUntil: ctx.ts(core.rulesShutUntilMs(lock)) });

// Settle a finished window once: final earned, history row, new stats. Idempotent (settled flag + settleDay's lastDay check).
const settleIfOver = async (ctx, doc, now) => {
  const lock = doc.lock;
  if (!lock || lock.settled || now < lock.endMs) return doc;
  let earned = lock.earned || 0;
  try { // last full recount, only when the day doc was last written inside the window (updatedAt is a server timestamp, so completions cannot be back-dated)
    const dsnap = await ctx.db.doc(`weeklyRoutines/${ctx.uid}_${lock.dayName}`).get();
    const d = dsnap.exists ? dsnap.data() : null;
    const wrote = tsMs(d && d.updatedAt);
    if (d && wrote != null && wrote <= lock.endMs) {
      const tasks = d.tasks || [];
      const full = lockedEarned(lock, tasks).earned;
      earned = Math.max(earned, full);
    }
  } catch (e) { /* keep the server-time progress value */ }
  const settledLock = { ...lock, earned, settled: true };
  const idx = core.blockIndex(lock);
  // The streak/target settle once per day, on the day's FIRST block. Later blocks (evening mode) and empty scheduled blocks only write a history row.
  const counts = idx === 0 && !(lock.scheduled && !(lock.taskCount > 0)); // legacy locks (no index/taskCount) still settle
  const stats = counts ? core.settleDay(doc.stats, { dayKey: lock.dayKey, earned, target: lock.target, allDone: (lock.totalPoints || 0) > 0 && earned >= lock.totalPoints }) : { ...core.defaultStats(), ...(doc.stats || {}) };
  const next = { ...doc, lock: settledLock, stats };
  await ctx.db.doc(`eightHour/${ctx.uid}`).set({ lock: lockWrite(ctx, settledLock), ...(counts ? { stats } : {}) }, { merge: true });
  const hid = idx === 0 ? lock.dayKey : core.sessionKey(lock.dayKey, idx);
  await ctx.db.doc(`eightHour/${ctx.uid}/history/${hid}`).set({ dayKey: lock.dayKey, index: idx, startMs: lock.startMs, endMs: lock.endMs, taskCount: lock.taskCount, total: lock.totalPoints, target: lock.target, earned,
    met: counts ? stats.lastResult === 'met' : (lock.target > 0 && earned >= lock.target), streakCounted: counts, settledMs: ctx.now });
  return next;
};

const loadDoc = async (ctx) => { const s = await ctx.db.doc(`eightHour/${ctx.uid}`).get(); return s.exists ? s.data() : {}; };
// hours: the frozen lock hours, else the user's default day length (doc.dayLengthHours is attached by loadUserDefaults; missing = core default).
const phaseOf = (doc, now) => core.evaluatePhase({ wakeTime: doc.plan?.wakeTime, tz: doc.plan?.tz, nowMs: now, hours: doc.lock?.hours ?? doc.dayLengthHours,
  lock: doc.lock ? { startMs: doc.lock.startMs, endMs: doc.lock.endMs, dayKey: doc.lock.dayKey, index: doc.lock.index, pending: doc.lock.pending } : null });
const userDoc = async (ctx) => { const u = await ctx.db.doc(`users/${ctx.uid}`).get(); return u.exists ? u.data() : {}; };
const view = (doc, now) => {
  const ph = phaseOf(doc, now);
  return { now, phase: ph.phase, window: ph.phase === 'none' ? null : { startMs: ph.startMs || null, endMs: ph.endMs || null, wakeMs: ph.wakeMs || null, dayKey: ph.dayKey || null, missed: !!ph.missed, nextStartMs: ph.nextStartMs || null, nextEndMs: ph.nextEndMs || null },
    plan: doc.plan ? { wakeTime: doc.plan.wakeTime, tz: doc.plan.tz, taskCount: doc.plan.taskCount } : null,
    lock: ph.phase === 'running' || ph.phase === 'gap' || (doc.lock && (doc.lock.dayKey === ph.dayKey || core.isShut(doc.lock, now))) ? publicLock(doc.lock) : null, // kept while the hard stop runs (until the next wake time)
    stats: { ...core.defaultStats(), ...(doc.stats || {}) }, reward: core.rewardFor((doc.stats || {}).streak || 0) };
};

// Lock one block. index 0 = the day's main block: snapshot every countable task, reset completions, enforce the task range (strict).
// index > 0 (a later block the same day): lock only the still-open tasks, keep completions, no minimum (0 open tasks = an empty block that
// still shuts nothing early and settles neutrally). Scheduled blocks keep their FIXED start/end even when started late.
const beginBlock = async (ctx, doc, { hours, startMs, endMs, dayKey, index, pending = [], strict, scheduled = false, apiKey = null }) => {
  const tz = doc.plan.tz;
  const dayName = core.dayNameIn(tz, startMs);
  const dayRef = ctx.db.doc(`weeklyRoutines/${ctx.uid}_${dayName}`);
  const dsnap = await dayRef.get();
  const later = index > 0;
  // Day rollover: completed one-time tasks (incl. repeat-series copies) stay visible on the day they were done and leave the list
  // at the next local day; drop leftovers from an earlier day here so Start Day never re-opens them into the locked set.
  const stored = pruneStale(dsnap.exists ? (dsnap.data().tasks || []) : [], tz, dayKey);
  let rows = countable(stored, dayKey);
  if (later) rows = rows.filter(({ t }) => !t.completed);
  const range = core.taskRange(hours); // min derived from the chosen hours, max = MAX_TASKS_PER_DAY (plan.taskCount is no longer an exact requirement)
  if (rows.length > range.max) { if (strict) throw fail(409, `At most ${range.max} tasks per day.`, { code: 'too-many' }); rows = rows.slice(0, range.max); }
  if (strict) {
    if (rows.length === 0) throw fail(409, `Add at least ${range.min} task${range.min === 1 ? '' : 's'} for today first.`, { code: 'no-tasks' });
    if (rows.length < range.min) throw fail(409, `Need at least ${range.min} tasks for ${core.hoursLabel(hours)} hours; you have ${rows.length}.`, { code: 'too-few' });
  }
  const stats = { ...core.defaultStats(), ...(doc.stats || {}) };

  let est = rows.map(({ t }) => core.estimateTask({ title: t.title, notes: t.notes, estimateMin: t.estimateMin, priority: t.priority }));
  let ratioAi = null; let source = 'heuristic';
  // REQUIRES SERVER AI: only with OPENAI_API_KEY on the server and the user's AI consent (users/{uid}.aiConsent). Otherwise the heuristic above stands.
  if (apiKey && rows.length) {
    const u = await ctx.db.doc(`users/${ctx.uid}`).get();
    if (u.exists && u.data().aiConsent === true) {
      const ai = await aiRefine(rows.map(({ t }, n) => ({ title: t.title, notes: t.notes, priority: t.priority, minutes: est[n].minutes })), stats, { fetch: ctx.fetch, apiKey });
      if (ai) {
        est = est.map((e, n) => (ai.tasks[n] ? { complexity: ai.tasks[n].complexity, minutes: ai.tasks[n].minutes, points: core.pointsFor(ai.tasks[n].complexity, ai.tasks[n].minutes), source: 'ai' } : e));
        ratioAi = ai.ratio; source = 'ai';
      }
    }
  }
  // Assistant-rated points (Gemini, stored on the task as pointsSource 'ai') survive the lock, clamped to the same 5..150 range as pointsFor.
  est = est.map((e, n) => { const t = rows[n].t; const p = Math.round(Number(t.points)); if (t.pointsSource !== 'ai' || !(p > 0)) return e;
    const cx = Math.round(Number(t.complexity)); return { ...e, points: Math.min(150, Math.max(5, p)), complexity: cx >= 1 && cx <= 5 ? cx : e.complexity, source: 'assistant' }; });
  const blockMin = Math.round((endMs - startMs) / 60000);
  const tgt = core.dailyTarget(est.map((e) => ({ points: e.points, minutes: e.minutes })), stats, blockMin);
  let target = tgt.target; let targetSource = 'heuristic';
  if (ratioAi != null && tgt.total > 0) { // the model can only make the target tighter than the level-based one, never easier
    const raised = core.clamp(core.round5(tgt.total * Math.max(ratioAi, tgt.effRatio)), 5, tgt.total);
    if (raised > target) { target = raised; targetSource = 'ai'; }
  }
  const next = stored.map((t) => ({ ...t })); // identical order and size: the lock compares by index
  rows.forEach(({ i }, n) => { next[i] = { ...next[i], ...(later ? {} : { completed: false, completedAt: null }), timerActive: false, points: est[n].points, complexity: est[n].complexity, estimateMin: est[n].minutes }; });
  const points = rows.map((_, n) => est[n].points);
  const lock = { hours, index, scheduled, placeholder: false, dayKey, dayName, tz, wakeTime: doc.plan.wakeTime, startMs, endMs, taskCount: rows.length, plannedCount: doc.plan.taskCount,
    indexes: rows.map(({ i }) => i), ids: rows.map(({ t }) => stableIdOf(t)), points, totalPoints: points.reduce((a, b) => a + b, 0), target, targetSource, targetLevel: tgt.level, estimateSource: source, earned: 0, done: 0, settled: false,
    pending: pending.map((b) => ({ dayKey: b.dayKey, index: b.index, startMs: b.startMs, endMs: b.endMs, hours: b.hours })) };
  const ref = ctx.db.doc(`eightHour/${ctx.uid}`);
  await ctx.db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const l = cur.exists ? cur.data().lock : null;
    if (l && !l.placeholder && l.dayKey === lock.dayKey && core.blockIndex(l) === index) return; // another device won the race (same day + block)
    const archive = l && !l.placeholder && l.dayKey ? { sessions: { [core.sessionKey(l.dayKey, core.blockIndex(l))]: JSON.parse(JSON.stringify({ ...publicLock(l), pending: [] })) } } : {};
    tx.set(dayRef, { tasks: next, updatedAt: ctx.serverTime() }, { merge: true });
    tx.set(ref, { ...archive, lock: lockWrite(ctx, lock) }, { merge: true });
  });
  return view(await loadDoc(ctx), ctx.now);
};

// Start every scheduled block whose start has arrived (server clock), even late, at its fixed start/end. Blocks that ended unseen are
// archived as missed. Requires the previous block to be over (it is: blocks never overlap). Returns the fresh doc.
const autoStart = async (ctx, doc) => {
  const lock = doc.lock;
  if (!lock || !doc.plan || !core.validTz(doc.plan.tz)) return doc;
  if (ctx.now >= lock.startMs && ctx.now < lock.endMs) return doc;
  const pend = core.pendingOf(lock);
  const due = pend.find((b) => b.startMs <= ctx.now && b.endMs > ctx.now);
  const stale = pend.filter((b) => b.endMs <= ctx.now);
  if (!due && !stale.length) return doc;
  if (!due) { // every due block was missed: drop them (history rows) and let the normal hard stop apply from the last one
    const rest = pend.filter((b) => b.endMs > ctx.now);
    const lastEnd = Math.max(...stale.map((b) => b.endMs));
    const nextLock = { ...lock, pending: rest };
    for (const b of stale) await ctx.db.doc(`eightHour/${ctx.uid}/history/${core.sessionKey(b.dayKey, b.index)}`).set({ dayKey: b.dayKey, index: b.index, startMs: b.startMs, endMs: b.endMs, missedStart: true, settledMs: ctx.now });
    const w = lockWrite(ctx, nextLock); if (!rest.length) w.shutUntil = ctx.ts(core.shutUntilMs({ ...lock, endMs: lastEnd }));
    await ctx.db.doc(`eightHour/${ctx.uid}`).set({ lock: w }, { merge: true });
    return { ...doc, lock: nextLock };
  }
  const rest = pend.filter((b) => b !== due && b.endMs > ctx.now);
  try {
    await beginBlock(ctx, doc, { hours: due.hours, startMs: due.startMs, endMs: due.endMs, dayKey: due.dayKey, index: due.index, pending: rest, strict: false, scheduled: true, apiKey: null });
  } catch (e) { if (!e.status) throw e; }
  return loadDoc(ctx);
};

const actions = {
  async state(ctx) {
    let doc = await loadDoc(ctx);
    doc = await settleIfOver(ctx, doc, ctx.now);
    doc = await autoStart(ctx, doc);
    return view(doc, ctx.now);
  },

  // Set/update wake time + planned task count. Refused while the window runs; the wake time is also frozen once it has passed today (the countdown is about to begin).
  async plan(ctx, body) {
    let doc = await loadDoc(ctx);
    doc = await settleIfOver(ctx, doc, ctx.now);
    doc = await autoStart(ctx, doc);
    const wake = core.parseWake(body.wakeTime);
    if (!wake) throw fail(400, 'Pick a valid wake time (HH:MM)');
    const tz = body.tz || doc.plan?.tz;
    if (!core.validTz(tz)) throw fail(400, 'Unknown time zone');
    const count = Math.round(Number(body.taskCount));
    if (!(count >= 1 && count <= core.MAX_TASKS_PER_DAY)) throw fail(400, `Plan between 1 and ${core.MAX_TASKS_PER_DAY} tasks`);
    const ph = phaseOf(doc, ctx.now);
    const wakeTime = core.fmtWake(wake);
    if (ph.phase === 'running') throw fail(423, `Locked: your ${core.hoursLabel(doc.lock && doc.lock.hours)}-hour day is running.`+' Plan changes open after it ends.', { code: 'locked' });
    if (ph.phase === 'ready' && doc.plan && (doc.plan.wakeTime !== wakeTime)) throw fail(423, 'Locked: the countdown is about to begin, so the wake time can no longer change today.', { code: 'locked' });
    const plan = { wakeTime, tz: ph.phase === 'ready' && doc.plan ? doc.plan.tz : tz, taskCount: count, updatedMs: ctx.now };
    await ctx.db.doc(`eightHour/${ctx.uid}`).set({ plan }, { merge: true });
    return view({ ...doc, plan }, ctx.now);
  },

  // Begin the window (idempotent). Snapshot the day's tasks, let the estimator (AI if available, else heuristic) assign points, fix the target, lock.
  // body.hours: the span confirmed in the morning prompt (clamped to 3..12, 0.5 steps; default 8). The window runs from NOW (server clock) to now + hours.
  async start(ctx, body = {}) {
    let doc = await loadDoc(ctx);
    doc = await settleIfOver(ctx, doc, ctx.now);
    doc = await autoStart(ctx, doc);
    const ud = await userDoc(ctx); doc = { ...doc, dayLengthHours: ud.dayLengthHours };
    const ph = phaseOf(doc, ctx.now);
    if (ph.phase === 'running') return view(doc, ctx.now); // already started (second device / retry)
    if (ph.phase === 'gap') throw fail(409, 'Your next lock-in is already scheduled.', { code: 'gap' });
    if (ph.phase !== 'ready') throw fail(409, ph.phase === 'before' ? 'Your wake time has not arrived yet.' : ph.phase === 'ended' ? 'Today\'s day is already over.' : 'Pick a wake time first.', { code: ph.phase });
    // lock-in is opt-in (users/{uid}.lockInEnabled === true) and can be skipped for one date (lockInSkipDate === dayKey)
    if (ud.lockInEnabled !== true) throw fail(403, 'Lock-in is off. Turn it on in Settings to use the countdown lock.', { code: 'lock-in-off' });
    if (ud.lockInSkipDate && ud.lockInSkipDate === ph.dayKey) throw fail(403, 'Lock-in is skipped for today.', { code: 'lock-in-skipped' });
    const hours = core.clampHours(body.hours);
    // B44 wake-up auto-lock: iOS already locked the apps at the wake time (no Confirm), so the window starts THEN, not now. Only with the
    // opt-in (users/{uid}.wakeAutoLock), only back to today's wake instant, and only while that window is still open.
    const autoWake = body.autoWake === true;
    if (autoWake && ud.wakeAutoLock !== true) throw fail(403, 'Lock at wake-up is off.', { code: 'wake-off' });
    const startMs = autoWake ? ph.wakeMs : ctx.now, endMs = startMs + core.hoursMs(hours); // confirm-time start: end = confirm + hours
    if (autoWake && !(startMs <= ctx.now && endMs > ctx.now)) throw fail(409, 'Today\'s wake-up lock is already over.', { code: 'ended' });
    let pending = [];
    if (Array.isArray(body.blocks) && body.blocks.length) { // split day: later blocks today, fixed now (before they start)
      const r = core.planBlocks({ requests: body.blocks, tz: doc.plan.tz, nowMs: ctx.now, notBefore: endMs, existing: [{ startMs, endMs, dayKey: ph.dayKey, index: 0 }] });
      if (!r.ok) throw fail(400, r.error, { code: 'bad-blocks' });
      if (r.blocks.some((x) => x.dayKey !== ph.dayKey)) throw fail(400, 'Split blocks must be later today. Use Schedule for tomorrow.', { code: 'bad-blocks' });
      pending = r.blocks;
    }
    return beginBlock(ctx, doc, { hours, startMs, endMs, dayKey: ph.dayKey, index: 0, pending, strict: !autoWake, apiKey: ctx.apiKey });
  },

  // Evening mode, option 1: schedule the next lock-in(s). body.blocks: [{ time: 'HH:MM' (plan time zone), hours }]. Blocks are appended to
  // lock.pending; they can never be removed or shortened (no cancel action exists), must start >= 5 min from now, within 18h, after the running block,
  // and not overlap anything already fixed. The app stays usable until a block starts; the server (and the native schedule) then start it.
  async schedule(ctx, body = {}) {
    let doc = await loadDoc(ctx);
    doc = await settleIfOver(ctx, doc, ctx.now);
    doc = await autoStart(ctx, doc);
    if (!doc.plan || !core.validTz(doc.plan.tz)) throw fail(409, 'Pick a wake time first.', { code: 'none' });
    const ud = await userDoc(ctx);
    if (ud.lockInEnabled !== true) throw fail(403, 'Lock-in is off. Turn it on in Settings to use the countdown lock.', { code: 'lock-in-off' });
    const lock = doc.lock || null;
    const existing = [];
    if (lock) { existing.push({ startMs: lock.startMs, endMs: lock.endMs, dayKey: lock.dayKey, index: core.blockIndex(lock) }); core.pendingOf(lock).forEach((b) => existing.push(b)); }
    Object.entries(doc.sessions || {}).forEach(([, x]) => { if (x && x.dayKey) existing.push({ startMs: x.startMs, endMs: x.endMs, dayKey: x.dayKey, index: x.index || 0 }); });
    const r = core.planBlocks({ requests: body.blocks, tz: doc.plan.tz, nowMs: ctx.now, existing, notBefore: lock ? Math.max(ctx.now, lock.endMs > ctx.now ? lock.endMs : 0) : 0 });
    if (!r.ok) throw fail(400, r.error, { code: 'bad-blocks' });
    // Anti-cheat: from the hard stop, the next block must begin BEFORE the stop would have lifted anyway (the next wake time);
    // otherwise "schedule something tomorrow afternoon" would simply unlock the app all night.
    if (lock && core.isShut(lock, ctx.now)) {
      const lastEnd = Math.max(lock.endMs, ...core.pendingOf(lock).map((b) => b.endMs)); const until = core.shutUntilMs({ ...lock, endMs: lastEnd });
      if (r.blocks.some((b) => b.startMs >= until)) throw fail(400, `While shut, the next lock-in has to start before ${core.fmtClock(until, doc.plan.tz)}.`, { code: 'bad-blocks' });
    }
    const ref = ctx.db.doc(`eightHour/${ctx.uid}`);
    let out = null;
    await ctx.db.runTransaction(async (tx) => {
      const cur = await tx.get(ref); const d = cur.exists ? cur.data() : {}; const l = d.lock || null;
      if (l && lock && core.sessionKey(l.dayKey, core.blockIndex(l)) !== core.sessionKey(lock.dayKey, core.blockIndex(lock))) throw fail(409, 'Your lock-in changed. Try again.', { code: 'race' });
      if (l && core.pendingOf(l).length !== core.pendingOf(lock).length) throw fail(409, 'Your lock-in changed. Try again.', { code: 'race' });
      // No lock yet (first ever use): a placeholder "ended" lock carries the pending list so every reader sees the schedule.
      const base = l || { hours: core.clampHours(ud.dayLengthHours), dayKey: '', dayName: '', tz: doc.plan.tz, wakeTime: doc.plan.wakeTime, startMs: 0, endMs: 0, taskCount: 0, points: [], totalPoints: 0, target: 0, earned: 0, done: 0, settled: true, placeholder: true };
      const nextLock = { ...base, pending: [...core.pendingOf(l), ...r.blocks] };
      tx.set(ref, { lock: lockWrite(ctx, nextLock) }, { merge: true });
      out = nextLock;
    });
    return view({ ...doc, lock: out }, ctx.now);
  },

  // Record progress from the server's point of view (call after each completion). Counts only locked tasks, only inside the window.
  async progress(ctx) {
    let doc = await loadDoc(ctx);
    const lock = doc.lock;
    if (!lock || ctx.now < lock.startMs || ctx.now >= lock.endMs) { doc = await settleIfOver(ctx, doc, ctx.now); doc = await autoStart(ctx, doc); return view(doc, ctx.now); }
    const dsnap = await ctx.db.doc(`weeklyRoutines/${ctx.uid}_${lock.dayName}`).get();
    const tasks = dsnap.exists ? (dsnap.data().tasks || []) : [];
    const { earned, done } = lockedEarned(lock, tasks);
    const next = { ...lock, earned, done };
    await ctx.db.doc(`eightHour/${ctx.uid}`).set({ lock: lockWrite(ctx, next) }, { merge: true });
    return view({ ...doc, lock: next }, ctx.now);
  },
};

const rawHandler = async (event, _ctx, deps = {}) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
    let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad JSON' }); }
    const fn = actions[body.action];
    if (!fn) return json(400, { error: 'Unknown action' });
    const db = deps.db || getAdmin().firestore();
    const ctx = { uid, db, now: deps.now ? deps.now() : Date.now(), // SERVER clock only: the client clock is never trusted
      ts: deps.ts || defaultTs, serverTime: deps.serverTime || (() => getAdmin().firestore.FieldValue.serverTimestamp()), fetch: deps.fetch || (typeof fetch === 'function' ? fetch : null),
      apiKey: 'apiKey' in deps ? deps.apiKey : process.env.OPENAI_API_KEY };
    return json(200, await fn(ctx, body));
  } catch (e) {
    return json(e.status || 500, { error: e.status ? e.message : 'Server error', ...(e.extra || {}) });
  }
};
const { withCors } = require('./lib/cors');
exports.handler = withCors(rawHandler);
exports._internal = { actions, beginBlock, autoStart, phaseOf, settleIfOver, lockedEarned, stableIdOf, countable, pruneStale, aiRefine };
