// Focus mode auto-start + focus lock (pure, unit-tested in node: scripts/test-focus-autostart.mjs).
// Two triggers start a focus session by themselves, both through HomeView's normal startTimer() / confirmDayStart():
//   1. iOS Focus filter (ClingIntents.swift ClingFocusFilter): turning on the iPhone Focus (manually or on its iOS schedule) appends
//      {id, kind:'on'|'off', minutes?, ts} to App Group "focus.filter"; the app drains it on launch/foreground (latest event wins).
//   2. Scheduled start: when an open task's startTime (HH:MM) arrives while ClingNote is open, its timer starts by itself.
// An auto-started session is LOCKED (task.focusLock = true): the timer can't be paused, another timer can't be started and Home
// can't be left until the timer runs out, the task is completed, or the user explicitly ends focus early (confirm).
import { widgetTaskId } from './widgetSnapshot.js';

export const AUTO_FOCUS_KEY = 'cn.focus.auto';          // '1' = auto-start on (per device: the iOS Focus is per device too)
export const AUTO_FIRED_KEY = 'cn.focus.autoFired';     // [dayKey|taskId|HH:MM] already auto-started (never twice)
export const FILTER_APPLIED_KEY = 'cn.focus.filterApplied';
export const START_GRACE_MIN = 15;                      // a start time more than this in the past is not auto-started
export const FILTER_MAX_AGE_MS = 12 * 3600 * 1000;
export const DEFAULT_MINUTES = 25;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ms = (v) => { if (v == null || v === '') return 0; const n = typeof v === 'number' ? v : new Date(v).getTime(); return Number.isFinite(n) ? n : 0; };
export const toMin = (s) => { const m = HHMM.exec(String(s || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export const readAutoFocus = (store) => { try { return store.getItem(AUTO_FOCUS_KEY) === '1'; } catch (e) { return false; } };
export const writeAutoFocus = (store, on) => { try { if (on) store.setItem(AUTO_FOCUS_KEY, '1'); else store.removeItem(AUTO_FOCUS_KEY); } catch (e) { /* ignore */ } };
export const readList = (store, key) => { try { const v = JSON.parse(store.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export const writeList = (store, key, list, keep = 100) => { try { store.setItem(key, JSON.stringify((list || []).slice(-keep))); } catch (e) { /* ignore */ } };

const open = (t) => t && t.completed !== true && t.status !== 'wontdo' && t.status !== 'pending';
export const runningTask = (tasks) => (tasks || []).find((t) => t && t.timerActive && ms(t.timerEndTime) && t.completed !== true) || null;
export const taskMinutes = (t) => {
  const n = Math.round(Number(t && (t.estimateMin || t.minutes || t.timerDurationMinutes)) || 0);
  return n >= 1 && n <= 240 ? n : DEFAULT_MINUTES;
};
export const firedKey = (dayKey, t) => `${dayKey}|${widgetTaskId(t)}|${t.startTime}`;

// Scheduled trigger: the open task whose startTime has just arrived (latest one inside the grace window), or null.
// Nothing fires while any timer runs, for a task already auto-started today, or for a start time not reached yet.
export const dueAutoFocus = (tasks, { nowMin, dayKey = '', fired = [] } = {}) => {
  if (!Array.isArray(tasks) || runningTask(tasks)) return null;
  let best = null;
  tasks.forEach((t, index) => {
    if (!open(t)) return; const s = toMin(t.startTime); if (s == null) return;
    if (nowMin < s || nowMin - s > START_GRACE_MIN) return;
    if ((fired || []).includes(firedKey(dayKey, t))) return;
    if (!best || s > best.s) best = { s, index, task: t };
  });
  return best ? { index: best.index, task: best.task, minutes: taskMinutes(best.task), key: firedKey(dayKey, best.task) } : null;
};

// Focus-filter trigger: the task to focus on = earliest open task with a start time, else the first open one in list order.
export const nextFocusIndex = (tasks) => {
  let idx = -1, bestS = Infinity;
  (tasks || []).forEach((t, i) => { if (!open(t)) return; const s = toMin(t.startTime); if (s != null && s < bestS) { bestS = s; idx = i; } });
  if (idx >= 0) return idx;
  return (tasks || []).findIndex((t) => open(t));
};

// Native "focus.filter" queue -> { state: 'on'|'off'|null, minutes, ids (all to ack), applied }.
// Only the latest fresh, not yet applied event counts (Focus toggled on/off/on in the background = on).
export const reduceFilterEvents = (queue, { now = Date.now(), applied = [] } = {}) => {
  const list = (Array.isArray(queue) ? queue : []).filter((e) => e && typeof e === 'object');
  const ids = list.map((e) => String(e.id || `${e.kind}@${e.ts}`));
  const fresh = list.filter((e, i) => ['on', 'off'].includes(e.kind) && !(applied || []).includes(ids[i]) && Number(e.ts) > 0 && now - Number(e.ts) <= FILTER_MAX_AGE_MS && Number(e.ts) <= now + 60000)
    .sort((a, b) => Number(a.ts) - Number(b.ts));
  const last = fresh[fresh.length - 1];
  const m = Math.round(Number(last && last.minutes) || 0);
  return { state: last ? last.kind : null, minutes: m >= 1 && m <= 240 ? m : 0, ids, applied: [...(applied || []), ...ids].slice(-100) };
};

// The task an auto-start locks you into (still running, not done, not expired), or null.
export const lockedFocus = (tasks, now = Date.now()) => {
  const t = runningTask(tasks);
  return t && t.focusLock === true && ms(t.timerEndTime) > now ? t : null;
};
export const lockedLeftMin = (t, now = Date.now()) => Math.max(0, Math.ceil((ms(t && t.timerEndTime) - now) / 60000));
export const lockMessage = (t, now = Date.now()) => `Focus locked: “${String((t && t.title) || 'your task').slice(0, 60)}” for ${lockedLeftMin(t, now)} more min. Finish it, or end focus early from the task.`;
// Ending early: the timer stops in place (no points, task stays open); recorded so the boss can call it out.
export const endEarlyPatch = (now = Date.now()) => ({ timerActive: false, timerEndTime: null, timerPausedAt: null, focusLock: false, focusEndedEarlyAt: new Date(now).toISOString() });

// Screen Time shield for a locked focus session when no day shield applies (day shield runs to the day end, which is later anyway).
export const focusShieldEnd = ({ dayWant = false, enabled = false, selectionCount = 0, locked = null, now = Date.now() }) => {
  if (dayWant || !enabled || !(selectionCount > 0) || !locked) return 0;
  const end = ms(locked.timerEndTime); return end > now + 60000 ? end : 0;
};
