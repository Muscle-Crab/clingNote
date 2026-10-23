// Client-side half of the 8-hour lock (the Firestore rules and the Netlify function are the real enforcement; this makes the UI and the
// data layer fail fast with a clear message instead of a rejected write).
// While the window runs for a weekday doc: no add / delete / swap / reorder / retitle / re-point of tasks, no plan or wake changes.
// Completing tasks, timers, notes and subtasks stay allowed.
import { lockedChangeAllowed, LOCKED_FIELDS } from './eightHour';

export const LOCKED_MESSAGE = 'Locked: your 8-hour day is running. Tasks, points and the target cannot be changed until it ends.';

let source = () => null; // () => ({ lock: { dayName, startMs, endMs } | null, nowMs })
export const setLockSource = (fn) => { source = typeof fn === 'function' ? fn : () => null; };

export const isDayLocked = (dayName) => {
  const s = source();
  if (!s || !s.lock || !dayName) return false;
  return s.lock.dayName === dayName && s.nowMs >= s.lock.startMs && s.nowMs < s.lock.endMs;
};

export class LockError extends Error {
  constructor(what) { super(what ? `${LOCKED_MESSAGE} (${what})` : LOCKED_MESSAGE); this.name = 'LockError'; this.code = 'eight-hour-locked'; }
}
export const isLockError = (e) => !!e && e.code === 'eight-hour-locked';

// Whole-day operations that always change the task list (add/delete/transfer-out/won't-do).
export const assertDayUnlocked = (dayName, what) => { if (isDayLocked(dayName)) throw new LockError(what); };
// Whole-array writes (reorder, saveSelectedDayTasks, ...): allowed only when the locked identity of every slot is unchanged.
export const assertTasksChangeAllowed = (dayName, oldTasks, newTasks, what) => {
  if (!isDayLocked(dayName)) return;
  const r = lockedChangeAllowed(oldTasks, newTasks);
  if (!r.ok) throw new LockError(what || (r.reason === 'count' ? 'task count' : 'task order or details'));
};
// Field patches on one task: reject the fields the lock freezes.
export const patchTouchesLocked = (patch) => Object.keys(patch || {}).filter((k) => LOCKED_FIELDS.includes(k));
export const assertPatchAllowed = (dayName, patch) => { if (isDayLocked(dayName) && patchTouchesLocked(patch).length) throw new LockError(patchTouchesLocked(patch).join(', ')); };
