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
// goalAt = when today's goal was first reached (ms, 0 = not yet). Returns { want, untilMs, phase, windowMin, unlockEndMs }.
// phases: 'locked' (working toward the goal), 'earned' (unlock window running), 'relocked' (window used up),
//         'missed' (end time passed without the goal: locked until midnight), 'off' (no session / emergency unlocked / no apps).
export const strictShield = ({ running = false, dayEndMs = 0, now = Date.now(), goal = 0, earned = 0, tasksDone = 0, goalAt = 0, selectionCount = 0, enabled = true, unlockedToday = false, offDay = false, tuning = STRICT_TUNING } = {}) => {
  const midnight = endOfDay(now); const off = { want: false, untilMs: 0, phase: 'off', windowMin: 0, unlockEndMs: 0 };
  if (!enabled || selectionCount <= 0 || unlockedToday || offDay || !dayEndMs) return off;
  const met = goal > 0 && earned >= goal;
  if (!met) {
    if (now < dayEndMs) return running ? { ...off, want: true, untilMs: dayEndMs, phase: 'locked' } : off;
    return midnight - now > 60000 ? { ...off, want: true, untilMs: midnight, phase: 'missed' } : off;
  }
  const windowMin = earnedWindowMin({ earned, goal, tasksDone }, tuning);
  const start = goalAt || now; const unlockEndMs = start + windowMin * 60000;
  if (now < unlockEndMs) return { want: false, untilMs: 0, phase: 'earned', windowMin, unlockEndMs };
  return midnight - now > 60000 ? { want: true, untilMs: midnight, phase: 'relocked', windowMin, unlockEndMs } : { ...off, windowMin, unlockEndMs };
};

export const fmtMin = (m) => { const v = Math.max(0, Math.round(m)); return v >= 60 ? `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}` : `${v}m`; };
// Day-end notification text: points earned and screen time earned.
export const dayEndNote = ({ earned = 0, goal = 0, tasksDone = 0, tuning = STRICT_TUNING } = {}) => {
  const w = earnedWindowMin({ earned, goal, tasksDone }, tuning);
  return w > 0
    ? { title: `Goal hit: ${earned}/${goal} pts`, body: `You earned ${fmtMin(w)} of screen time. It ends on its own, then apps lock again.`, windowMin: w }
    : { title: `Goal missed: ${earned}/${goal} pts`, body: 'No screen time earned today. Apps stay locked until midnight. Fresh start tomorrow.', windowMin: 0 };
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
