// On-device notifications for iOS (reminders + task-timer expiry). Scheduled with UNUserNotificationCenter via
// @capacitor/local-notifications, so they fire while the app is backgrounded/locked and need no server.
// Times are built from local wall-clock values (new Date(y,m,d,h,mi)) = the iPhone's own timezone.
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeIOS } from '@/utils/platform';
import { notifSound, voiceMutedNow } from '@/utils/notifSound';

// Stable 31-bit positive int id from a string key (plugin ids must be Int32).
export const notifId = (key) => { let h = 0; const s = String(key); for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (Math.abs(h) % 2147483646) + 1; };
export const taskKeyOf = (t) => (t && (t.id || `${t.createdAt?.seconds ?? t.createdAt ?? ''}|${t.title || ''}`)) || '';
export const parseLocal = (date, time) => { const [y, mo, d] = String(date).split('-').map(Number); const [h, mi] = String(time).split(':').map(Number); const dt = new Date(y, mo - 1, d, h, mi, 0, 0); return isNaN(dt.getTime()) ? null : dt; };

const ensurePermission = async () => {
  let p = await LocalNotifications.checkPermissions();
  if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
};

// ── Web fallback: Web Notifications API + in-tab timers (fires while a ClingNote tab is open; no-op without permission/API). ──
const webTimers = new Map();
const MAX_DELAY = 2147483647; // setTimeout cap (~24.8 days)
export const nextOccurrence = (on, now = new Date()) => {
  if (!on || !Number.isFinite(on.hour)) return null;
  for (let i = 0; i <= 366; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, on.hour, on.minute || 0, 0, 0);
    if (d <= now) continue;
    if (on.weekday && d.getDay() + 1 !== on.weekday) continue;
    if (on.day && d.getDate() !== on.day) continue;
    if (on.month && d.getMonth() + 1 !== on.month) continue;
    return d;
  }
  return null;
};
const webNotifyOk = () => typeof window !== 'undefined' && 'Notification' in window;
const webPermission = async (ask) => {
  if (!webNotifyOk()) return false;
  if (ask && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { return false; } }
  return Notification.permission === 'granted';
};
const webCancel = (key) => { const h = webTimers.get(key); if (h) clearTimeout(h); webTimers.delete(key); };
const ASK_TYPES = new Set(['timer', 'reminder']); // user-initiated: may show the browser prompt; background ones need prior permission
const webSchedule = async (key, { title, body, at, on, route, type }) => {
  webCancel(key);
  const when = on ? nextOccurrence(on) : (at instanceof Date ? at : new Date(at));
  if (!when || isNaN(when.getTime()) || when.getTime() <= Date.now()) return false;
  if (!(await webPermission(ASK_TYPES.has(type || String(key).split(':')[0])))) return false;
  const delay = when.getTime() - Date.now();
  if (delay > MAX_DELAY) return false;
  webTimers.set(key, setTimeout(() => {
    webTimers.delete(key);
    try { const n = new Notification(title, { body, tag: String(key) }); n.onclick = () => { try { window.focus(); if (route && window.location.pathname !== route) window.location.assign(route); } catch (e) { /* ignore */ } n.close(); }; } catch (e) { /* ignore */ }
    if (on) webSchedule(key, { title, body, on, route, type });
  }, delay));
  return true;
};
export const _webTimerCount = () => webTimers.size; // tests

export const scheduleLocal = async (key, { title, body, at, on, route, type }) => {
  if (!at && !on) return false;
  if (!isNativeIOS()) return webSchedule(key, { title, body, at, on, route, type });
  const when = at ? (at instanceof Date ? at : new Date(at)) : null;
  if (!on && (isNaN(when.getTime()) || when.getTime() <= Date.now())) return false;
  try {
    if (!(await ensurePermission())) return false;
    const id = notifId(key);
    await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
    const sound = notifSound(type, key, { muted: voiceMutedNow() }); // robot-coach clip in the app bundle; omitted when muted -> iOS default
    await LocalNotifications.schedule({ notifications: [{ id, title, body, ...(sound ? { sound } : {}), extra: { route: route || '/home', type: type || String(key).split(':')[0] }, schedule: on ? { on, allowWhileIdle: true } : { at: when, allowWhileIdle: true } }] });
    return true;
  } catch (e) { console.warn('local notification schedule failed', e); return false; }
};
export const cancelLocal = async (key) => { if (!isNativeIOS()) { webCancel(key); return; } try { await LocalNotifications.cancel({ notifications: [{ id: notifId(key) }] }); } catch (e) { /* ignore */ } };

export const reminderKey = (t) => `rem:${taskKeyOf(t)}`;
export const timerKey = (t) => `timer:${taskKeyOf(t)}`;
export const scheduleTimerDone = (t) => scheduleLocal(timerKey(t), { title: 'Timer finished', body: `Time's up: ${t.title || 'your task'}`, at: t.timerEndTime, route: '/home', type: 'timer' });
export const cancelTaskNotifications = (t) => Promise.all([cancelLocal(timerKey(t)), cancelLocal(reminderKey(t))]);
// Task reminder from { date:'YYYY-MM-DD', time:'HH:MM', repeat } in the phone's local timezone. Returns true if scheduled.
const repeatOn = (dt, repeat) => {
  const base = { hour: dt.getHours(), minute: dt.getMinutes() };
  if (repeat === 'daily') return base;
  if (repeat === 'weekly') return { ...base, weekday: dt.getDay() + 1 };
  if (repeat === 'monthly') return { ...base, day: dt.getDate() };
  if (repeat === 'yearly') return { ...base, month: dt.getMonth() + 1, day: dt.getDate() };
  return null;
};
export const scheduleReminder = (t, reminder, body) => {
  const dt = reminder && parseLocal(reminder.date, reminder.time);
  if (!dt) return Promise.resolve(false);
  const on = repeatOn(dt, reminder.repeat);
  return scheduleLocal(reminderKey(t), { title: 'Task Reminder', body, route: '/home', type: 'reminder', ...(on ? { on } : { at: dt }) });
};
