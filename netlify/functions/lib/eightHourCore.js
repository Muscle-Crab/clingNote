// "8-hour day": pure, dependency-free logic shared by the Netlify function (server = source of truth) and the Vue client (display / local heuristic).
// CommonJS on purpose: required by netlify/functions/eight-hour-day.js and imported by src/utils/eightHour.js.
//
// Nothing here talks to a network or a clock: callers pass `nowMs`, which the server takes from its own clock (never the device clock).
// Nothing here needs a server AI key. The deterministic heuristic below is the complete fallback for every AI-assisted value.

const WINDOW_MS = 8 * 60 * 60 * 1000;           // the day lasts exactly 8 hours after it starts
const WINDOW_MIN = 480;
const MAX_TASKS_PER_DAY = 50;                   // safety max (free and Pro alike; config/pricing.js TASK_LIMITS)
const LOCK_IDENTITY_SLOTS = 50;                 // Firestore rules cannot loop; they compare the first 50 slots (= task cap) of a day doc (see firestore.rules)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WAKE_PICKER_PRESELECT = '07:00';          // UI convenience ONLY (pre-selected picker value). There is no stored/default wake time: the user must pick one.
const START_MODE = 'wake';                      // 'wake': the 8h always count from the chosen wake time, whether or not the app is open ('open' = start on first open after wake)
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

// ── the 8-hour window state machine ──
// lock: { startMs, endMs, dayKey } of the most recent window (or null). Returns the phase for `nowMs`:
//   none     no wake time chosen yet (onboarding not finished)
//   before   today's wake time has not arrived: planning is still open
//   ready    wake time has arrived and the window has not begun yet (server begins it now, if there are tasks)
//   running  window in progress (everything locked)
//   ended    today's window is over (next one begins at tomorrow's wake time)
const evaluatePhase = ({ wakeTime, tz, nowMs, lock, mode = START_MODE }) => {
  if (lock && nowMs >= lock.startMs && nowMs < lock.endMs) return { phase: 'running', startMs: lock.startMs, endMs: lock.endMs, dayKey: lock.dayKey };
  const wake = parseWake(wakeTime);
  if (!wake || !validTz(tz)) return { phase: 'none' };
  const today = dayKeyIn(tz, nowMs);
  if (lock && lock.dayKey === today) return { phase: 'ended', startMs: lock.startMs, endMs: lock.endMs, dayKey: today };
  const wakeMs = wakeInstant(today, wake, tz);
  if (nowMs < wakeMs) return { phase: 'before', wakeMs, dayKey: today };
  const startMs = mode === 'wake' ? wakeMs : nowMs;
  const endMs = startMs + WINDOW_MS;
  if (endMs <= nowMs) return { phase: 'ended', startMs, endMs, dayKey: today, missed: true };
  return { phase: 'ready', wakeMs, startMs, endMs, dayKey: today };
};

// Hard stop: after a started day ends, the app stays shut until the NEXT day's wake time (from the lock's own wakeTime/tz, so it survives plan edits).
const nextDayKey = (dayKey) => new Date(Date.parse(`${dayKey}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
const shutUntilMs = (lock) => {
  if (!lock || !lock.dayKey || !Number.isFinite(lock.endMs)) return 0;
  const w = parseWake(lock.wakeTime); const tz = validTz(lock.tz) ? lock.tz : 'UTC';
  const next = w ? wakeInstant(nextDayKey(lock.dayKey), w, tz) : lock.endMs + 16 * 3600000;
  return Math.max(next, lock.endMs);
};
const isShut = (lock, nowMs) => !!lock && nowMs >= lock.endMs && nowMs < shutUntilMs(lock);

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
const dailyTarget = (tasks = [], stats = {}) => {
  const total = tasks.reduce((s, t) => s + (Number(t.points) || 0), 0);
  const minutes = tasks.reduce((s, t) => s + (Number(t.minutes) || 0), 0);
  const level = clamp(Number.isFinite(stats.targetLevel) ? stats.targetLevel : TARGET_LEVELS.start, TARGET_LEVELS.min, TARGET_LEVELS.max);
  const ratio = levelRatio(level);
  const target = total === 0 ? 0 : clamp(round5(total * ratio), 5, total);
  const slackMin = WINDOW_MIN - minutes; // backlog: keep the gap between planned work and the window small
  return { target, total, ratio, level, minutes, slackMin, tight: slackMin <= 120 && slackMin >= 0 };
};

// ── lock integrity (mirrors the Firestore rule in firestore.rules for the weeklyRoutines day doc while a window runs) ──
// Allowed during the window: completing tasks, timers, notes, subtasks. Never: add, remove, reorder/swap, retitle, re-point.
const LOCKED_FIELDS = ['title', 'createdAt', 'points', 'complexity', 'estimateMin', 'type'];
const sameLocked = (a, b) => LOCKED_FIELDS.every((k) => JSON.stringify(a ? a[k] ?? null : null) === JSON.stringify(b ? b[k] ?? null : null));
const lockedChangeAllowed = (oldTasks, newTasks) => {
  const o = Array.isArray(oldTasks) ? oldTasks : []; const n = Array.isArray(newTasks) ? newTasks : [];
  if (o.length !== n.length) return { ok: false, reason: 'count' };
  for (let i = 0; i < Math.min(o.length, LOCK_IDENTITY_SLOTS); i++) if (!sameLocked(o[i], n[i])) return { ok: false, reason: 'identity', index: i };
  return { ok: true };
};

// Which stored tasks count toward the day (recurring copies whose activeFrom is still in the future are hidden today) and how far along the user is.
const countableIndexes = (tasks, dayKey) => (tasks || []).map((t, i) => i).filter((i) => tasks[i] && !(tasks[i].activeFrom && dayKey < tasks[i].activeFrom));
const progressOf = (lock, tasks) => {
  const idx = countableIndexes(tasks, lock.dayKey); let earned = 0, done = 0;
  idx.forEach((i, n) => { if (tasks[i].completed && lock.points && lock.points[n] != null) { earned += lock.points[n]; done += 1; } });
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
const failureNotice = (lock, s) => `You earned ${lock.earned} of ${lock.target} points. ${s && s.lastPenalty && s.lastPenalty.shieldUsed ? 'A streak shield saved your streak. ' : ''}${s && s.lastPenalty && s.lastPenalty.coins ? `-${s.lastPenalty.coins} coins. ` : ''}Tomorrow is harder: your target goes up and stays there until you hit it.`;
const rewardFor = (streak) => (streak >= 30 ? '🏔️ Peak Performer' : streak >= 15 ? '🌲 Mature Tree' : streak >= 7 ? '🌳 Small Tree' : streak >= 3 ? '🌿 Sprouting Leaves' : streak >= 1 ? '🌱 Seed Starter' : '');

module.exports = {
  WINDOW_MS, WINDOW_MIN, MAX_TASKS_PER_DAY, LOCK_IDENTITY_SLOTS, WEEKDAYS, WAKE_PICKER_PRESELECT, START_MODE, TARGET_LEVELS, LOCKED_FIELDS,
  clamp, round5, parseWake, fmtWake, validTz, partsIn, dayKeyIn, dayNameIn, wakeInstant, evaluatePhase,
  countdownParts, fmtCountdown, fmtClock, fmtWakeLabel,
  complexityFromMinutes, complexityFromText, pointsFor, estimateTask, levelRatio, dailyTarget,
  lockedChangeAllowed, nextDayKey, shutUntilMs, isShut, countableIndexes, progressOf, defaultStats, settleDay, rewardsForDay, penaltyForMiss, badgeFor, MAX_SHIELDS, SHIELD_MIN_RATIO, failureNotice, rewardFor,
};
