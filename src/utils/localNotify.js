// On-device notifications for iOS (reminders + task-timer expiry). Scheduled with UNUserNotificationCenter via
// @capacitor/local-notifications, so they fire while the app is backgrounded/locked and need no server.
// Times are built from local wall-clock values (new Date(y,m,d,h,mi)) = the iPhone's own timezone.
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeIOS } from '@/utils/platform';

// Stable 31-bit positive int id from a string key (plugin ids must be Int32).
export const notifId = (key) => { let h = 0; const s = String(key); for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (Math.abs(h) % 2147483646) + 1; };
export const taskKeyOf = (t) => (t && (t.id || `${t.createdAt?.seconds ?? t.createdAt ?? ''}|${t.title || ''}`)) || '';
export const parseLocal = (date, time) => { const [y, mo, d] = String(date).split('-').map(Number); const [h, mi] = String(time).split(':').map(Number); const dt = new Date(y, mo - 1, d, h, mi, 0, 0); return isNaN(dt.getTime()) ? null : dt; };

const ensurePermission = async () => {
  let p = await LocalNotifications.checkPermissions();
  if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
};

export const scheduleLocal = async (key, { title, body, at, on }) => {
  if (!isNativeIOS() || (!at && !on)) return false;
  const when = at ? (at instanceof Date ? at : new Date(at)) : null;
  if (!on && (isNaN(when.getTime()) || when.getTime() <= Date.now())) return false;
  try {
    if (!(await ensurePermission())) return false;
    const id = notifId(key);
    await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
    await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: on ? { on, allowWhileIdle: true } : { at: when, allowWhileIdle: true } }] });
    return true;
  } catch (e) { console.warn('local notification schedule failed', e); return false; }
};
export const cancelLocal = async (key) => { if (!isNativeIOS()) return; try { await LocalNotifications.cancel({ notifications: [{ id: notifId(key) }] }); } catch (e) { /* ignore */ } };

export const reminderKey = (t) => `rem:${taskKeyOf(t)}`;
export const timerKey = (t) => `timer:${taskKeyOf(t)}`;
export const scheduleTimerDone = (t) => scheduleLocal(timerKey(t), { title: 'Timer finished', body: `Time's up: ${t.title || 'your task'}`, at: t.timerEndTime });
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
  return scheduleLocal(reminderKey(t), { title: 'Task Reminder', body, ...(on ? { on } : { at: dt }) });
};
