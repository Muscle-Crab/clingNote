// Client-side half of the 8-hour lock (the Firestore rules and the Netlify function are the real enforcement; this makes the UI and the
// data layer fail fast with a clear message instead of a rejected write).
// While the window runs, task and app management stay available (delete, move, edit, reorder).
// The Screen Time shield and the session-goal snapshot are separate and are not lifted here.
// Completing tasks, timers, notes and subtasks stay allowed. Shutdown (after the window) still blocks planning.
import { lockedChangeAllowed, LOCKED_FIELDS, isShut, hoursLabel } from './eightHour';
import { planWindowState } from './planWindow';

export const LOCKED_MESSAGE = 'Locked in: Screen Time stays on until you earn it. Tasks and your app list can still be changed.';

let source = () => null; // () => ({ lock: { dayName, startMs, endMs } | null, nowMs })
export const setLockSource = (fn) => { source = typeof fn === 'function' ? fn : () => null; };

// Current 8-hour lock { dayName, startMs, endMs } or null (for the widget snapshot).
export const currentLock = () => { const s = source(); return (s && s.lock) || null; };

export const isDayLocked = (dayName) => {
  const s = source();
  if (!s || !s.lock || !dayName) return false;
  return s.lock.dayName === dayName && s.nowMs >= s.lock.startMs && s.nowMs < s.lock.endMs;
};

// After a session ends (shutdown screen, until a new session starts): completions always work, and "Plan next session"
// opens planning (see below). There is no clock time any more: a new session can start at any time.
export const SHUT_MESSAGE = "Session done. Start a new session whenever you're ready.";
// Same messages with the CURRENT day's length ("your 6.5-hour day"); the constants above are the 8h defaults.
const curHours = () => { const s = source(); return hoursLabel(s && s.lock ? s.lock.hours : undefined); };
export const lockedMessage = () => `Locked in: your ${curHours()}-hour day is running. Screen Time stays on until you earn it. Tasks and your app list can still be changed.`;
export const shutMessage = () => SHUT_MESSAGE;
export const isShutdown = () => { const s = source(); return !!(s && s.lock && isShut(s.lock, s.nowMs)); };

export class LockError extends Error {
  constructor(what) { super(what ? `${lockedMessage()} (${what})` : lockedMessage()); this.name = 'LockError'; this.code = 'eight-hour-locked'; }
}
export class ShutError extends Error {
  constructor() { super(shutMessage()); this.name = 'ShutError'; this.code = 'eight-hour-locked'; this.shut = true; }
}
// Shutdown (after the lock-in): completing tasks ALWAYS works (any day, in place on the shut day: the server only counts the window,
// so a late completion can't raise the lock-in result). Planning (add / edit / delete / reorder) works on any day's tab: the
// shutdown is only the gap between sessions, so the user can plan the next one right away (no 8 PM window, no midnight close).
export const COMPLETION_FIELDS = ['completed', 'completedAt', 'completedFor', 'timerActive', 'timerStoppedAt', 'alarmId', 'alarmAt', 'widgetEffectsPending'];
const plan = () => { const s = source(); return planWindowState({ nowMs: s ? s.nowMs : Date.now(), shut: isShutdown(), tz: s && s.lock ? s.lock.tz : undefined }); };
export const planWindowOpen = () => isShutdown() && plan().open;
export const planTomorrowDay = () => plan().tomorrowDay;
export const shutDayName = () => (isShutdown() ? currentLock().dayName || '' : '');
// May this weekday's list be planned right now? Always: between sessions planning is open for every day.
export const canPlanDay = (dayName) => { if (!isShutdown()) return true; return !!(plan().open && dayName); };
export const completionOnlyPatch = (patch) => Object.keys(patch || {}).every((k) => COMPLETION_FIELDS.includes(k));
const strip = (t) => { const o = { ...(t || {}) }; COMPLETION_FIELDS.forEach((k) => { delete o[k]; }); return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); };
export const completionOnlyChange = (oldTasks = [], newTasks = []) => Array.isArray(oldTasks) && Array.isArray(newTasks) && oldTasks.length === newTasks.length && oldTasks.every((t, i) => strip(t) === strip(newTasks[i]));
// Planning guard: no dayName = a day-less planning action (scheduling, import): allowed only inside the window.
export const assertNotShut = (dayName) => { if (!isShutdown()) return; if (dayName ? canPlanDay(dayName) : planWindowOpen()) return; throw new ShutError(); };
export const isLockError = (e) => !!e && e.code === 'eight-hour-locked';

// Whole-day operations (add/delete/transfer/won't-do). A running lock-in does not block them. Shutdown still does.
export const assertDayUnlocked = (dayName) => { assertNotShut(dayName); };
// Whole-array writes (reorder, delete, saveSelectedDayTasks). A running lock-in allows them. Shutdown still restricts planning.
export const assertTasksChangeAllowed = (dayName, oldTasks, newTasks, what) => {
  if (isShutdown() && !canPlanDay(dayName) && !completionOnlyChange(oldTasks, newTasks)) throw new ShutError();
  if (!isDayLocked(dayName)) return;
  const r = lockedChangeAllowed(oldTasks, newTasks);
  if (!r.ok) throw new LockError(what || 'task list');
};
// Field patches on one task: reject the fields the lock freezes.
export const patchTouchesLocked = (patch) => Object.keys(patch || {}).filter((k) => LOCKED_FIELDS.includes(k));
export const assertPatchAllowed = (dayName, patch) => { if (isShutdown() && !canPlanDay(dayName) && !completionOnlyPatch(patch)) throw new ShutError(); };

// Completing a task on a locked day updates it in place (never removes it). True when EITHER the UI state or the lock source
// (server or device-cached lock) says the day is locked: the UI state is false while the 8-hour data is still loading.
export const completionKeepsInPlace = ({ uiLocked, sourceLocked, shutLocked }) => !!(uiLocked || sourceLocked || shutLocked);
