import { ref } from 'vue';
// Coach-mode game plan (pure helpers; only a Vue ref for the size-mode flag, no Firestore / native imports).
// 1 fixed weekly schedule (edits queued until the weekly review)   2 focus block = 2 x 50 min, notifications held back
// 3 each finished focus session EARNS a 10 min break (banked; the user chooses when to take it; never costs points)   4 hard close = day start + 8 h, nothing earned after
// 5 points per finished task by size (S 10 / M 20 / L 40); goal = max(min, min(90% of trailing 14-day median, today's planned load))
// 6 locking: checklist gate, Screen Time revoke penalty, optional friend-approved early unlock (off by default), friction countdown
// 7 at close the user picks which leftovers go to tomorrow (nothing rolls over by itself, no penalty)
// 8 shift-relative: everything anchors to the user's day start (an evening shift may close after midnight)

export const GP_DEFAULTS = { dayStart: '09:00', focusMin: 50, sessions: 2, breakMin: 10, breakEvery: 50, closeHours: 8, reviewDow: 0, reviewTime: '18:00', minGoal: 50, friend: null, friendUnlock: false };
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const validHHMM = (s) => HHMM.test(String(s || ''));
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const round5 = (n) => Math.round(n / 5) * 5;
const MIN = 60000; const HOUR = 60 * MIN; const DAY = 24 * HOUR;
const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Saved doc (users/{uid}.gamePlan) -> clean plan. The first default day start is the onboarding wake time when there is one.
export const normPlan = (gp = {}, wakeTime = '') => {
  const g = gp || {}; const out = { ...GP_DEFAULTS };
  out.dayStart = validHHMM(g.dayStart) ? g.dayStart : (validHHMM(wakeTime) ? wakeTime : GP_DEFAULTS.dayStart);
  out.reviewDow = Number.isInteger(g.reviewDow) && g.reviewDow >= 0 && g.reviewDow <= 6 ? g.reviewDow : GP_DEFAULTS.reviewDow;
  out.reviewTime = validHHMM(g.reviewTime) ? g.reviewTime : GP_DEFAULTS.reviewTime;
  out.sessions = Number(g.sessions) === 1 ? 1 : 2; // user picks 1 or 2 (morning, + afternoon); no midday/third slot
  out.breakEvery = Number(g.breakEvery) >= 25 ? Math.min(200, round5(Number(g.breakEvery))) : GP_DEFAULTS.breakEvery;
  out.minGoal = Number(g.minGoal) >= 10 ? Math.min(500, round5(Number(g.minGoal))) : GP_DEFAULTS.minGoal;
  out.friendUnlock = g.friendUnlock === true; // optional, default OFF
  out.friend = g.friend && g.friend.name ? { name: String(g.friend.name).slice(0, 40) } : null;
  out.pending = g.pending && typeof g.pending === 'object' ? g.pending : null;
  out.lastReview = g.lastReview || '';
  out.userSet = !!g.userSet; // set once the user saved the plan in Settings (the first save applies at once)
  return out;
};

// ---- 1. fixed week: edits are queued, applied at the weekly review ----
export const SCHEDULE_FIELDS = ['dayStart', 'reviewDow', 'reviewTime', 'minGoal'];
export const queueEdit = (gp, patch, nowMs = Date.now()) => {
  const p = {}; for (const k of SCHEDULE_FIELDS) if (patch && k in patch) p[k] = patch[k];
  if (!Object.keys(p).length) return gp;
  return { ...gp, pending: { ...(gp.pending || {}), ...p, queuedAt: nowMs } };
};
// This week's review moment (the most recent reviewDow at reviewTime that is <= now) and its key.
export const lastReviewAt = (gp, nowMs = Date.now()) => {
  const d = new Date(nowMs); const back = (d.getDay() - gp.reviewDow + 7) % 7; const t = toMin(gp.reviewTime);
  let at = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, Math.floor(t / 60), t % 60).getTime();
  if (at > nowMs) at -= 7 * DAY;
  return at;
};
export const reviewKey = (gp, nowMs) => ymd(lastReviewAt(gp, nowMs));
export const reviewDue = (gp, nowMs = Date.now()) => gp.lastReview !== reviewKey(gp, nowMs);
// Accepting the review applies queued edits (and any accepted proposals) and marks this week reviewed.
export const applyReview = (gp, nowMs = Date.now(), accepted = {}) => {
  const p = { ...(gp.pending || {}) }; delete p.queuedAt;
  return { ...gp, ...p, ...accepted, pending: null, lastReview: reviewKey(gp, nowMs) };
};

// ---- 8 + 4. shift-relative day window and hard close ----
// The day containing now: starts at dayStart (local), closes closeHours later (may be after midnight for evening shifts).
export const BEFORE_HOURS = 3;
export const dayWindow = (gp, nowMs = Date.now()) => {
  const d = new Date(nowMs); const t = toMin(gp.dayStart);
  let startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(t / 60), t % 60).getTime();
  const span = (gp.closeHours || 8) * HOUR;
  // Before today's start we still belong to yesterday's day: inside its shift (crossed midnight) or in its closed
  // evening (close picker), until BEFORE_HOURS ahead of today's start, which shows "Day starts in ...".
  if (nowMs < startMs && nowMs < startMs - BEFORE_HOURS * HOUR) startMs -= DAY;
  return { startMs, closeMs: startMs + span, dayKey: ymd(startMs), dow: new Date(startMs).getDay() };
};

// ---- 2 + 3. focus block: focus 50 · (10 min slot) · focus 50 from the day start. Breaks are NOT automatic: ----
// finishing a focus session earns gp.breakMin minutes into a banked balance; the user starts a break when they choose.
// Two slots at most: focus 1 in the morning (day start), focus 2 in the afternoon (half-way to the close). sessions = 1 -> morning only.
export const segments = (gp, startMs) => {
  const span = (gp.closeHours || 8) * HOUR; const n = gp.sessions === 1 ? 1 : 2;
  return [{ kind: 'focus', n: 1, startMs, endMs: startMs + gp.focusMin * MIN }, { kind: 'focus', n: 2, startMs: startMs + span / 2, endMs: startMs + span / 2 + gp.focusMin * MIN }].slice(0, n);
};
// ---- points breaks (optional, banked, never auto-start, never lock, never cost points) ----
// Tiers by the day's points: every `breakEvery` (default 50) pts = +10 min, one cap of 30 min. The tier is a running TOTAL, not
// a new grant per crossing: at 100 pts you have earned 20 min from points in all (10 at 50 + 10 more at 100), never 10 + 20.
export const BREAK_TIERS = Object.freeze({ every: 50, minPerTier: 10, capMin: 30 });
export const pointsBreakMin = (points, every = BREAK_TIERS.every, t = BREAK_TIERS) => Math.min(t.capMin, Math.floor(Math.max(0, Number(points) || 0) / (every || t.every)) * t.minPerTier);
export const pointsTier = (points, every = BREAK_TIERS.every, t = BREAK_TIERS) => pointsBreakMin(points, every, t) / t.minPerTier;
// Home line (compact, the row already shows the points): "28 pts to 20m break" (72 pts, tier 2 next) or "30m break max" at the cap.
export const nextTierText = (points, every = BREAK_TIERS.every, t = BREAK_TIERS) => {
  const p = Math.max(0, Math.round(Number(points) || 0)); const cur = pointsBreakMin(p, every, t);
  if (cur >= t.capMin) return `${t.capMin}m break max`;
  const next = (Math.floor(p / every) + 1) * every; return `${next - p} pts to ${cur + t.minPerTier}m break`;
};
// Alert once per tier crossed: returns the highest new tier (> alerted) or 0.
export const tierToAlert = (points, alerted = 0, every = BREAK_TIERS.every, t = BREAK_TIERS) => { const n = pointsTier(points, every, t); return n > (Number(alerted) || 0) ? n : 0; };
export const tierAlertText = (n, every = BREAK_TIERS.every, t = BREAK_TIERS) => ({ title: `You hit ${n * every} points`, body: `Break time if you want it: ${Math.min(t.capMin, n * t.minPerTier)} min banked. Take it from the game plan line on Home. It never costs points.` });
// Per-day break state users/{uid}.gpBreak = { day, used (min), startMs, endMs, prior: { locked, until, label } | null, relocked }.
export const normBreak = (b, dayKey) => (b && b.day === dayKey ? { day: dayKey, used: Math.max(0, Number(b.used) || 0), startMs: Number(b.startMs) || 0, endMs: Number(b.endMs) || 0, prior: b.prior || null, relocked: b.relocked === true } : { day: dayKey, used: 0, startMs: 0, endMs: 0, prior: null, relocked: false });
export const breakActive = (b, nowMs) => !!(b && b.startMs && nowMs >= b.startMs && nowMs < b.endMs);
// Banked balance: earned (breakMin per finished focus session) minus used; never more than the time left before the hard close.
// earned = session minutes (breakMin per finished focus session) + the points tier total; balance = earned - used, capped at
// BREAK_TIERS.capMin per break and by the time left before the hard close.
export const breakBank = (gp, b, nowMs = Date.now(), points = 0) => {
  const w = dayWindow(gp, nowMs); const done = nowMs < w.startMs ? 0 : segments(gp, w.startMs).filter((s) => s.endMs <= nowMs).length;
  const earned = done * gp.breakMin + pointsBreakMin(points, gp.breakEvery); const used = b && b.day === w.dayKey ? Number(b.used) || 0 : 0;
  const toClose = Math.max(0, Math.floor((w.closeMs - nowMs) / MIN));
  return { earned, used, balance: breakActive(b, nowMs) ? 0 : Math.max(0, Math.min(earned - used, toClose)) };
};
// User taps "Take break": uses the whole balance, at most one 30-min cap (never past the hard close). prior = shield state to restore after.
export const takeBreak = (gp, b, nowMs = Date.now(), prior = null, points = 0) => {
  const w = dayWindow(gp, nowMs); const cur = normBreak(b, w.dayKey); const bank = breakBank(gp, cur, nowMs, points);
  const min = Math.min(BREAK_TIERS.capMin, bank.balance); if (min <= 0 || nowMs >= w.closeMs) return null;
  const endMs = Math.min(nowMs + min * MIN, w.closeMs);
  return { ...cur, used: cur.used + min, startMs: nowMs, endMs, prior: prior || null, relocked: false, last: { at: nowMs, min, points: Math.round(Number(points) || 0) } };
};
// Break history (users/{uid}.gpBreakLog, newest last, 60 kept): { at, min, points }.
export const addBreakLog = (log, entry, keep = 60) => [...(Array.isArray(log) ? log : []), entry].filter((e) => e && e.at > 0 && e.min > 0).slice(-keep);
export const fmtBreakLog = (log, locale) => (Array.isArray(log) ? log : []).slice().reverse().map((e) => { const d = new Date(e.at);
  return { key: String(e.at), date: d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }), time: d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }), min: e.min, points: e.points || 0 }; });
// Day recap (shutdown screen line + the day-end notification). breaksToday from the log for dayKey.
export const recapText = ({ points = 0, sessionsDone = 0, sessions = 2, breaks = 0, breakMin = 0 } = {}) =>
  `${points} pts · ${Math.min(sessionsDone, sessions)} of ${sessions} session${sessions === 1 ? '' : 's'} · ${breaks} break${breaks === 1 ? '' : 's'} (${breakMin} min)`;
export const breaksOn = (log, dayKey) => { const l = (Array.isArray(log) ? log : []).filter((e) => e && ymd(e.at) === dayKey); return { count: l.length, min: l.reduce((a, e) => a + (Number(e.min) || 0), 0) }; };
// After a break: restore exactly the shield that was up before it (if that lock is still meant to run).
export const relockPlan = (b, nowMs = Date.now()) => {
  if (!b || !b.endMs || nowMs < b.endMs || b.relocked) return null;
  const p = b.prior; return p && p.locked && Number(p.until) > nowMs ? { untilMs: Number(p.until), label: p.label || '' } : { untilMs: 0, label: '' };
};
export const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// -> { phase: 'before'|'focus'|'break'|'work'|'late'|'closed', n, endsMs, leftMin }   (break only while a user-started break runs)
// late = { startMs, endMs } of a running evening (second) session: it may run past the hard close until the next day start (wake).
// While it runs the day stays open (phase 'late'; points still count up to its end) and the next day only begins once it is over.
export const phaseAt = (gp, nowMs = Date.now(), brk = null, late = null) => {
  if (late && late.endMs > nowMs && nowMs >= late.startMs) { const lw = dayWindow(gp, late.startMs);
    if (nowMs >= lw.closeMs) { const w = { ...lw, closeMs: late.endMs };
      if (breakActive(brk, nowMs)) return { phase: 'break', n: 0, endsMs: brk.endMs, leftMin: Math.ceil((brk.endMs - nowMs) / MIN), left: fmtLeft(brk.endMs - nowMs), ...w };
      return { phase: 'late', n: 2, of: 2, endsMs: late.endMs, leftMin: Math.ceil((late.endMs - nowMs) / MIN), ...w }; } }
  const w = dayWindow(gp, nowMs);
  if (nowMs < w.startMs) return { phase: 'before', n: 0, endsMs: w.startMs, leftMin: Math.ceil((w.startMs - nowMs) / MIN), ...w };
  if (nowMs >= w.closeMs) return { phase: 'closed', n: 0, endsMs: 0, leftMin: 0, ...w };
  if (breakActive(brk, nowMs)) return { phase: 'break', n: 0, endsMs: brk.endMs, leftMin: Math.ceil((brk.endMs - nowMs) / MIN), left: fmtLeft(brk.endMs - nowMs), ...w };
  const s = segments(gp, w.startMs).find((x) => nowMs >= x.startMs && nowMs < x.endMs);
  if (s) return { phase: s.kind, n: s.n, of: gp.sessions === 1 ? 1 : 2, endsMs: s.endMs, leftMin: Math.ceil((s.endMs - nowMs) / MIN), ...w };
  return { phase: 'work', n: 0, endsMs: w.closeMs, leftMin: Math.ceil((w.closeMs - nowMs) / MIN), ...w };
};
// Notification quiet: a local notification due inside a focus session is held until that session ends (then the break).
export const quietWindows = (gp, startMs) => segments(gp, startMs).filter((s) => s.kind === 'focus').map((s) => [s.startMs, s.endMs]);
export const deferForQuiet = (atMs, windows = []) => { for (const [a, b] of windows) if (atMs >= a && atMs < b) return b; return atMs; };
let quiet = [];
export const setQuietWindows = (w) => { quiet = Array.isArray(w) ? w : []; };
export const quietDefer = (atMs) => deferForQuiet(atMs, quiet);
// Focus end: a break was EARNED (banked), not started.
export const breakNote = (n, sessions = 2, min = 10) => ({ title: n < sessions ? `Focus ${n} done: ${min} min break earned` : `Focus block done: ${min} min break earned`,
  body: `Take it whenever you want from the game plan line on Home; it opens your apps for ${min} min. Breaks never cost points.` });

// ---- 5. points: per finished task, by size, never by time ----
export const SIZE_POINTS = { s: 10, m: 20, l: 40 };
export const SIZE_LABEL = { s: 'Small', m: 'Medium', l: 'Large' };
export const sizeFromMinutes = (min) => { const m = Number(min) || 0; return m <= 0 ? 'm' : m <= 25 ? 's' : m <= 75 ? 'm' : 'l'; };
// Stored size (user-picked or AI) wins; otherwise estimated from the task's minutes (typed, AI or the title estimator).
export const sizeFromPoints = (p) => (p <= 15 ? 's' : p <= 30 ? 'm' : 'l');
// Order: picked size > typed minutes > stored minutes > stored points (legacy/AI) > title estimate.
export const sizeOf = (task = {}, estMinutes = 0) => { const t = task || {}; if (SIZE_POINTS[t.size]) return t.size;
  const m = Number(t.estimateMin) || Number(t.minutes); if (m > 0) return sizeFromMinutes(m);
  if (Number(t.points) > 0) return sizeFromPoints(Number(t.points)); return sizeFromMinutes(estMinutes); };
export const sizePoints = (task, estMinutes) => SIZE_POINTS[sizeOf(task, estMinutes)];
const sizeMode = ref(false); // reactive so cards re-score when Coach mode loads; on in Coach (strict) mode: chips + earned points use size points
export const setSizeMode = (on) => { sizeMode.value = !!on; };
export const sizeModeOn = () => sizeMode.value;
const doneAt = (t) => { const v = t && t.completedAt; if (!v) return NaN; if (typeof v === 'number') return v; if (v.seconds) return v.seconds * 1000; return Date.parse(v); };
// Earned today: completed tasks only; a task finished after the hard close earns 0 (no overtime). Breaks have no task, so cost nothing.
export const earnedPoints = (tasks = [], { closeMs = 0, estMinutes = () => 0, penalty = 0 } = {}) => {
  let pts = 0; let after = 0;
  for (const t of tasks || []) { if (!t || !t.completed) continue; const at = doneAt(t); const p = sizePoints(t, estMinutes(t));
    if (closeMs && Number.isFinite(at) && at >= closeMs) after += p; else pts += p; }
  return { points: Math.max(0, pts - (penalty || 0)), afterClose: after, gross: pts };
};
export const plannedLoad = (tasks = [], estMinutes = () => 0) => (tasks || []).filter((t) => t && t.status !== 'pending' && t.status !== 'wontdo').reduce((n, t) => n + sizePoints(t, estMinutes(t)), 0);
export const median = (xs) => { const a = (xs || []).filter((x) => Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return 0; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const GOAL_SHARE = 0.9; export const HISTORY_DAYS = 14; export const HISTORY_MIN_DAYS = 3; export const NEW_USER_SHARE = 0.8;
// Daily goal = max(minimum, min(round5(90% x median completed points of the last 14 worked days), today's planned load)).
// Fewer than 3 worked days of history -> 80% of today's planned load (the old suggestion) instead of the median term.
export const dailyGoal = ({ history = [], load = 0, min = GP_DEFAULTS.minGoal } = {}) => {
  const h = (history || []).slice(-HISTORY_DAYS).filter((x) => Number.isFinite(x));
  const base = h.length >= HISTORY_MIN_DAYS ? round5(GOAL_SHARE * median(h)) : round5(NEW_USER_SHARE * load);
  const goal = Math.max(min, load > 0 ? Math.min(base, load) : base);
  return { goal, base, load, min, from: h.length >= HISTORY_MIN_DAYS ? 'history' : 'load', days: h.length };
};
// Day log (users/{uid}.gpLog = { 'YYYY-MM-DD': { earned, goal } }) -> trailing completed points (oldest first), excluding today.
export const historyFrom = (log = {}, todayKey = '') => Object.keys(log || {}).filter((k) => k < todayKey).sort().slice(-HISTORY_DAYS).map((k) => Number(log[k] && log[k].earned) || 0);
// ---- weekly review ----
export const weekSummary = (log = {}, gp, nowMs = Date.now()) => {
  const end = lastReviewAt(gp, nowMs); const days = [];
  for (let i = 7; i >= 1; i--) { const k = ymd(end - i * DAY + HOUR); if (log && log[k]) days.push({ day: k, ...log[k] }); }
  const hit = days.filter((d) => (d.goal || 0) > 0 && (d.earned || 0) >= d.goal).length;
  const total = days.reduce((n, d) => n + (Number(d.earned) || 0), 0);
  const proposals = [];
  if (days.length >= 3 && hit >= days.length - 1 && hit >= 4) proposals.push({ id: 'raise', text: `You hit ${hit}/${days.length}. Raise the minimum goal to ${gp.minGoal + 10}?`, patch: { minGoal: gp.minGoal + 10 } });
  if (days.length >= 3 && hit <= 1 && gp.minGoal > 20) proposals.push({ id: 'lower', text: `Only ${hit}/${days.length} goals hit. Lower the minimum to ${gp.minGoal - 10} for next week?`, patch: { minGoal: gp.minGoal - 10 } });
  if (gp.pending) { const p = { ...gp.pending }; delete p.queuedAt; proposals.unshift({ id: 'queued', text: `Apply your queued change${Object.keys(p).length > 1 ? 's' : ''}: ${Object.entries(p).map(([k, v]) => `${k} ${k === 'reviewDow' ? WEEK[v] : v}`).join(', ')}`, patch: p }); }
  return { days, hit, total, avg: days.length ? Math.round(total / days.length) : 0, penalties: days.reduce((n, d) => n + (Number(d.penalty) || 0), 0), proposals };
};

// ---- 6. distraction locking ----
// Social apps stay locked until today's morning checklist (the routine checklist) is done. No checklist -> nothing to gate on.
export const checklistDone = (items = []) => (items || []).every((x) => x && x.done);
export const REVOKE_PENALTY = 25;
// Screen Time authorization: approved before, not approved now -> revoked (once per day).
export const authCheck = ({ prev = '', now = '', day = '', bookedDay = '' }) => {
  const revoked = prev === 'approved' && now !== 'approved' && now !== 'unsupported' && !!now;
  return { revoked, penalty: revoked && bookedDay !== day ? REVOKE_PENALTY : 0 };
};
export const FRICTION_SEC = 8;
export const countdown = (startMs, nowMs, sec = FRICTION_SEC) => Math.max(0, Math.ceil((startMs + sec * 1000 - nowMs) / 1000));
export const UNLOCK_MINUTES = [10, 20, 30];

// ---- 7. at close: pick what goes to tomorrow (nothing automatic, no penalty) ----
export const leftovers = (tasks = []) => (tasks || []).filter((t) => t && !t.completed && t.status !== 'wontdo' && t.status !== 'pending' && !t.templateId);
export const carryOver = (picked = [], tomorrowTasks = [], stamp = Date.now()) => {
  const have = new Set((tomorrowTasks || []).map((t) => String(t && t.title).toLowerCase()));
  const add = (picked || []).filter((t) => t && !have.has(String(t.title).toLowerCase())).map((t, i) => {
    const c = { ...t, completed: false, completedAt: null, completedFor: null, timerActive: false, timerStartedAt: null, timerEndTime: null, createdAt: `gp-carry-${stamp}-${i}`, carriedFrom: t.createdAt || null };
    delete c.id; return c; });
  return [...(tomorrowTasks || []), ...add];
};
export const nextDayName = (dayKey) => { const [y, m, d] = dayKey.split('-').map(Number); return WEEK[new Date(y, m - 1, d + 1).getDay()]; };

// Compact Home row text.
export const rowText = (ph, { earned = 0, goal = 0, bank = 0 } = {}) => {
  const pts = `${earned}/${goal} pts` + (bank > 0 && ph.phase !== 'closed' && ph.phase !== 'break' ? ` · ${bank}m break ready` : '');
  if (ph.phase === 'before') return `Day starts in ${ph.leftMin >= 60 ? `${Math.floor(ph.leftMin / 60)}h ${ph.leftMin % 60}m` : `${ph.leftMin}m`} · ${pts}`;
  if (ph.phase === 'focus') return `Focus ${ph.n}/${ph.of || 2} · ${ph.leftMin}m left · notifications held · ${pts}`;
  if (ph.phase === 'break') return `Break · ${ph.left || `${ph.leftMin}m`} left · apps open · ${pts}`;
  if (ph.phase === 'late') return `Session 2 · ${ph.leftMin >= 60 ? `${Math.floor(ph.leftMin / 60)}h ${ph.leftMin % 60}m` : `${ph.leftMin}m`} left · ${pts}`;
  if (ph.phase === 'work') return `Working · closes in ${Math.floor(ph.leftMin / 60)}h ${ph.leftMin % 60}m · ${pts}`;
  return `Closed · ${pts} · pick tomorrow's tasks`;
};
export const addHours = (hhmm, h) => { const m = (toMin(hhmm) + h * 60) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
