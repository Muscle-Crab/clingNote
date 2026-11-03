// "8-hour day": pure, dependency-free logic shared by the Netlify function (server = source of truth) and the Vue client (display / local heuristic).
// CommonJS on purpose: required by netlify/functions/eight-hour-day.js and imported by src/utils/eightHour.js.
//
// Nothing here talks to a network or a clock: callers pass `nowMs`, which the server takes from its own clock (never the device clock).
// Nothing here needs a server AI key. The deterministic heuristic below is the complete fallback for every AI-assisted value.

// Day length is user-chosen: 3h..12h in half-hour steps, default 8h (users/{uid}.dayLengthHours is only the DEFAULT; the hours confirmed
// in the morning are frozen into the day's lock). WINDOW_MS / WINDOW_MIN are the 8h default for callers that have no hours yet.
const DAY_HOURS = Object.freeze({ min: 3, max: 12, step: 0.5, default: 8 });
const clampHours = (h) => { const n = Number(h); if (h === null || h === undefined || h === '' || !Number.isFinite(n)) return DAY_HOURS.default; return Math.min(DAY_HOURS.max, Math.max(DAY_HOURS.min, Math.round(n / DAY_HOURS.step) * DAY_HOURS.step)); };
const hoursMs = (h) => clampHours(h) * 3600000;
const hoursLabel = (h) => { const n = clampHours(h); return Number.isInteger(n) ? `${n}` : `${Math.floor(n)}.5`; }; // "8", "6.5"
const WINDOW_MS = hoursMs(DAY_HOURS.default);
const WINDOW_MIN = DAY_HOURS.default * 60;
const WARN_MINUTES = [15, 5];                    // in-app warnings before the day shuts down; the local notification goes out at 5
const MAX_TASKS_PER_DAY = 50;                   // 8-hour plan size safety max (NOT the 5/day creation limit in config/pricing.js TASK_LIMITS: repeating tasks can put more than 5 on a day, and a plan capped at 5 made the card unstartable with its + disabled)
// Locked-in task range for the hours the user chooses (replaces the old exact "Planned N" count):
//  - minimum: 1 task per 2 hours, rounded up (3h -> 2, 8h -> 4, 12h -> 6). There was no hours->tasks rule in the code; half a task per hour
//    (not 1/hour) keeps a default 8h day startable under the 5/day creation limit in src/config/pricing.js TASK_LIMITS.
//  - maximum (overload cap): MAX_TASKS_PER_DAY (50), the same plan-size safety max the server already validated. Start needs min <= count <= max.
const MIN_TASKS_PER_HOUR = 0.5;
const taskRange = (hours) => { const h = clampHours(hours); return { hours: h, min: Math.min(MAX_TASKS_PER_DAY, Math.max(1, Math.ceil(h * MIN_TASKS_PER_HOUR))), max: MAX_TASKS_PER_DAY }; };
// A user-started session: whole hours only, 5..12 (app picker + server check).
const SESSION_HOURS = Object.freeze({ min: 5, max: 12, step: 1 });
const validSessionHours = (h) => { const n = Number(h); return Number.isInteger(n) && n >= SESSION_HOURS.min && n <= SESSION_HOURS.max; };
// Session met = the points earned AFTER Start reach the session's frozen goal (the one rule for unlock, settle and debt clearing).
// Session access rule (single source, also imported by the client): a session that ends with fewer than TASKS_PER_SESSION completed
// tasks makes the next one wait SESSION_COOLDOWN_MS after it ended (a wait, not a lockout). Same count clears a debt and keeps the streak.
const TASKS_PER_SESSION = 8;
const SESSION_COOLDOWN_MS = 2 * 3600000;
const sessionDone = (lock) => { if (!lock) return 0; const s = lock.session; return Number(s && s.done != null ? s.done : lock.done) || 0; };
const cooldownUntilMs = (lock) => { if (!lock || lock.placeholder || !lock.dayKey || !Number(lock.endMs)) return 0; return sessionDone(lock) >= TASKS_PER_SESSION ? 0 : Number(lock.endMs) + SESSION_COOLDOWN_MS; };
const fmtCdClock = (ms, tz) => { try { return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz || 'UTC' }); } catch (e) { return new Date(ms).toISOString().slice(11, 16); } };
const cooldownText = (done, untilMs, tz) => `You finished ${done} of ${TASKS_PER_SESSION} tasks, so your next session opens at ${fmtCdClock(untilMs, tz)} (${SESSION_COOLDOWN_MS / 3600000}-hour wait).`;
const SESSION_HEADS_UP = `Finish at least ${TASKS_PER_SESSION} tasks this session, or your next session waits ${SESSION_COOLDOWN_MS / 3600000} hours.`;
const sessionMet = ({ earned = 0, target = 0 } = {}) => Number(target) > 0 && Number(earned) >= Number(target);
// Session points goal: the AI (or this fallback) from the number of tasks that existed BEFORE the session was created + the chosen
// hours; clamped to [GOAL_MIN, min(GOAL_MAX, the tasks' points)] in steps of 5 and frozen on the session's goal record at Start.
const GOAL_MIN = 20;
const GOAL_MAX = 600;
const goalRange = (totalPoints) => ({ lo: GOAL_MIN, hi: Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(Number(totalPoints) || 0))) });
const clampGoal = (g, totalPoints) => { const r = goalRange(totalPoints); const n = Number(g); return Number.isFinite(n) && n > 0 ? Math.min(r.hi, Math.max(r.lo, Math.round(n / 5) * 5)) : r.lo; };
const fallbackGoal = ({ tasksBefore = 0, hours = 8, totalPoints = 0 } = {}) =>
  clampGoal(Math.round((Math.max(0, Number(tasksBefore) || 0) * 5 + Math.max(0, Number(hours) || 0) * 10) / 5) * 5, totalPoints);
const LOCK_IDENTITY_SLOTS = 50;                 // Firestore rules cannot loop; they compare the first 50 slots (= task cap) of a day doc (see firestore.rules)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WAKE_PICKER_PRESELECT = '07:00';          // UI convenience ONLY (pre-selected picker value). There is no stored/default wake time: the user must pick one.
const START_MODE = 'confirm';                   // 'confirm': the window starts when the user confirms the morning prompt (end = confirm + hours). Legacy: 'wake' (anchored to the wake time), 'open'.                      // 'wake': the 8h always count from the chosen wake time, whether or not the app is open ('open' = start on first open after wake)
                                                // 'wake': the 8h are anchored to the wake time itself even when the app is opened later (stricter)
const TARGET_LEVELS = { min: 0, max: 4, start: 2, base: 0.8, step: 0.05 }; // target = total task points x (0.80 + 0.05 x level)

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round5 = (n) => Math.round(n / 5) * 5;

// ── wake time + local calendar day (computed in the user's IANA time zone, not the device offset) ──
const parseWake = (s) => {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s || '').trim());
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
};
const fmtWake = (w) => `${String(w.h).padStart(2, '0')}:${String(w.m).padStart(2, '0')}`;
const validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return typeof tz === 'string' && tz.length > 0; } catch (e) { return false; } };
const partsIn = (tz, ms) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
  const o = {}; for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: o.weekday };
};
const dayKeyIn = (tz, ms) => { const p = partsIn(tz, ms); return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };
const dayNameIn = (tz, ms) => partsIn(tz, ms).wd.slice(0, 3);
const offsetAt = (tz, ms) => { const p = partsIn(tz, ms); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; };
// epoch ms of local wall-clock `wake` on local day `dayKey` in `tz` (DST-safe: re-checks the offset at the guess)
const wakeInstant = (dayKey, wake, tz) => {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, wake.h, wake.m);
  let t = guess - offsetAt(tz, guess);
  t = guess - offsetAt(tz, t);
  return t;
};

// ── evening mode: scheduled / split lock-in blocks ──
// A day can hold up to MAX_BLOCKS_PER_DAY blocks. lock = the current/latest block (lock.index, missing = 0 for old single-lock docs);
// lock.pending = later blocks [{ dayKey, index, startMs, endMs, hours }] fixed BEFORE they start (never shortened or removed).
// Finished blocks are archived in doc.sessions keyed by sessionKey(dayKey, index).
const BLOCK_HOURS = Object.freeze({ min: 1, max: 12, step: 0.5 });
const MAX_BLOCKS_PER_DAY = 2; // morning + afternoon; no midday / third slot
const SCHEDULE_LEAD_MS = 5 * 60000;           // a block must be set at least 5 minutes before it starts
const SCHEDULE_HORIZON_MS = 18 * 3600000;     // and start within the next 18 hours
const clampBlockHours = (h) => { const n = Number(h); if (!Number.isFinite(n)) return null; return Math.min(BLOCK_HOURS.max, Math.max(BLOCK_HOURS.min, Math.round(n / BLOCK_HOURS.step) * BLOCK_HOURS.step)); };
const sessionKey = (dayKey, index) => `${dayKey}#${Number(index) || 0}`;
const blockIndex = (lock) => (lock && Number.isInteger(lock.index) ? lock.index : 0);
const pendingOf = (lock) => (lock && Array.isArray(lock.pending) ? lock.pending.filter((b) => b && Number.isFinite(b.startMs) && Number.isFinite(b.endMs)).slice().sort((a, b) => a.startMs - b.startMs) : []);
const nextPending = (lock, nowMs) => pendingOf(lock).find((b) => b.endMs > nowMs) || null;
// Next instant of wall-clock "HH:MM" in tz strictly after afterMs (today or the following day).
const nextAt = (time, tz, afterMs) => {
  const w = parseWake(time); if (!w || !validTz(tz)) return null;
  let k = dayKeyIn(tz, afterMs);
  for (let i = 0; i < 3; i++) { const t = wakeInstant(k, w, tz); if (t > afterMs) return t; k = nextDayKey(k); }
  return null;
};
const overlaps = (a, b) => a.startMs < b.endMs && b.startMs < a.endMs;
// Validate requested blocks [{time, hours}] -> { ok, blocks:[{dayKey,index,startMs,endMs,hours}] } or { ok:false, error }.
// existing: blocks already fixed ({startMs,endMs,dayKey,index}); nowMs: server clock; notBefore: earliest allowed start (e.g. the running block's end).
const planBlocks = ({ requests, tz, nowMs, existing = [], notBefore = 0 }) => {
  const list = Array.isArray(requests) ? requests : [];
  if (!list.length) return { ok: false, error: 'Pick a start time and hours.' };
  const fixed = existing.slice(); const out = [];
  const base = Math.max(nowMs + SCHEDULE_LEAD_MS - 1, notBefore - 1);
  for (const r of list) {
    const hours = clampBlockHours(r && r.hours);
    if (hours == null) return { ok: false, error: 'Pick how many hours.' };
    const startMs = nextAt(r && r.time, tz, base);
    if (startMs == null) return { ok: false, error: 'Pick a valid start time (HH:MM).' };
    if (startMs - nowMs > SCHEDULE_HORIZON_MS) return { ok: false, error: 'You can only schedule up to 18 hours ahead.' };
    const b = { startMs, endMs: startMs + hours * 3600000, hours, dayKey: dayKeyIn(tz, startMs) };
    if (fixed.some((x) => overlaps(x, b))) return { ok: false, error: 'That overlaps another lock-in block.' };
    const sameDay = fixed.filter((x) => x.dayKey === b.dayKey);
    if (sameDay.length >= MAX_BLOCKS_PER_DAY) return { ok: false, error: `At most ${MAX_BLOCKS_PER_DAY} lock-in blocks per day.` };
    b.index = sameDay.reduce((m, x) => Math.max(m, (Number(x.index) || 0) + 1), 0);
    fixed.push(b); out.push(b);
  }
  return { ok: true, blocks: out };
};

// ── sessions: start any time ──
// There is NO clock gate on starting. After a session ends (and no scheduled block is pending) a new session can start right away;
// it begins at the moment the user taps Start and runs for its chosen hours. Same-day sessions get index 1, 2, ... (sessionKey dayKey#n).
// sessions/gamePlan/wakeTime are accepted for call compatibility and ignored (no session cap, no day-start or wake-time window).
const SESSION_MIN_LEFT_MS = 30 * 60000; // legacy export (no longer used as a gate)
const sessionCloseMs = (lock) => (lock && Number.isFinite(lock.endMs) ? lock.endMs : 0);
const nextDayStartMs = () => 0; // legacy export: there is no "next day start" any more
const nextSessionState = ({ lock, sessions = 2, nowMs }) => {
  const of = Number(sessions) === 1 ? 1 : 2;
  if (!lock || lock.placeholder || !lock.dayKey) return { ok: false, reason: 'none', of, done: 0 };
  const idx = blockIndex(lock); const done = nowMs >= lock.endMs ? idx + 1 : idx;
  if (nowMs < lock.endMs) return { ok: false, reason: 'running', of, done };
  if (nextPending(lock, nowMs)) return { ok: false, reason: 'scheduled', of, done };
  const until = cooldownUntilMs(lock);
  if (until > nowMs) return { ok: false, reason: 'cooldown', of, done, untilMs: until, tasksDone: sessionDone(lock), message: cooldownText(sessionDone(lock), until, lock.tz) };
  return { ok: true, of, done };
};

// ── the session state machine (no clock gates) ──
// lock: { startMs, endMs, dayKey, index } of the most recent session (or null). Returns the phase for `nowMs`:
//   none     no plan yet (onboarding not finished / no valid timezone)
//   ready    no session is running: one can start NOW (startMs = now). Also right after a session ended, any time of day.
//   running  session in progress (everything locked)
//   gap      (evening mode) a later block is scheduled: the app stays open until it starts (nextStartMs)
// A pending block whose start has arrived reports 'ready' with scheduled: true (the server begins it at its FIXED start/end).
// 'before' and 'ended' are no longer produced (kept out on purpose: no wake-time or once-per-day gate).
const evaluatePhase = ({ tz, nowMs, lock, hours = DAY_HOURS.default }) => {
  if (lock && nowMs >= lock.startMs && nowMs < lock.endMs) return { phase: 'running', startMs: lock.startMs, endMs: lock.endMs, dayKey: lock.dayKey, index: blockIndex(lock) };
  const next = nextPending(lock, nowMs);
  if (next && nowMs >= next.startMs) return { phase: 'ready', scheduled: true, startMs: next.startMs, endMs: next.endMs, dayKey: next.dayKey, index: next.index, hours: next.hours };
  if (next) return { phase: 'gap', nextStartMs: next.startMs, nextEndMs: next.endMs, startMs: lock.startMs, endMs: lock.endMs, dayKey: lock.dayKey, index: blockIndex(lock) };
  const zone = validTz(tz) ? tz : lock && validTz(lock.tz) ? lock.tz : null;
  if (!zone) return { phase: 'none' };
  const today = dayKeyIn(zone, nowMs);
  const index = lock && lock.dayKey === today && !lock.placeholder ? blockIndex(lock) + 1 : 0;
  return { phase: 'ready', startMs: nowMs, endMs: nowMs + hoursMs(hours), dayKey: today, index, after: !!(lock && !lock.placeholder && Number.isFinite(lock.endMs) && nowMs >= lock.endMs) };
};

// After a session ends the app shows the shutdown screen until the user starts a new session (state, not clock).
// SHUT_CAP_MS only bounds how long an untouched old lock keeps reporting "shut" (so a lock from weeks ago cannot trap anyone).
const nextDayKey = (dayKey) => new Date(Date.parse(`${dayKey}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
const SHUT_CAP_MS = 14 * 24 * 3600000;
const lastEndOf = (lock) => Math.max(lock.endMs, ...pendingOf(lock).map((b) => b.endMs));
const shutUntilMs = (lock) => (!lock || !Number.isFinite(lock.endMs) ? 0 : lastEndOf(lock) + SHUT_CAP_MS);
// Which end-of-day warnings are due: [15, 5] minutes before endMs -> the largest threshold already reached (15 or 5), else 0.
const warningDue = (endMs, nowMs) => { const left = endMs - nowMs; if (!(left > 0)) return 0; for (const m of [...WARN_MINUTES].sort((a, b) => a - b)) if (left <= m * 60000) return m; return 0; };
// Shut = the latest session is over and nothing new has started or is scheduled. Starting a session replaces the lock, which ends it.
const isShut = (lock, nowMs) => {
  if (!lock || lock.placeholder || !(nowMs >= lock.endMs)) return false;
  if (nextPending(lock, nowMs)) return false;
  return nowMs < shutUntilMs(lock);
};
// What the server writes to lock.shutUntil for firestore.rules: the session end. The day doc is read-only only WHILE a session runs,
// so the user can plan the next session as soon as one ends (no rules change: rules still read startAt/endAt/shutUntil).
const rulesShutUntilMs = (lock) => (lock && Number.isFinite(lock.endMs) ? lock.endMs : 0);

// ── display helpers ──
const countdownParts = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }; };
const fmtCountdown = (ms) => { const c = countdownParts(ms); return `${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}:${String(c.s).padStart(2, '0')}`; };
const fmtClock = (ms, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms)); // "3:00 PM"
const fmtWakeLabel = (wakeStr) => { const w = parseWake(wakeStr); if (!w) return ''; return `${w.h % 12 || 12}:${String(w.m).padStart(2, '0')} ${w.h >= 12 ? 'PM' : 'AM'}`; };

// ── task estimation: deterministic heuristic (complexity x duration) ──
const EASY = /\b(call|email|e-mail|reply|text|pay|buy|order|book|water|trash|laundry|dishes|stretch|tidy|sign|send|check|remind|pick up|drop off|schedule|cancel)\b/i;
const HARD = /\b(report|plan|write|study|design|build|code|coding|present|presentation|research|analy[sz]e|exam|essay|project|tax|taxes|budget|proposal|thesis|refactor|prepare|workout|train|deep work|develop|debug|migrate|review)\b/i;
const MINUTES_BY_COMPLEXITY = [0, 10, 20, 35, 60, 90];
const complexityFromMinutes = (min) => (min <= 10 ? 1 : min <= 25 ? 2 : min <= 45 ? 3 : min <= 90 ? 4 : 5);
const complexityFromText = ({ title = '', notes = '', priority = '' }) => {
  const t = `${title} ${notes}`;
  let c = 2.5;
  if (EASY.test(t)) c -= 1;
  if (HARD.test(t)) c += 1.2;
  const words = String(title).trim().split(/\s+/).filter(Boolean).length;
  if (words >= 8) c += 0.6; else if (words <= 2) c -= 0.3;
  if (String(notes).length > 120) c += 0.4;
  if (String(priority).toLowerCase() === 'high') c += 0.5;
  return clamp(Math.round(c), 1, 5);
};
const pointsFor = (complexity, minutes) => clamp(round5(clamp(complexity, 1, 5) * (5 + clamp(minutes, 1, 600) / 6)), 5, 150);
// -> { complexity 1..5, minutes, points, source: 'heuristic' }
const estimateTask = (task = {}) => {
  const given = Math.round(Number(task.estimateMin ?? task.minutes));
  const hasMin = Number.isFinite(given) && given > 0;
  const text = complexityFromText(task);
  const complexity = hasMin ? clamp(Math.round((text + complexityFromMinutes(given)) / 2), 1, 5) : text;
  const minutes = hasMin ? clamp(given, 1, 600) : MINUTES_BY_COMPLEXITY[complexity];
  return { complexity, minutes, points: pointsFor(complexity, minutes), source: 'heuristic' };
};

// ── daily points target ──
const levelRatio = (level) => TARGET_LEVELS.base + TARGET_LEVELS.step * clamp(level, TARGET_LEVELS.min, TARGET_LEVELS.max);
// tasks: [{points, minutes}], stats: { targetLevel } -> { target, total, ratio, level, minutes, slackMin, tight }
const dailyTarget = (tasks = [], stats = {}, windowMin = WINDOW_MIN) => {
  const total = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0);
  const minutes = tasks.reduce((s, t) => s + (Number(t.minutes) || 0), 0);
  const level = clamp(Number.isFinite(stats.targetLevel) ? stats.targetLevel : TARGET_LEVELS.start, TARGET_LEVELS.min, TARGET_LEVELS.max);
  const ratio = levelRatio(level);
  // Dynamic & demanding: the boss reads the user's chosen hours (windowMin) against the planned work. Spare hours raise the bar toward
  // 100% (half of the free share is added); a plan bigger than the window is capped to what fits (never below 60%). Unknown minutes = level ratio only.
  let eff = ratio;
  if (minutes > 0) {
    eff = ratio + (1 - ratio) * clamp((windowMin - minutes) / windowMin, 0, 1) * 0.5;
    if (minutes > windowMin) eff = Math.min(eff, Math.max(0.6, windowMin / minutes));
  }
  const target = total === 0 ? 0 : clamp(round5(total * eff), 5, total);
  const slackMin = windowMin - minutes; // backlog: keep the gap between planned work and the window small
  const tightMin = Math.round(120 * windowMin / WINDOW_MIN); // 2h of an 8h day, scaled to the chosen span
  return { target, total, ratio, effRatio: eff, hours: windowMin / 60, level, minutes, slackMin, tight: slackMin <= tightMin && slackMin >= 0 };
};

// ── lock integrity (mirrors the Firestore rule in firestore.rules for the weeklyRoutines day doc while a window runs) ──
// Allowed during the window: completing tasks, timers, notes, subtasks. Never: add, remove, reorder/swap, retitle, re-point.
// While locked: tasks can be ADDED (appended) and EDITED; only deletes/reorders (slot identity = createdAt) and the server-set points are blocked.
const LOCKED_FIELDS = ['createdAt', 'points'];
const sameLocked = (a, b) => LOCKED_FIELDS.every((k) => JSON.stringify(a ? a[k] ?? null : null) === JSON.stringify(b ? b[k] ?? null : null));
const lockedChangeAllowed = (oldTasks, newTasks) => {
  const o = Array.isArray(oldTasks) ? oldTasks : []; const n = Array.isArray(newTasks) ? newTasks : [];
  if (n.length < o.length) return { ok: false, reason: 'count' }; // adds (appended) are allowed while locked; deletes are not
  for (let i = 0; i < Math.min(o.length, LOCK_IDENTITY_SLOTS); i++) if (!sameLocked(o[i], n[i])) return { ok: false, reason: 'identity', index: i };
  return { ok: true };
};

// Which stored tasks count toward the day (recurring copies whose activeFrom is still in the future are hidden today) and how far along the user is.
const countableIndexes = (tasks, dayKey) => (tasks || []).map((t, i) => i).filter((i) => tasks[i] && !(tasks[i].activeFrom && dayKey < tasks[i].activeFrom));
// Slot n of the lock belongs to the task with stable id lock.ids[n] (same key as the server's lockedEarned), so reorders / inserts after
// Start can't shift points onto another task. Locks without ids (older ones) fall back to the n-th countable task's position.
const taskKeyOf = (t) => `${(t && t.createdAt) || ''}|${(t && t.title) || ''}`;
const stableIdOf = (t) => (t && (t.id != null && t.id !== '' ? `id:${t.id}` : `k:${taskKeyOf(t)}`)) || '';
const progressOf = (lock, tasks) => {
  const list = tasks || []; const idx = countableIndexes(list, lock.dayKey); let earned = 0, done = 0;
  const byId = new Map(); if (Array.isArray(lock.ids)) idx.forEach((i) => { const k = stableIdOf(list[i]); if (k && !byId.has(k)) byId.set(k, list[i]); });
  (lock.points || []).forEach((p, n) => { if (p == null) return;
    const id = Array.isArray(lock.ids) ? lock.ids[n] : null;
    const t = id && byId.has(id) ? byId.get(id) : (idx[n] != null ? list[idx[n]] : undefined);
    if (t && t.completed) { earned += Number(p) || 0; done += 1; } });
  return { earned, done, total: idx.length };
};

// ── end-of-day settlement: streak, one-time target bump, reward, failure notice ──
const defaultStats = () => ({ streak: 0, best: 0, targetLevel: TARGET_LEVELS.start, bumped: false, daysMet: 0, daysMissed: 0, lastDay: '', lastResult: '', notice: '',
  xp: 0, coins: 0, shields: 0, missRun: 0, warning: '', badges: [], lastReward: null, lastPenalty: null, log: [] });
// Rewards & consequences (server-side only: written by the function into eightHour/{uid}, which clients cannot write).
const MAX_SHIELDS = 2; const LOG_MAX = 14;
const MILESTONES = [3, 7, 15, 30, 60, 100];
const badgeFor = (streak) => (MILESTONES.includes(streak) ? `streak-${streak}` : '');
const rewardsForDay = ({ earned, target, streak, allDone }) => {
  const over = Math.max(0, earned - target);
  return { xp: 10 + Math.round(earned / 10) + Math.round(over / 5), coins: 5 + Math.min(streak, 10), shield: !!allDone, badge: badgeFor(streak) };
};
// Escalation: the n-th miss in a row costs more coins (5, 10, 15 ... capped at 25); 3+ misses in a row keep a boss warning up until the goal is met.
const penaltyForMiss = (missRun, coins) => Math.min(coins, Math.min(25, 5 * missRun));
const SHIELD_MIN_RATIO = 0.5; // a shield only saves the streak when at least half the target was earned (no free passes for empty days)
// lock: { dayKey, earned, target }. Pure: returns the new stats (never mutates).
const settleDay = (statsIn, lock) => {
  const s = { ...defaultStats(), ...(statsIn || {}) };
  if (s.lastDay === lock.dayKey) return s; // already settled (idempotent)
  const met = lock.target > 0 && lock.earned >= lock.target;
  s.lastDay = lock.dayKey; s.lastResult = met ? 'met' : 'missed';
  s.lastReward = null; s.lastPenalty = null;
  if (met) {
    s.streak += 1; s.best = Math.max(s.best, s.streak); s.daysMet += 1; s.bumped = false; s.notice = ''; s.missRun = 0; s.warning = '';
    const r = rewardsForDay({ earned: lock.earned, target: lock.target, streak: s.streak, allDone: !!lock.allDone });
    s.xp += r.xp; s.coins += r.coins;
    if (r.shield && s.shields < MAX_SHIELDS) s.shields += 1; else r.shield = false;
    if (r.badge && !s.badges.includes(r.badge)) s.badges = [...s.badges, r.badge]; else r.badge = '';
    s.lastReward = r;
  } else {
    s.daysMissed += 1; s.missRun += 1;
    const shieldOk = s.shields > 0 && s.streak > 0 && lock.target > 0 && lock.earned >= lock.target * SHIELD_MIN_RATIO;
    const coins = penaltyForMiss(s.missRun, s.coins); s.coins -= coins;
    if (shieldOk) s.shields -= 1; else s.streak = 0;
    if (!s.bumped) { s.targetLevel = clamp(s.targetLevel + 1, TARGET_LEVELS.min, TARGET_LEVELS.max); s.bumped = true; } // ONE bump; it stays until the goal is met
    s.lastPenalty = { coins, streakLost: !shieldOk, shieldUsed: shieldOk, missRun: s.missRun };
    s.warning = s.missRun >= 3 ? `${s.missRun} missed days in a row. Hit your target tomorrow to clear this.` : '';
    s.notice = failureNotice(lock, s);
  }
  s.log = [{ dayKey: lock.dayKey, met, earned: lock.earned, target: lock.target, reward: s.lastReward, penalty: s.lastPenalty }, ...(s.log || [])].slice(0, LOG_MAX);
  return s;
};
// Failure notification text. Deterministic here; the server may swap in AI-written copy when a key is configured (REQUIRES SERVER AI, optional).
// ---- Missed-goal app lock ("debt"): a session that ends short of its points goal keeps the picked apps (Screen Time shields)
// locked after it ends. Only a LATER session that reaches its own goal unlocks them, the moment the goal is hit. No streak reset,
// no points change, ClingNote itself stays usable. Stored on eightHour/{uid}.appLockDebt (server clock), cached on the device.
// Idempotent: settling the same session twice gives the same debt; a debt is only cleared by a session started after it.
// DEBT_CAP_MS: a native shield needs an end time; an untouched debt lifts after the same 14-day safety cap as the shutdown state.
const DEBT_CAP_MS = SHUT_CAP_MS;
const normDebt = (d) => (d && typeof d.sessionKey === 'string' && d.sessionKey && Number(d.sinceMs) > 0
  ? { sessionKey: d.sessionKey, target: Number(d.target) || 0, earned: Number(d.earned) || 0, sinceMs: Number(d.sinceMs) } : null);
const debtUntilMs = (d) => { const x = normDebt(d); return x ? x.sinceMs + DEBT_CAP_MS : 0; };
// iOS rejects a DeviceActivity schedule longer than one week (intervalTooLong) and the failure used to drop the hold. Native schedules
// are therefore armed in segments of at most NATIVE_SPAN_MAX_MS (6.5 days) and re-armed in a chain until the real end (the monitor at
// each segment end, and the app on every sync). Mirrored in ios/App/Shared/LockShared.swift (ScheduleChain); >= 15 min per segment.
const NATIVE_SPAN_MAX_MS = 6.5 * 24 * 3600000; const NATIVE_SPAN_MIN_MS = 15 * 60000;
// -> { startMs, endMs, last } for the segment to arm now, or null when the real end is under a minute away.
const nativeSegment = (startMs, untilMs, nowMs) => {
  if (!(untilMs > nowMs + 60000)) return null;
  const start = Math.min(Math.max(Number(startMs) || 0, nowMs - 60000), untilMs - NATIVE_SPAN_MIN_MS);
  const endMs = Math.min(untilMs, start + NATIVE_SPAN_MAX_MS);
  return { startMs: start, endMs, last: endMs >= untilMs };
};
const debtActive = (d, nowMs) => { const x = normDebt(d); return !!x && nowMs < x.sinceMs + DEBT_CAP_MS; };
// s = { startMs, target, earned }: a session started at/after the miss that has reached its goal (target > 0) pays the debt.
const debtCleared = (d, s) => { const x = normDebt(d); return !!x && !!s && sessionMet(s) && Number(s.done) >= TASKS_PER_SESSION && Number(s.startMs) >= x.sinceMs; };
// After a session settles. s = { sessionKey, startMs, endMs, target, earned, met }. No goal (target <= 0) never creates or pays a debt.
const debtAfterSettle = (prev, s) => {
  const p = normDebt(prev);
  if (!s || !(Number(s.target) > 0)) return p;
  if (s.met) return p && !debtCleared(p, s) ? p : null; // paying an old debt also needs TASKS_PER_SESSION tasks (debtCleared)
  if (p && p.sessionKey === s.sessionKey) return p; // same session settled again: unchanged
  return { sessionKey: s.sessionKey, target: Number(s.target), earned: Number(s.earned) || 0, sinceMs: Number(s.endMs) };
};
const failureNotice = (lock, s) => `You earned ${lock.earned} of ${lock.target} points. ${s && s.lastPenalty && s.lastPenalty.shieldUsed ? 'A streak shield saved your streak. ' : ''}${s && s.lastPenalty && s.lastPenalty.coins ? `-${s.lastPenalty.coins} coins. ` : ''}Tomorrow is harder: your target goes up and stays there until you hit it.`;
const rewardFor = (streak) => (streak >= 30 ? '🏔️ Peak Performer' : streak >= 15 ? '🌲 Mature Tree' : streak >= 7 ? '🌳 Small Tree' : streak >= 3 ? '🌿 Sprouting Leaves' : streak >= 1 ? '🌱 Seed Starter' : '');

module.exports = {
  DAY_HOURS, clampHours, hoursMs, hoursLabel, WARN_MINUTES, warningDue,
  TASKS_PER_SESSION, SESSION_COOLDOWN_MS, sessionDone, cooldownUntilMs, cooldownText, SESSION_HEADS_UP,
  SESSION_HOURS, validSessionHours, sessionMet, GOAL_MIN, GOAL_MAX, goalRange, clampGoal, fallbackGoal,
  WINDOW_MS, WINDOW_MIN, MAX_TASKS_PER_DAY, MIN_TASKS_PER_HOUR, taskRange, LOCK_IDENTITY_SLOTS, WEEKDAYS, WAKE_PICKER_PRESELECT, START_MODE, TARGET_LEVELS, LOCKED_FIELDS,
  clamp, round5, parseWake, fmtWake, validTz, partsIn, dayKeyIn, dayNameIn, wakeInstant, evaluatePhase,
  countdownParts, fmtCountdown, fmtClock, fmtWakeLabel,
  complexityFromMinutes, complexityFromText, pointsFor, estimateTask, levelRatio, dailyTarget,
  lockedChangeAllowed, nextDayKey, shutUntilMs, SHUT_CAP_MS, isShut, rulesShutUntilMs,
  DEBT_CAP_MS, normDebt, debtUntilMs, debtActive, debtCleared, debtAfterSettle,
  SESSION_MIN_LEFT_MS, sessionCloseMs, nextDayStartMs, nextSessionState,
  BLOCK_HOURS, MAX_BLOCKS_PER_DAY, SCHEDULE_LEAD_MS, SCHEDULE_HORIZON_MS, clampBlockHours, sessionKey, blockIndex, pendingOf, nextPending, nextAt, planBlocks, countableIndexes, progressOf, stableIdOf, NATIVE_SPAN_MAX_MS, NATIVE_SPAN_MIN_MS, nativeSegment, defaultStats, settleDay, rewardsForDay, penaltyForMiss, badgeFor, MAX_SHIELDS, SHIELD_MIN_RATIO, failureNotice, rewardFor,
};
