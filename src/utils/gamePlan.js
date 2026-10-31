import { ref } from 'vue';
// Coach-mode game plan (pure helpers; only a Vue ref for the size-mode flag, no Firestore / native imports).
// 1 fixed weekly schedule (edits queued until the weekly review)   2 focus block = 2 x 50 min, notifications held back
// 3 automatic 10 min break after each focus session (never costs points)   4 hard close = day start + 8 h, nothing earned after
// 5 points per finished task by size (S 10 / M 20 / L 40); goal = max(min, min(90% of trailing 14-day median, today's planned load))
// 6 locking: checklist gate, Screen Time revoke penalty, friend-approved early unlock, friction countdown
// 7 at close the user picks which leftovers go to tomorrow (nothing rolls over by itself, no penalty)
// 8 shift-relative: everything anchors to the user's day start (an evening shift may close after midnight)

export const GP_DEFAULTS = { dayStart: '09:00', focusMin: 50, sessions: 2, breakMin: 10, closeHours: 8, reviewDow: 0, reviewTime: '18:00', minGoal: 50, friend: null };
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
  out.minGoal = Number(g.minGoal) >= 10 ? Math.min(500, round5(Number(g.minGoal))) : GP_DEFAULTS.minGoal;
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

// ---- 2 + 3. focus block: focus 50 / break 10 / focus 50 / break 10 from the day start ----
export const segments = (gp, startMs) => {
  const out = []; let at = startMs;
  for (let i = 1; i <= gp.sessions; i++) {
    out.push({ kind: 'focus', n: i, startMs: at, endMs: at + gp.focusMin * MIN }); at += gp.focusMin * MIN;
    out.push({ kind: 'break', n: i, startMs: at, endMs: at + gp.breakMin * MIN }); at += gp.breakMin * MIN;
  }
  return out;
};
// -> { phase: 'before'|'focus'|'break'|'work'|'closed', n, endsMs, leftMin }
export const phaseAt = (gp, nowMs = Date.now()) => {
  const w = dayWindow(gp, nowMs);
  if (nowMs < w.startMs) return { phase: 'before', n: 0, endsMs: w.startMs, leftMin: Math.ceil((w.startMs - nowMs) / MIN), ...w };
  if (nowMs >= w.closeMs) return { phase: 'closed', n: 0, endsMs: 0, leftMin: 0, ...w };
  const s = segments(gp, w.startMs).find((x) => nowMs >= x.startMs && nowMs < x.endMs);
  if (s) return { phase: s.kind, n: s.n, endsMs: s.endMs, leftMin: Math.ceil((s.endMs - nowMs) / MIN), ...w };
  return { phase: 'work', n: 0, endsMs: w.closeMs, leftMin: Math.ceil((w.closeMs - nowMs) / MIN), ...w };
};
// Notification quiet: a local notification due inside a focus session is held until that session ends (then the break).
export const quietWindows = (gp, startMs) => segments(gp, startMs).filter((s) => s.kind === 'focus').map((s) => [s.startMs, s.endMs]);
export const deferForQuiet = (atMs, windows = []) => { for (const [a, b] of windows) if (atMs >= a && atMs < b) return b; return atMs; };
let quiet = [];
export const setQuietWindows = (w) => { quiet = Array.isArray(w) ? w : []; };
export const quietDefer = (atMs) => deferForQuiet(atMs, quiet);
export const breakNote = (n, sessions = 2) => (n < sessions ? { title: `Focus ${n} done: 10 min break`, body: `Stand up, water, eyes off the screen. Focus ${n + 1} starts in 10 minutes. Breaks never cost points.` }
  : { title: 'Focus block done: 10 min break', body: 'Nice work. Take 10 minutes, then keep going until close. Breaks never cost points.' });

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
// Midday pacing checkpoint (halfway to close).
export const checkpointAt = (w) => w.startMs + (w.closeMs - w.startMs) / 2;
export const pacingNote = ({ earned = 0, goal = 0 }) => {
  const half = round5(goal / 2);
  if (earned >= goal) return { title: `Midday: goal already hit (${earned}/${goal})`, body: 'Anything else today is a bonus. Close is still close.', ahead: true };
  if (earned >= half) return { title: `Midday: on pace, ${earned}/${goal} pts`, body: `${goal - earned} pts to go before close.`, ahead: true };
  return { title: `Midday: ${earned}/${goal} pts`, body: `${half - earned} pts behind pace. Pick one medium task (20) next.`, ahead: false };
};

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
export const rowText = (ph, { earned = 0, goal = 0 } = {}) => {
  const pts = `${earned}/${goal} pts`;
  if (ph.phase === 'before') return `Day starts in ${ph.leftMin >= 60 ? `${Math.floor(ph.leftMin / 60)}h ${ph.leftMin % 60}m` : `${ph.leftMin}m`} · ${pts}`;
  if (ph.phase === 'focus') return `Focus ${ph.n}/2 · ${ph.leftMin}m left · notifications held · ${pts}`;
  if (ph.phase === 'break') return `Break · ${ph.leftMin}m · free, no points lost · ${pts}`;
  if (ph.phase === 'work') return `Working · closes in ${Math.floor(ph.leftMin / 60)}h ${ph.leftMin % 60}m · ${pts}`;
  return `Closed · ${pts} · pick tomorrow's tasks`;
};
export const addHours = (hhmm, h) => { const m = (toMin(hhmm) + h * 60) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
