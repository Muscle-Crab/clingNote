// The running focus timer and whether Focus Mode is on screen. Both survive a WebView reload
// and a cold launch. Remaining time is always the saved end minus now (a pause freezes it).
// Nothing here counts ticks. Tests: scripts/test-focus-timer-restore.mjs.

import { timerMillis } from './timerRing.js';

export const FOCUS_TIMER_KEY = 'clingnote.focusTimer.v1';
export const TIMER_OVERTIME_MS = 2 * 60 * 60 * 1000;

const ms = timerMillis;

const storeOf = (store) => store || (typeof localStorage !== 'undefined' ? localStorage : null);

export const taskKeyOf = (t) => {
  if (!t) return '|';
  const c = t.createdAt;
  const id = (c && typeof c === 'object') ? (timerMillis(c) || '') : (c == null ? '' : String(c));
  return `${id}|${t.title || ''}`;
};
// The card, Focus Mode, the ring, the widget and the Live Activity all read this.
// Remaining time is the saved end, frozen at the pause instant. It is never the 30-minute estimate.
export const readout = (t, now = Date.now()) => {
  const end = ms(t && t.timerEndTime);
  const paused = ms(t && t.timerPausedAt);
  return { end, paused, remaining: end ? Math.max(0, end - (paused || now)) : 0 };
};
export const sameTimerTask = (t, rec) => {
  if (!t || !rec) return false;
  if (rec.taskId && t.id && String(t.id) === String(rec.taskId)) return true;
  if (rec.taskKey && taskKeyOf(t) === rec.taskKey) return true;
  const tc = ms(t.createdAt);
  const rc = ms(rec.createdAt);
  return !!tc && tc === rc && (t.title || '') === (rec.title || '');
};
// Play after the timer has started only reopens Focus Mode. It does not write a new start or end,
// does not unpause, and does not turn time's up into a fresh clock. Done and End session clear it.
export const resumeSavedPlay = (task, saved, now = Date.now()) => {
  if (!task || task.completed === true || task.focusEndedEarlyAt || task.timerStoppedAt) return null;
  const fromSaved = saved && sameTimerTask(task, saved) && saved.timerEndTime ? saved : null;
  const src = fromSaved ? {
    ...task,
    timerActive: fromSaved.timerActive !== false,
    timerStartedAt: fromSaved.timerStartedAt || task.timerStartedAt,
    timerEndTime: fromSaved.timerEndTime,
    timerPausedAt: fromSaved.timerPausedAt || task.timerPausedAt || null,
    timerDurationMinutes: fromSaved.timerDurationMinutes || task.timerDurationMinutes,
  } : task;
  const end = ms(src.timerEndTime);
  const paused = ms(src.timerPausedAt);
  if (!end || (!src.timerActive && !paused)) return null;
  return {
    ...src,
    timerActive: true,
    timerStartedAt: src.timerStartedAt,
    timerEndTime: src.timerEndTime,
    timerPausedAt: src.timerPausedAt || null,
    timerDurationMinutes: src.timerDurationMinutes,
  };
};
// localStorage is wiped on some iOS cold launches. The native backup is the same record.
export const pickTimerRecord = (localRaw, backupRaw) => {
  const parse = (raw) => {
    if (!raw) return null;
    try { const r = typeof raw === 'string' ? JSON.parse(raw) : raw; return r && r.taskKey && r.timerEndTime ? r : null; } catch (e) { return null; }
  };
  return parse(localRaw) || parse(backupRaw);
};

export const readFocusTimer = (store) => {
  const ls = storeOf(store);
  if (!ls) return null;
  try {
    const r = JSON.parse(ls.getItem(FOCUS_TIMER_KEY) || 'null');
    if (!r || !r.taskKey || !r.timerEndTime) return null;
    return r;
  } catch (e) { return null; }
};

export const writeFocusTimer = (store, rec) => {
  const ls = storeOf(store);
  if (!ls || !rec || !rec.taskKey || !rec.timerEndTime) return null;
  const next = {
    taskKey: String(rec.taskKey),
    taskId: rec.taskId ? String(rec.taskId) : '',
    title: rec.title || '',
    createdAt: rec.createdAt != null ? rec.createdAt : '',
    timerStartedAt: rec.timerStartedAt || null,
    timerEndTime: rec.timerEndTime,
    timerPausedAt: rec.timerPausedAt || null,
    timerDurationMinutes: Number(rec.timerDurationMinutes) || 0,
    timerActive: rec.timerActive !== false,
    focusOpen: !!rec.focusOpen,
    savedAt: Number(rec.savedAt) || Date.now(),
  };
  try { ls.setItem(FOCUS_TIMER_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
  return next;
};

export const clearFocusTimer = (store) => {
  const ls = storeOf(store);
  try { if (ls) ls.removeItem(FOCUS_TIMER_KEY); } catch (e) { /* ignore */ }
  return null;
};

// Back / Done: the screen must not come back. A timer that is still running keeps its end time
// so the card stays correct; Done (stop: true) drops the record entirely.
export const closeFocusScreen = (store, { stop = false } = {}) => {
  if (stop) return clearFocusTimer(store);
  const rec = readFocusTimer(store);
  if (!rec) return null;
  return writeFocusTimer(store, { ...rec, focusOpen: false });
};

export const recordFromTask = (task, { focusOpen = false, savedAt = Date.now() } = {}) => {
  if (!task || !task.timerEndTime) return null;
  return {
    taskKey: taskKeyOf(task),
    taskId: task.id ? String(task.id) : '',
    title: task.title || '',
    createdAt: task.createdAt != null ? task.createdAt : '',
    timerStartedAt: task.timerStartedAt || null,
    timerEndTime: task.timerEndTime,
    timerPausedAt: task.timerPausedAt || null,
    timerDurationMinutes: Number(task.timerDurationMinutes) || 0,
    timerActive: task.timerActive !== false,
    focusOpen: !!focusOpen,
    savedAt,
  };
};

// Wall clock. A pause uses the pause instant instead of now, so time away does not count.
export const remainingMs = (rec, now = Date.now()) => {
  const end = ms(rec && rec.timerEndTime);
  if (!end) return 0;
  const paused = ms(rec && rec.timerPausedAt);
  return Math.max(0, end - (paused || now));
};

export const timerView = (rec, now = Date.now()) => {
  const left = remainingMs(rec, now);
  const paused = !!ms(rec && rec.timerPausedAt);
  return {
    remainingMs: left,
    ended: !!rec && !paused && left <= 0,
    paused,
    focusOpen: !!(rec && rec.focusOpen),
  };
};

// The screen comes back only when the user left it open. Reaching zero does not close it.
export const restoreFocusScreen = (rec) => !!(rec && rec.focusOpen && rec.taskKey && rec.timerEndTime);

export const taskFromRecord = (rec) => {
  if (!rec) return null;
  return {
    id: rec.taskId || undefined,
    title: rec.title || '',
    createdAt: rec.createdAt,
    timerActive: true,
    completed: false,
    timerStartedAt: rec.timerStartedAt,
    timerEndTime: rec.timerEndTime,
    timerPausedAt: rec.timerPausedAt || null,
    timerDurationMinutes: rec.timerDurationMinutes,
  };
};

// A day refresh must not drop the running timer or close the screen. A newer timer on the
// server (a later start) wins. A finished task stays finished.
export const mergeSavedTimer = (tasks, rec, now = Date.now()) => {
  if (!rec || !rec.timerEndTime || !rec.taskKey) return tasks || [];
  const end = ms(rec.timerEndTime);
  const paused = !!ms(rec.timerPausedAt);
  const keep = paused || rec.focusOpen || (end > 0 && now <= end + TIMER_OVERTIME_MS);
  if (!keep) return tasks || [];
  return (tasks || []).map((t) => {
    if (!sameTimerTask(t, rec)) return t;
    if (t.completed === true || t.focusEndedEarlyAt || t.timerStoppedAt) return t;
    const serverStart = ms(t.timerStartedAt);
    const savedStart = ms(rec.timerStartedAt);
    if (t.timerActive && serverStart > savedStart + 1000) return t;
    return {
      ...t,
      timerActive: true,
      timerStartedAt: rec.timerStartedAt,
      timerEndTime: rec.timerEndTime,
      timerPausedAt: rec.timerPausedAt || null,
      timerDurationMinutes: rec.timerDurationMinutes || t.timerDurationMinutes,
    };
  });
};

// Session countdown: the frozen end, not a tick counter. Same rule as the task timer.
export const sessionRemainingMs = (endMs, now = Date.now()) => {
  const end = Number(endMs) || 0;
  return end > 0 ? Math.max(0, end - now) : 0;
};
