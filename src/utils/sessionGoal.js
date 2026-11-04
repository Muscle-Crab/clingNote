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
// Overtime penalty: a task completed after its set timer duration earns round(points x max(0.5, 1 - overtime/duration)).
// overSec/overDurSec are stamped on the task at completion (cleared on un-complete), so the app and server credit the same amount
// and un-completing removes exactly what was credited. No timer / finished on time -> full points.
export const OVERTIME_FLOOR = 0.5;
export const overtimeFactor = (t) => { const d = Number(t && t.overDurSec) || 0, o = Number(t && t.overSec) || 0;
  return d > 0 && o > 0 ? Math.max(OVERTIME_FLOOR, 1 - o / d) : 1; };
export const overtimePoints = (points, t) => Math.round((Number(points) || 0) * overtimeFactor(t));
export const overtimeInfo = (points, t) => { const full = Number(points) || 0, earned = overtimePoints(full, t);
  return { full, earned, lost: full - earned, overMin: Math.round((Number(t && t.overSec) || 0) / 60), durMin: Math.round((Number(t && t.overDurSec) || 0) / 60) }; };
// Stamp at completion: d = set duration ms, over = ms past it (timerRing durationMs/overtimeMs). Nothing stamped without a timer.
export const overtimeStamp = (dMs, overMs) => (Number(dMs) > 0 ? { overDurSec: Math.round(dMs / 1000), overSec: Math.max(0, Math.round((Number(overMs) || 0) / 1000)) } : { overDurSec: null, overSec: null });
export const overtimeText = (i) => `Overtime penalty: \u2212${i.lost} pts. You went ${i.overMin} min over the ${i.durMin} min timer, so you earned ${i.earned} of ${i.full}.`;
export const countsToward = (t) => !!t && t.status !== 'pending' && t.status !== 'wontdo';
export const sessionOfTask = (t, sessions = 2) => (sessions === 1 ? 1 : SESSION1_SECTIONS.includes(sectionOf(t)) ? 1 : 2);
export const doneAtMs = (t) => { const v = t && t.completedAt; if (!v) return NaN; if (typeof v === 'number') return v;
  if (v.seconds) return v.seconds * 1000; if (v._seconds) return v._seconds * 1000; if (typeof v.toMillis === 'function') return v.toMillis(); return Date.parse(v); };
// The session's goal: target = sum of its tasks' points; earned = points of its tasks completed inside the session,
// startMs <= completedAt < endMs (startMs = the eight-hour session's own start, so a task finished in an EARLIER session of the day
// does not pre-satisfy a new one; no startMs = no lower bound; no completedAt = counts).
// goal (> 0) = the session's frozen points goal (lock.target, set at Start): the session then counts every countable task completed
// inside [startMs, endMs) (points earned after Start), not the Coach section split. met = earned >= goal (core.sessionMet).
export const sessionGoal = (tasks, { n, sessions = 2, startMs = 0, endMs, goal = 0 } = {}, pointsOf = taskPoints) => {
  const from = Number(startMs) > 0 ? Number(startMs) : -Infinity; const frozen = Number(goal) > 0;
  let target = 0; let earned = 0; let done = 0; let total = 0;
  for (const t of tasks || []) { if (!countsToward(t) || (!frozen && sessionOfTask(t, sessions) !== n)) continue; const p = pointsOf(t); target += p; total += 1;
    if (t.completed) { const at = doneAtMs(t); if (!Number.isFinite(at) || (at >= from && at < endMs)) { earned += overtimePoints(p, t); done += 1; } } }
  if (frozen) target = Number(goal);
  return { n, target, earned, done, total, met: target > 0 && earned >= target /* = core.sessionMet (copied into tests' temp dirs: no core import) */ };
};
