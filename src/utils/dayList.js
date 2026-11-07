// Day-list writes: delete messages, snapshot hold, and which focus timers are still this occurrence.
// A timer is shown only while it is active or paused and its end is still ahead or inside a short overtime.
// An end from a previous day is not a running timer. Pure (tests: scripts/test-day-fixes.mjs).

export const TIMER_OVERTIME_MS = 2 * 60 * 60 * 1000;

const ms = (v) => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : new Date(v).getTime();
  return Number.isFinite(n) ? n : 0;
};

export const timerShownOnWidget = (t, nowMs = Date.now()) => {
  if (!t || t.completed === true) return false;
  const end = ms(t.timerEndTime);
  if (!end) return false;
  const paused = ms(t.timerPausedAt);
  if (!t.timerActive && !paused) return false;
  return nowMs <= end + TIMER_OVERTIME_MS;
};

export const stripTimerFields = (t) => {
  if (!t) return t;
  const next = { ...t, timerActive: false, timerStartedAt: null, timerEndTime: null, timerStoppedAt: null, timerPausedAt: null };
  if ('timerPomo' in next) next.timerPomo = null;
  return next;
};

// Drop a dead timer. A genuine running or paused timer inside the overtime window is unchanged.
export const clearExpiredTimer = (t, nowMs = Date.now()) => {
  if (!t || t.completed === true) return t;
  const end = ms(t.timerEndTime);
  const started = ms(t.timerStartedAt);
  if (!end && !started && !t.timerActive && !t.timerPausedAt) return t;
  if (timerShownOnWidget(t, nowMs)) return t;
  return stripTimerFields(t);
};

export const clearExpiredTimers = (tasks, nowMs = Date.now()) => (tasks || []).map((t) => clearExpiredTimer(t, nowMs));

export const timersChanged = (before, after) => (before || []).some((t, i) => t !== (after || [])[i]);

export const withoutTask = (tasks, same) => (tasks || []).filter((t) => !same(t));

// A removed task stays in the stored array (same length, same createdAt and points) so a ruleset that
// rejects a shorter list still accepts the edit. The title is kept. Timer flags are cleared so a stuck
// timer cannot keep focus running. Nothing here invents a name.
export const isRemovedTask = (t) => !!(t && t.removed === true);
export const visibleTasks = (tasks) => (tasks || []).filter((t) => t && !isRemovedTask(t));
export const markTaskRemoved = (tasks, same) => (tasks || []).map((t) => (
  t && same(t) ? { ...t, removed: true, timerActive: false, timerEndTime: null, timerPausedAt: null, timerStoppedAt: null, focusLock: false } : t
));
export const taskStillVisible = (tasks, same) => (tasks || []).some((t) => t && same(t) && !isRemovedTask(t));
// Older published rules allow a same-length edit that does not change createdAt or points, and reject a shorter list.
export const shorterList = (before, after) => (after || []).length < (before || []).length;
export const sameLengthKeepsIdentity = (before, after) => (before || []).length === (after || []).length && (before || []).every((t, i) => {
  const n = (after || [])[i];
  return !!n && n.createdAt === t.createdAt && n.points === t.points;
});

export const deleteFailureMessage = (e) => writeFailureMessage(e, '', 'delete');
export const writeFailureMessage = (e, title, verb = 'save') => {
  const name = title ? `“${title}”` : 'that task';
  const code = String((e && e.code) || '').replace(/^firestore\//, '');
  const msg = String((e && e.message) || '');
  if (code === 'permission-denied') return verb === 'delete'
    ? "Couldn't delete that task. This day's list rejected the change."
    : `Couldn't ${verb} ${name}. This day's list rejected the change.`;
  if (code === 'unavailable' || code === 'deadline-exceeded' || /client is offline|network|failed to fetch/i.test(msg)) return String(verb).includes('timer') ? TIMER_CONNECTION_TOAST : `Couldn't ${verb} ${name}. Check your connection and try again.`;
  if (code === 'invalid-argument' || /unsupported field value|undefined/i.test(msg)) return `Couldn't ${verb} ${name}. A field on the task can't be stored.`;
  if (code === 'not-found') return `Couldn't ${verb} ${name}. This day's list is not there yet.`;
  return `Couldn't ${verb} ${name}. ${code || 'Try again.'}`;
};
export const appendTask = (list, task, same) => ((list || []).some(same) ? (list || []) : [...(list || []), task]);
// The screenshot toast. It is only for a real offline write, never for a rules rejection or a bad field.
export const TIMER_CONNECTION_TOAST = 'Could not start the timer. Check your connection and try again.';
const TIMER_KEYS = ['timerActive', 'timerStartedAt', 'timerEndTime', 'timerDurationMinutes', 'timerPausedAt', 'focusLock', 'timerPomo'];
// Same length, same createdAt and points. Returns null when the task is not on the stored list.
export const patchTimerOnList = (list, same, patch) => {
  const src = list || [];
  const i = src.findIndex((t) => same(t));
  if (i < 0) return null;
  const prev = src[i];
  const row = { ...prev };
  TIMER_KEYS.forEach((k) => { if (patch && Object.prototype.hasOwnProperty.call(patch, k)) row[k] = patch[k]; });
  row.createdAt = prev.createdAt;
  row.points = prev.points;
  const next = src.slice();
  next[i] = row;
  return next;
};

export const dayReadFailure = (e, hadList) => {
  const code = String((e && e.code) || '');
  const msg = String((e && e.message) || '');
  const offline = code === 'unavailable' || code === 'deadline-exceeded' || /client is offline|network|failed to fetch/i.test(msg);
  if (hadList) return offline ? "Couldn't refresh this day's tasks. Showing the last list." : "Couldn't refresh this day's tasks. Showing the last list.";
  return offline ? "Couldn't load this day's tasks. Check your connection and try again." : "Couldn't load this day's tasks. Try again.";
};

// While a delete write is in flight, keep the list already on screen so a snapshot cannot put a task back or replace a different one.
export const tasksFromSnapshot = (local, server, holding) => (holding ? local : server);
