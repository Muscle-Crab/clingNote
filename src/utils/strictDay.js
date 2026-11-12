// Strict boss mode (opt-in; 'simple' = the existing behaviour). Pure helpers, no Firestore / native calls.
// Daily flow: wake greeting + mood check -> session auto-starts at wake (not on an off day) -> picked apps lock ->
// reach the points goal by the chosen end time -> an earned unlock window, then apps relock for the rest of the day.
// Missing the goal by the end time keeps apps locked until midnight. Per-task unlocks and the emergency unlock still apply.
import { suggestPointsGoal, POINTS_GOAL_MIN } from './dailyReport.js';

export const BOSS_MODES = ['simple', 'strict'];
export const normBossMode = (m) => (m === 'strict' ? 'strict' : 'simple');
export const isStrict = (userDoc) => !!userDoc && normBossMode(userDoc.bossMode) === 'strict';
// Emergency unlock stays available unless the user turns it off in Settings (default on).
export const emergencyAllowed = (userDoc) => !(userDoc && userDoc.emergencyUnlock === false);

// Earned-window formula. Every number is a tunable in STRICT_TUNING (not a hardcoded window):
//   ratio  = min(earned / goal, ratioCap)
//   window = clamp(round5(baseMin * ratio + perTaskMin * tasksDone), minMin, maxMin)   (0 while earned < goal)
export const STRICT_TUNING = { baseMin: 30, perTaskMin: 5, ratioCap: 2, minMin: 15, maxMin: 180 };
const round5 = (n) => Math.round(n / 5) * 5;
export const earnedWindowMin = ({ earned = 0, goal = 0, tasksDone = 0 } = {}, k = STRICT_TUNING) => {
  const g = Math.max(1, Number(goal) || 0); const e = Math.max(0, Number(earned) || 0);
  if (e < g) return 0;
  const ratio = Math.min(e / g, k.ratioCap);
  return Math.min(k.maxMin, Math.max(k.minMin, round5(k.baseMin * ratio + k.perTaskMin * Math.max(0, tasksDone | 0))));
};

// Morning goal: suggested from today's task load (never below the minimum); the user may raise or lower it, but not under the minimum.
export const suggestGoal = (tasks, min = POINTS_GOAL_MIN) => suggestPointsGoal(tasks, min);
export const adjustGoal = (value, min = POINTS_GOAL_MIN) => { const n = Math.round(Number(value)); return Number.isFinite(n) && n > 0 ? Math.max(min, round5(n)) : min; };
export const goalFor = (tasks, override = null, min = POINTS_GOAL_MIN) => (override && override.day && override.value ? adjustGoal(override.value, min) : suggestGoal(tasks, min).goal);

// Off day: a planned holiday (streaks.offDates) or the "skip lock-in today" date. No auto-start then.
export const isOffDay = (dayKey, { offDates = [], skipDate = '' } = {}) => !!dayKey && ((offDates || []).includes(dayKey) || skipDate === dayKey);
// Strict mode turns on the wake-up auto-start (B44 wake lock) unless it is an off day; simple mode keeps the user's own setting.
export const wakeAutoOn = ({ mode, wakeAuto, dayKey, offDates, skipDate }) => (normBossMode(mode) === 'strict' ? !isOffDay(dayKey, { offDates, skipDate }) : !!wakeAuto);

export const endOfDay = (nowMs) => { const d = new Date(nowMs); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };

// What the shield should do in strict mode.
// goalAt = when today's goal was first reached (ms, 0 = not yet). claimedAt = when the user tapped "Start screen time" (0 = not yet):
// the earned window is never auto-started; it is banked ('ready', still locked) until the user starts it. Returns { want, untilMs, phase, windowMin, unlockEndMs }.
// phases: 'locked' (working toward the goal), 'ready' (goal met, window banked, user has not started it), 'earned' (unlock window running), 'relocked' (window used up),
//         'off' (no session / end time passed without the goal / emergency unlocked / no apps).
// A missed goal has no clock-time lock here any more (the old 'missed' end + 2 h phase is gone): the missed-goal app lock
// (appLockDebt, server + native DebtHold) keeps the picked apps locked until a later session reaches its goal.
export const strictShield = ({ running = false, dayEndMs = 0, now = Date.now(), goal = 0, earned = 0, tasksDone = 0, goalAt = 0, claimedAt = 0, selectionCount = 0, enabled = true, unlockedToday = false, offDay = false, allDone = false, tuning = STRICT_TUNING } = {}) => {
  const off = { want: false, untilMs: 0, phase: 'off', windowMin: 0, unlockEndMs: 0 };
  if (!enabled || selectionCount <= 0 || unlockedToday || offDay || !dayEndMs) return off;
  // Every task finished counts as met even when the floor goal (minGoal) or a penalty keeps the points short of it.
  const met = (goal > 0 && earned >= goal) || !!allDone;
  if (!met) {
    // Working toward the goal: locked to the end time. After it, a miss is handled by appLockDebt (no timed strict lock).
    return now < dayEndMs && running ? { ...off, want: true, untilMs: dayEndMs, phase: 'locked' } : off;
  }
  const windowMin = earnedWindowMin({ earned, goal, tasksDone }, tuning);
  // Goal met and the day's time is over: everything opens.
  if (now >= dayEndMs) return { ...off, phase: 'done', windowMin, unlockEndMs: 0 };
  // The required threshold is already crossed: open now. A Start screen time tap is not required, and the shield
  // does not stay up for the rest of the session.
  if (running && now < dayEndMs) return { want: false, untilMs: 0, phase: 'open', windowMin, unlockEndMs: 0 };
  return { ...off, windowMin };
};

// The pair the home bar shows: daily points against the required threshold (lock target).
export const dayThresholdOpen = ({ earned = 0, required = 0 } = {}) => {
  const e = Number(earned) || 0; const r = Number(required) || 0;
  return r > 0 && e >= r;
};
export const SESSION_BASE_KEY = 'cn.session.base.v1';
export const sessionId = (lock) => (!lock || !Number(lock.startMs) ? '' : `${lock.dayKey || ''}#${Number(lock.index) || 0}:${lock.startMs}`);
// Points already on the board when THIS session started. A new startMs records a new baseline and does not inherit the previous unlock.
export const noteSessionBase = (storage, lock) => {
  const row = readSessionGate(storage, lock);
  return row ? row.earned : 0;
};
// Opens only when points earned AFTER this session's baseline reach this session's own requirement.
// Points already on the board at the start do not count. A requirement of 0 (nothing left to do) does not open.
export const sessionUnlock = ({ dayEarned = 0, dayRequired = 0, earnedAtStart = 0, sessionEarned = null, sessionRequired = null } = {}) => {
  const req = Number(sessionRequired != null ? sessionRequired : dayRequired) || 0;
  const start = Math.max(0, Number(earnedAtStart) || 0);
  const day = Math.max(0, Number(dayEarned) || 0);
  const earned = sessionEarned == null ? Math.max(0, day - start) : Math.max(0, Number(sessionEarned) || 0);
  if (!(req > 0)) return false;
  return earned >= req;
};
export const readSessionGate = (storage, lock) => {
  const key = sessionId(lock);
  if (!key || !storage) return null;
  let saved = null;
  try { saved = JSON.parse(storage.getItem(SESSION_BASE_KEY) || 'null'); } catch (e) { saved = null; }
  if (!saved || saved.key !== key || !Number.isFinite(Number(saved.earned))) return null;
  return { key, earned: Math.max(0, Number(saved.earned)), target: Math.max(0, Math.round(Number(saved.target) || 0)) };
};
// Written once, at a successful new session start. A second call for the same session keeps the first baseline and target.
// A failed write returns null. Callers must not treat the day's points as this session when nothing was saved:
// that missing baseline is what opened the vault before Start had a number to subtract.
export const beginSessionGate = (storage, lock, dayEarned, target) => {
  const existing = readSessionGate(storage, lock);
  if (existing) return existing;
  const key = sessionId(lock);
  if (!key || !storage || typeof storage.setItem !== 'function') return null;
  const row = { key, earned: Math.max(0, Number(dayEarned) || 0), target: Math.max(0, Math.round(Number(target) || 0)) };
  try { storage.setItem(SESSION_BASE_KEY, JSON.stringify(row)); } catch (e) { return null; }
  return readSessionGate(storage, lock);
};
// A baseline of 0 saved before the task list arrived counts every earlier completion as this session
// and opens the vault. Raise it to the points finished before Start. Never lower a real baseline.
export const healSessionGate = (storage, lock, preStartEarned) => {
  const row = readSessionGate(storage, lock);
  const prior = Math.max(0, Math.round(Number(preStartEarned) || 0));
  if (!row || !(prior > row.earned)) return row;
  const key = sessionId(lock);
  if (!key || !storage || typeof storage.setItem !== 'function') return row;
  try { storage.setItem(SESSION_BASE_KEY, JSON.stringify({ ...row, earned: prior })); } catch (e) { return row; }
  return readSessionGate(storage, lock) || row;
};
export const sessionShieldDecision = ({ enabled = true, running = false, now = Date.now(), endMs = 0, selectionCount = 1, unlockedToday = false, ...rest } = {}) => {
  if (!enabled || selectionCount <= 0 || unlockedToday || !running || !(Number(endMs) > now)) return { want: false, phase: 'off', untilMs: 0 };
  if (sessionUnlock(rest)) return { want: false, phase: 'open', untilMs: 0 };
  return { want: true, phase: 'locked', untilMs: Number(endMs) || 0 };
};
// An unfinished morning checklist must not put the shield back once that threshold is open.
export const checklistMayRelock = (shield) => !(shield && (shield.phase === 'open' || shield.phase === 'done'));

export const fmtMin = (m) => { const v = Math.max(0, Math.round(m)); return v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v}m`; };
// Day-end notification text: points earned and screen time earned.
export const dayEndNote = ({ earned = 0, goal = 0, tasksDone = 0, tuning = STRICT_TUNING } = {}) => {
  const w = earnedWindowMin({ earned, goal, tasksDone }, tuning);
  return w > 0
    ? { title: `Goal hit: ${earned}/${goal} pts`, body: `You earned ${fmtMin(w)} of screen time. Start it from the game plan line on Home whenever you want; when it ends, apps lock again.`, windowMin: w }
    : { title: `Goal missed: ${earned}/${goal} pts`, body: "Session done. Start a new session whenever you're ready.", windowMin: 0 };
};

// Wake greeting + mood check
export const MOODS = [{ id: 'great', e: '😄', l: 'Great' }, { id: 'ok', e: '🙂', l: 'Okay' }, { id: 'low', e: '😴', l: 'Tired' }, { id: 'rough', e: '😣', l: 'Rough' }];
export const wakeGreeting = (name = '', hour = 8) => `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${name ? `, ${name}` : ''}. How are you feeling?`;
export const moodReply = (mood, goal) => ({
  great: `Love it. Let's use that energy: ${goal} points today.`,
  ok: `Steady works. ${goal} points today, one task at a time.`,
  low: `Thanks for telling me. Start with something small. ${goal} points is the goal, and you can adjust it.`,
  rough: `Sorry it's a rough one. Be kind to yourself, and get the first task done. Goal: ${goal} points, adjustable.`,
}[mood] || `Goal today: ${goal} points.`);
export const MINIMUM_GOAL = POINTS_GOAL_MIN;
