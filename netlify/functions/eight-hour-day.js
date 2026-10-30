// POST /.netlify/functions/eight-hour-day   Authorization: Bearer <Firebase ID token>
// Body: { action: 'state' | 'plan' | 'start' | 'progress', ... }
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
  points: l.points, totalPoints: l.totalPoints, target: l.target, targetSource: l.targetSource, estimateSource: l.estimateSource, earned: l.earned || 0, done: l.done || 0, settled: !!l.settled } : null);

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
  const stats = core.settleDay(doc.stats, { dayKey: lock.dayKey, earned, target: lock.target, allDone: (lock.totalPoints || 0) > 0 && earned >= lock.totalPoints });
  const next = { ...doc, lock: settledLock, stats };
  await ctx.db.doc(`eightHour/${ctx.uid}`).set({ lock: { ...settledLock, startAt: ctx.ts(lock.startMs), endAt: ctx.ts(lock.endMs), shutUntil: ctx.ts(core.shutUntilMs(lock)) }, stats }, { merge: true });
  await ctx.db.doc(`eightHour/${ctx.uid}/history/${lock.dayKey}`).set({ dayKey: lock.dayKey, startMs: lock.startMs, endMs: lock.endMs, taskCount: lock.taskCount, total: lock.totalPoints, target: lock.target, earned, met: stats.lastResult === 'met', settledMs: ctx.now });
  return next;
};

const loadDoc = async (ctx) => { const s = await ctx.db.doc(`eightHour/${ctx.uid}`).get(); return s.exists ? s.data() : {}; };
const phaseOf = (doc, now) => core.evaluatePhase({ wakeTime: doc.plan?.wakeTime, tz: doc.plan?.tz, nowMs: now, lock: doc.lock ? { startMs: doc.lock.startMs, endMs: doc.lock.endMs, dayKey: doc.lock.dayKey } : null });
const view = (doc, now) => {
  const ph = phaseOf(doc, now);
  return { now, phase: ph.phase, window: ph.phase === 'none' ? null : { startMs: ph.startMs || null, endMs: ph.endMs || null, wakeMs: ph.wakeMs || null, dayKey: ph.dayKey || null, missed: !!ph.missed },
    plan: doc.plan ? { wakeTime: doc.plan.wakeTime, tz: doc.plan.tz, taskCount: doc.plan.taskCount } : null,
    lock: ph.phase === 'running' || (doc.lock && (doc.lock.dayKey === ph.dayKey || core.isShut(doc.lock, now))) ? publicLock(doc.lock) : null, // kept while the hard stop runs (until the next wake time)
    stats: { ...core.defaultStats(), ...(doc.stats || {}) }, reward: core.rewardFor((doc.stats || {}).streak || 0) };
};

const actions = {
  async state(ctx) {
    let doc = await loadDoc(ctx);
    doc = await settleIfOver(ctx, doc, ctx.now);
    return view(doc, ctx.now);
  },

  // Set/update wake time + planned task count. Refused while the window runs; the wake time is also frozen once it has passed today (the countdown is about to begin).
  async plan(ctx, body) {
    let doc = await loadDoc(ctx);
    doc = await settleIfOver(ctx, doc, ctx.now);
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
    const ph = phaseOf(doc, ctx.now);
    if (ph.phase === 'running') return view(doc, ctx.now); // already started (second device / retry)
    if (ph.phase !== 'ready') throw fail(409, ph.phase === 'before' ? 'Your wake time has not arrived yet.' : ph.phase === 'ended' ? 'Today\'s day is already over.' : 'Pick a wake time first.', { code: ph.phase });
    { // lock-in is opt-in (users/{uid}.lockInEnabled === true) and can be skipped for one date (lockInSkipDate === dayKey)
      const u = await ctx.db.doc(`users/${ctx.uid}`).get(); const ud = u.exists ? u.data() : {};
      if (ud.lockInEnabled !== true) throw fail(403, 'Lock-in is off. Turn it on in Settings to use the countdown lock.', { code: 'lock-in-off' });
      if (ud.lockInSkipDate && ud.lockInSkipDate === ph.dayKey) throw fail(403, 'Lock-in is skipped for today.', { code: 'lock-in-skipped' });
    }
    const hours = core.clampHours(body.hours);
    ph.startMs = ctx.now; ph.endMs = ctx.now + core.hoursMs(hours); // confirm-time start: end = confirm + hours
    const dayName = core.dayNameIn(doc.plan.tz, ph.startMs);
    const dayRef = ctx.db.doc(`weeklyRoutines/${ctx.uid}_${dayName}`);
    const dsnap = await dayRef.get();
    // Day rollover: completed one-time tasks (incl. repeat-series copies) stay visible on the day they were done and leave the list
    // at the next local day; drop leftovers from an earlier day here so Start Day never re-opens them into the locked set.
    const stored = pruneStale(dsnap.exists ? (dsnap.data().tasks || []) : [], doc.plan.tz, ph.dayKey);
    const rows = countable(stored, ph.dayKey);
    const range = core.taskRange(hours); // min derived from the chosen hours, max = MAX_TASKS_PER_DAY (plan.taskCount is no longer an exact requirement)
    if (rows.length === 0) throw fail(409, `Add at least ${range.min} task${range.min === 1 ? '' : 's'} for today first.`, { code: 'no-tasks' });
    if (rows.length > range.max) throw fail(409, `At most ${range.max} tasks per day.`, { code: 'too-many' });
    if (rows.length < range.min) throw fail(409, `Need at least ${range.min} tasks for ${core.hoursLabel(hours)} hours; you have ${rows.length}.`, { code: 'too-few' });
    const stats = { ...core.defaultStats(), ...(doc.stats || {}) };

    let est = rows.map(({ t }) => core.estimateTask({ title: t.title, notes: t.notes, estimateMin: t.estimateMin, priority: t.priority }));
    let ratioAi = null; let source = 'heuristic';
    // REQUIRES SERVER AI: only with OPENAI_API_KEY on the server and the user's AI consent (users/{uid}.aiConsent). Otherwise the heuristic above stands.
    const apiKey = ctx.apiKey;
    if (apiKey) {
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
    const tgt = core.dailyTarget(est.map((e) => ({ points: e.points, minutes: e.minutes })), stats, hours * 60);
    let target = tgt.target; let targetSource = 'heuristic';
    if (ratioAi != null && tgt.total > 0) { // the model can only make the target tighter than the level-based one, never easier
      const raised = core.clamp(core.round5(tgt.total * Math.max(ratioAi, tgt.effRatio)), 5, tgt.total);
      if (raised > target) { target = raised; targetSource = 'ai'; }
    }
    const next = stored.map((t) => ({ ...t })); // identical order and size: the lock compares by index
    rows.forEach(({ i }, n) => { next[i] = { ...next[i], completed: false, completedAt: null, timerActive: false, points: est[n].points, complexity: est[n].complexity, estimateMin: est[n].minutes }; });
    const points = rows.map((_, n) => est[n].points);
    const lock = { hours, dayKey: ph.dayKey, dayName, tz: doc.plan.tz, wakeTime: doc.plan.wakeTime, startMs: ph.startMs, endMs: ph.endMs, taskCount: rows.length, plannedCount: doc.plan.taskCount,
      indexes: rows.map(({ i }) => i), ids: rows.map(({ t }) => stableIdOf(t)), points, totalPoints: points.reduce((a, b) => a + b, 0), target, targetSource, targetLevel: tgt.level, estimateSource: source, earned: 0, done: 0, settled: false };
    await ctx.db.runTransaction(async (tx) => {
      const cur = await tx.get(ctx.db.doc(`eightHour/${ctx.uid}`));
      const l = cur.exists ? cur.data().lock : null;
      if (l && l.dayKey === lock.dayKey) return; // another device won the race
      tx.set(dayRef, { tasks: next, updatedAt: ctx.serverTime() }, { merge: true });
      tx.set(ctx.db.doc(`eightHour/${ctx.uid}`), { lock: { ...lock, startAt: ctx.ts(lock.startMs), endAt: ctx.ts(lock.endMs), shutUntil: ctx.ts(core.shutUntilMs(lock)) } }, { merge: true });
    });
    return view(await loadDoc(ctx), ctx.now);
  },

  // Record progress from the server's point of view (call after each completion). Counts only locked tasks, only inside the window.
  async progress(ctx) {
    let doc = await loadDoc(ctx);
    const lock = doc.lock;
    if (!lock || ctx.now < lock.startMs || ctx.now >= lock.endMs) { doc = await settleIfOver(ctx, doc, ctx.now); return view(doc, ctx.now); }
    const dsnap = await ctx.db.doc(`weeklyRoutines/${ctx.uid}_${lock.dayName}`).get();
    const tasks = dsnap.exists ? (dsnap.data().tasks || []) : [];
    const { earned, done } = lockedEarned(lock, tasks);
    const next = { ...lock, earned, done };
    await ctx.db.doc(`eightHour/${ctx.uid}`).set({ lock: { ...next, startAt: ctx.ts(lock.startMs), endAt: ctx.ts(lock.endMs), shutUntil: ctx.ts(core.shutUntilMs(lock)) } }, { merge: true });
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
exports._internal = { actions, settleIfOver, lockedEarned, stableIdOf, countable, pruneStale, aiRefine };
