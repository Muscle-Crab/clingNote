// Boss points target preview for the day (before the countdown): f(user's chosen hours today, the tasks' own points/minutes, the one-time level).
// Same formula the eight-hour-day function locks at start (core.dailyTarget), so the preview matches; it recomputes whenever tasks or hours change.
// The hours are ALWAYS the user's choice (DayStartPrompt / the assistant only on an explicit request); the boss only reads them.
import { dailyTarget, clampHours } from './eightHour';
import { chipValues } from './taskEstimate';

// The ONE day-points label everywhere (progress card, hours picker, boss messages; Swift widget mirrors it): earned/required.
export const dayPtsLabel = (earned, required) => `${Math.max(0, Math.round(Number(earned) || 0))}/${Math.max(0, Math.round(Number(required) || 0))} pts`;
// required = this session's frozen goal once a session exists. Before Start, only tasks still
// open are previewed. Finished tasks from an earlier session stay on the list and must not
// inflate the denominator (that was the 60/200 score on a session whose goal was 80).
export const requiredPoints = ({ lock = null, tasks = [], hours, stats = {} } = {}) => {
  const frozen = displayedSessionGoal(lock, 0);
  if (frozen > 0) return frozen;
  return sessionTargetOf(tasks, hours, stats).target || 0;
};
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
// The points goal the in-session counter and the wrap-up screen both show for one session.
// Frozen at Start on lock.target (eightHourCore.flooredGoal: at least 8 × the average points of the
// unfinished tasks). Settle copies that number onto lock.session.target. A local dailyTarget preview
// (sessionTargetOf) is a different number — it can be about half the frozen goal — and must not replace it.
// lock.target is the goal frozen at Start for THIS session. It wins over lock.session.target,
// which can be a sum of every task on the day, and over a day-level preview passed in.
// goal.points is that same frozen record. Use it only when target was not stored.
export const displayedSessionGoal = (lock, preview = 0) => {
  if (lock && !lock.placeholder) {
    if (Number(lock.target) > 0) return Math.round(Number(lock.target));
    if (lock.goal && Number(lock.goal.points) > 0) return Math.round(Number(lock.goal.points));
    if (lock.session && Number(lock.session.target) > 0) return Math.round(Number(lock.session.target));
  }
  const n = Math.round(Number(preview) || 0);
  return n > 0 ? n : 0;
};
