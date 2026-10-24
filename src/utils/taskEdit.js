// Task editing helpers: estimate chips, live timer adjustment, lock hints and the "all repeating copies" patch.
// Pure functions (no Firestore) so scripts/test-edit-task.js can cover them.
export const ESTIMATE_CHIPS = [15, 30, 45, 60, 90];
export const TIMER_STEPS = [-5, 5, 10, 15];
const MIN_MS = 60000;
// Locked during a running 8-hour day (same list as netlify/functions/lib/eightHourCore.js LOCKED_FIELDS).
export const EDIT_LOCKED = ['title', 'estimateMin', 'points', 'complexity', 'type'];
export const LOCK_HINT = 'Locked while your 8-hour day runs';
export const isFieldLocked = (field, dayLocked) => !!dayLocked && EDIT_LOCKED.includes(field);

export const cleanEstimate = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : 0; };

export const timerRunning = (t, nowMs = Date.now()) => !!(t && t.timerActive && t.timerEndTime && new Date(t.timerEndTime).getTime() > nowMs);
export const remainingMs = (t, nowMs = Date.now()) => (t && t.timerEndTime ? Math.max(0, new Date(t.timerEndTime).getTime() - nowMs) : 0);

// Set the remaining time of a running countdown to `mins` minutes from now (min 1 minute). Returns the Firestore patch.
export const setRemainingPatch = (t, mins, nowMs = Date.now()) => {
  const m = Math.max(1, Math.round(Number(mins) || 0));
  const end = nowMs + m * MIN_MS;
  const started = t && t.timerStartedAt ? new Date(t.timerStartedAt).getTime() : nowMs;
  return { timerEndTime: new Date(end).toISOString(), timerDurationMinutes: Math.max(1, Math.round((end - started) / MIN_MS)) };
};
// +/- minutes on a running countdown; never below 1 minute left.
export const adjustTimerPatch = (t, deltaMin, nowMs = Date.now()) => {
  const leftMin = remainingMs(t, nowMs) / MIN_MS;
  return setRemainingPatch(t, Math.max(1, leftMin + Number(deltaMin || 0)), nowMs);
};
// A new estimate while the timer runs: keep the elapsed time, remaining = new estimate - elapsed (at least 1 minute).
export const estimateTimerPatch = (t, newEstimate, nowMs = Date.now()) => {
  if (!timerRunning(t, nowMs)) return {};
  const started = t.timerStartedAt ? new Date(t.timerStartedAt).getTime() : nowMs;
  const elapsedMin = Math.max(0, (nowMs - started) / MIN_MS);
  return setRemainingPatch(t, Math.max(1, cleanEstimate(newEstimate) - elapsedMin), nowMs);
};

// Fields copied to the other repeating copies when "all occurrences" is chosen (never completion/timer/progress state).
export const SERIES_FIELDS = ['title', 'estimateMin', 'notes', 'priority', 'important', 'visibility', 'anonymous', 'startTime', 'labels', 'nextAction', 'reminder'];
export const seriesPatch = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([k]) => SERIES_FIELDS.includes(k)));
// Never let an edit mark a task complete.
export const safeEditPatch = (patch) => { const { completed, completedAt, ...rest } = patch || {}; return rest; };
