// Task editing helpers: estimate chips, timer lock, lock hints and the "all repeating copies" patch.
// Pure functions (no Firestore) so scripts/test-edit-task.js can cover them.
export const ESTIMATE_CHIPS = [15, 30, 45, 60, 90];
// Locked during a running 8-hour day (same list as netlify/functions/lib/eightHourCore.js LOCKED_FIELDS).
export const EDIT_LOCKED = ['title', 'estimateMin', 'points', 'complexity', 'type'];
export const LOCK_HINT = 'Locked while your day runs';
export const isFieldLocked = (field, dayLocked) => !!dayLocked && EDIT_LOCKED.includes(field);

export const cleanEstimate = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 60) : 0; };

export const timerRunning = (t, nowMs = Date.now()) => !!(t && t.timerActive && t.timerEndTime && new Date(t.timerEndTime).getTime() > nowMs);
// Once play was pressed (running, paused or finished) the estimate/timer can't change.
export const TIMER_LOCK_HINT = 'Timer locked once started';
export const timerStarted = (t) => !!(t && (t.timerActive || t.timerStartedAt || t.timerEndTime));
export const remainingMs = (t, nowMs = Date.now()) => (t && t.timerEndTime ? Math.max(0, new Date(t.timerEndTime).getTime() - nowMs) : 0);

// Fields copied to the other repeating copies when "all occurrences" is chosen (never completion/timer/progress state).
export const SERIES_FIELDS = ['title', 'estimateMin', 'notes', 'priority', 'important', 'visibility', 'anonymous', 'startTime', 'labels', 'nextAction', 'reminder'];
export const seriesPatch = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([k]) => SERIES_FIELDS.includes(k)));
// Never let an edit mark a task complete.
export const safeEditPatch = (patch) => { const { completed, completedAt, ...rest } = patch || {}; return rest; };
