// Boss points target preview for the day (before the countdown): f(user's chosen hours today, the tasks' own points/minutes, the one-time level).
// Same formula the eight-hour-day function locks at start (core.dailyTarget), so the preview matches; it recomputes whenever tasks or hours change.
// The hours are ALWAYS the user's choice (DayStartPrompt / the assistant only on an explicit request); the boss only reads them.
import { dailyTarget, clampHours } from './eightHour';
import { chipValues } from './taskEstimate';

export const previewDayTarget = (tasks = [], hours, stats = {}) => {
  const rows = (tasks || []).filter((t) => t && t.title && !t.scheduledFuture).map((t) => { const c = chipValues(t); return { points: c.points, minutes: c.minutes }; });
  return dailyTarget(rows, stats || {}, clampHours(hours) * 60);
};
