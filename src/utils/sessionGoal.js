// ONE source of truth for the per-session goal, shared by the app (src/utils/sessionPoints.js, gamePlan.js) and the server
// (netlify/functions/lib/sessionGrace.js -> eight-hour-day). Pure: no Vue, Firestore or native imports (the server requires it via esbuild).
// Which tasks belong to a session: session 1 = the Morning section, session 2 = the rest; with 1 session, all tasks.
// Points per task: size points S 10 / M 20 / L 40 (picked size > typed minutes > stored minutes > stored points > title estimate).
// Parity is tested by scripts/test-session-parity.mjs (same fixtures through the app path and the server path).
import { sectionOf } from './taskSections.js';
import { localEstimateMinutes } from './aiEstimate.js';

export const SIZE_POINTS = { s: 10, m: 20, l: 40 };
export const SESSION1_SECTIONS = Object.freeze(['morning']);
export const sizeFromMinutes = (min) => { const m = Number(min) || 0; return m <= 0 ? 'm' : m <= 25 ? 's' : m <= 75 ? 'm' : 'l'; };
export const sizeFromPoints = (p) => (p <= 15 ? 's' : p <= 30 ? 'm' : 'l');
export const sizeOf = (task = {}, estMinutes = 0) => { const t = task || {}; if (SIZE_POINTS[t.size]) return t.size;
  const m = Number(t.estimateMin) || Number(t.minutes); if (m > 0) return sizeFromMinutes(m);
  if (Number(t.points) > 0) return sizeFromPoints(Number(t.points)); return sizeFromMinutes(estMinutes); };
export const sizePoints = (task, estMinutes) => SIZE_POINTS[sizeOf(task, estMinutes)];
// Minutes a task is worth when nothing is stored (same value the app's chips show: typed > stored > local title estimate).
export const taskMinutes = (t = {}) => { const typed = Math.round(Number(t && t.estimateMin)); if (typed > 0) return typed;
  if (Number(t && t.minutes) > 0) return Math.round(t.minutes); const e = localEstimateMinutes(t || {}); return (e && e.minutes) || 0; };
export const taskPoints = (t) => sizePoints(t, taskMinutes(t));
export const countsToward = (t) => !!t && t.status !== 'pending' && t.status !== 'wontdo';
export const sessionOfTask = (t, sessions = 2) => (sessions === 1 ? 1 : SESSION1_SECTIONS.includes(sectionOf(t)) ? 1 : 2);
export const doneAtMs = (t) => { const v = t && t.completedAt; if (!v) return NaN; if (typeof v === 'number') return v;
  if (v.seconds) return v.seconds * 1000; if (v._seconds) return v._seconds * 1000; if (typeof v.toMillis === 'function') return v.toMillis(); return Date.parse(v); };
// The session's goal: target = sum of its tasks' points; earned = points of its tasks completed before endMs (a task finished early,
// before the session or the eight-hour day started, still counts; no completedAt = counts). Only completions after the end miss.
export const sessionGoal = (tasks, { n, sessions = 2, endMs }, pointsOf = taskPoints) => {
  let target = 0; let earned = 0; let done = 0; let total = 0;
  for (const t of tasks || []) { if (!countsToward(t) || sessionOfTask(t, sessions) !== n) continue; const p = pointsOf(t); target += p; total += 1;
    if (t.completed) { const at = doneAtMs(t); if (!Number.isFinite(at) || at < endMs) { earned += p; done += 1; } } }
  return { n, target, earned, done, total, met: earned >= target };
};
