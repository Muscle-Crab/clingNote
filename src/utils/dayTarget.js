// Boss points target preview for the day (before the countdown): f(user's chosen hours today, the tasks' own points/minutes, the one-time level).
// Same formula the eight-hour-day function locks at start (core.dailyTarget), so the preview matches; it recomputes whenever tasks or hours change.
// The hours are ALWAYS the user's choice (DayStartPrompt / the assistant only on an explicit request); the boss only reads them.
import { dailyTarget, clampHours } from './eightHour';
import { chipValues } from './taskEstimate';

// The ONE day-points label everywhere (progress card, hours picker, boss messages; Swift widget mirrors it): earned/required.
export const dayPtsLabel = (earned, required) => `${Math.max(0, Math.round(Number(earned) || 0))}/${Math.max(0, Math.round(Number(required) || 0))} pts`;
// required = the locked boss target once the day runs, else the projected one (same formula).
export const requiredPoints = ({ lock = null, tasks = [], hours, stats = {} } = {}) => (lock && Number(lock.target) > 0 ? Number(lock.target) : previewDayTarget(tasks, hours, stats).target || 0);
export const previewDayTarget = (tasks = [], hours, stats = {}) => {
  const rows = (tasks || []).filter((t) => t && t.title && !t.scheduledFuture).map((t) => { const c = chipValues(t); return { points: c.points, minutes: c.minutes }; });
  return dailyTarget(rows, stats || {}, clampHours(hours) * 60);
};
// Tasks still left for a new session. Completed history stays on the list and is not part of the new target.
// Same exclusions as a countable day task: no title, a future scheduled copy, pending, won't-do, or a removed row.
export const remainingEligible = (tasks = []) => (tasks || []).filter((t) => t && t.title && !t.completed && t.status !== 'pending' && t.status !== 'wontdo' && !t.scheduledFuture && t.removed !== true);
// New session requirement: dailyTarget (eightHourCore) on the remaining tasks only.
// total 0 -> target 0. A 0 target does not open the vault; there is nothing left to earn.
export const sessionTargetOf = (tasks = [], hours, stats = {}) => previewDayTarget(remainingEligible(tasks), hours, stats);
