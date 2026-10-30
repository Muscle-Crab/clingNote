// Client-side task estimate (same deterministic heuristic the eight-hour-day function uses; the server re-estimates and locks at countdown start).
// The user's typed estimateMin is only an INPUT: it is never overwritten here. The result is stored as complexity / minutes / points.
import { estimateTask } from './eightHour';
import { localEstimateMinutes, applyAiEstimate } from './aiEstimate';

const typed = (t) => { const n = Math.round(Number(t && t.estimateMin)); return Number.isFinite(n) && n > 0 ? n : 0; };
export const estimateFor = (task = {}) => {
  // No typed estimate -> the instant local estimator (title hints + dictionary) supplies the minutes; a server AI may override later.
  const auto = typed(task) ? null : localEstimateMinutes(task);
  const e = estimateTask({ title: task.title || '', notes: task.notes || '', priority: task.priority || '', estimateMin: typed(task) || auto.minutes });
  return { complexity: e.complexity, minutes: e.minutes, points: e.points, estimateSource: auto ? auto.source : 'user' };
};
// New task -> same task + { complexity, minutes, points }. estimateMin stays exactly as typed.
export const withEstimate = (task) => ({ ...task, ...estimateFor(task) });
// Display values for chips. Stored values win (incl. server-locked points); missing ones are computed (display-only backfill, never written,
// so locked-slot identity and the Firestore lock rules are untouched).
export const chipValues = (task = {}) => {
  const est = estimateFor(task);
  const minutes = typed(task) || (Number(task.minutes) > 0 ? Math.round(task.minutes) : est.minutes);
  const points = Number(task.points) > 0 ? Math.round(task.points) : est.points;
  return { minutes, points, complexity: Number(task.complexity) > 0 ? task.complexity : est.complexity, computed: !(Number(task.points) > 0) };
};
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
// Server AI answer for a task created with an automatic estimate -> patched task (minutes/complexity/points), or null when it must not change
// (typed estimate, assistant-rated points, already AI, unusable answer, or no real change).
export const withAiEstimate = (task, minutes) => {
  if (!task || task.estimateSource === 'ai' || task.estimateSource === 'user' || task.pointsSource === 'ai') return null;
  const a = applyAiEstimate(task, minutes);
  if (a === task || a.minutes === task.minutes) return null;
  const e = estimateTask({ title: a.title || '', notes: a.notes || '', priority: a.priority || '', estimateMin: a.minutes });
  return { ...a, complexity: e.complexity, minutes: e.minutes, points: e.points, estimateSource: 'ai' };
};
