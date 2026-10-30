// Client-side half of the 8-hour lock (the Firestore rules and the Netlify function are the real enforcement; this makes the UI and the
// data layer fail fast with a clear message instead of a rejected write).
// While the window runs for a weekday doc: no add / delete / swap / reorder / retitle / re-point of tasks, no plan or wake changes.
// Completing tasks, timers, notes and subtasks stay allowed.
import { lockedChangeAllowed, LOCKED_FIELDS, isShut, hoursLabel } from './eightHour';

export const LOCKED_MESSAGE = 'Locked: your 8-hour day is running. Tasks, points and the target cannot be changed until it ends.';

let source = () => null; // () => ({ lock: { dayName, startMs, endMs } | null, nowMs })
export const setLockSource = (fn) => { source = typeof fn === 'function' ? fn : () => null; };

// Current 8-hour lock { dayName, startMs, endMs } or null (for the widget snapshot).
export const currentLock = () => { const s = source(); return (s && s.lock) || null; };

export const isDayLocked = (dayName) => {
  const s = source();
  if (!s || !s.lock || !dayName) return false;
  return s.lock.dayName === dayName && s.nowMs >= s.lock.startMs && s.nowMs < s.lock.endMs;
};

// Hard stop: once a started 8-hour day has ended, ALL task changes (add, edit, complete, transfer, timers) are blocked until the next wake time.
export const SHUT_MESSAGE = 'Your 8 hours are up. ClingNote is shut for today. Come back tomorrow.';
// Same messages with the CURRENT day's length ("your 6.5-hour day"); the constants above are the 8h defaults.
const curHours = () => { const s = source(); return hoursLabel(s && s.lock ? s.lock.hours : undefined); };
export const lockedMessage = () => `Locked: your ${curHours()}-hour day is running. Tasks, points and the target cannot be changed until it ends.`;
export const shutMessage = () => `Your ${curHours()} hours are up. ClingNote is shut for today. Come back tomorrow.`;
export const isShutdown = () => { const s = source(); return !!(s && s.lock && isShut(s.lock, s.nowMs)); };

export class LockError extends Error {
  constructor(what) { super(what ? `${lockedMessage()} (${what})` : lockedMessage()); this.name = 'LockError'; this.code = 'eight-hour-locked'; }
}
export class ShutError extends Error {
  constructor() { super(shutMessage()); this.name = 'ShutError'; this.code = 'eight-hour-locked'; this.shut = true; }
}
export const assertNotShut = () => { if (isShutdown()) throw new ShutError(); };
export const isLockError = (e) => !!e && e.code === 'eight-hour-locked';

// Whole-day operations that always change the task list (add/delete/transfer-out/won't-do).
export const assertDayUnlocked = (dayName, what) => { assertNotShut(); if (isDayLocked(dayName)) throw new LockError(what); };
// Whole-array writes (reorder, saveSelectedDayTasks, ...): allowed only when the locked identity of every slot is unchanged.
export const assertTasksChangeAllowed = (dayName, oldTasks, newTasks, what) => {
  assertNotShut();
  if (!isDayLocked(dayName)) return;
  const r = lockedChangeAllowed(oldTasks, newTasks);
  if (!r.ok) throw new LockError(what || (r.reason === 'count' ? 'task count' : 'task order or details'));
};
// Field patches on one task: reject the fields the lock freezes.
export const patchTouchesLocked = (patch) => Object.keys(patch || {}).filter((k) => LOCKED_FIELDS.includes(k));
export const assertPatchAllowed = (dayName, patch) => { assertNotShut(); if (isDayLocked(dayName) && patchTouchesLocked(patch).length) throw new LockError(patchTouchesLocked(patch).join(', ')); };

// Completing a task on a locked day updates it in place (never removes it). True when EITHER the UI state or the lock source
// (server or device-cached lock) says the day is locked: the UI state is false while the 8-hour data is still loading.
export const completionKeepsInPlace = ({ uiLocked, sourceLocked }) => !!(uiLocked || sourceLocked);
