// Reconcile reminders for scheduled / recurring tasks after every change (see utils/schedNotify.js).
// iOS: one-shot local notifications, capped (iOS keeps max 64 pending). Web: the browser Notification API while the
// app is open (if permission was granted); there is no cancellable server push for web.
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeIOS } from '@/utils/platform';
import { scheduleLocal, cancelLocal } from '@/utils/localNotify';
import { planNotifications, diffPlan, SCHED_BUDGET, IOS_PENDING_LIMIT } from '@/utils/schedNotify';

const STORE = 'cn.schedNotifKeys';
const webTimers = new Map();
const readKeys = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; } };

export const syncScheduledNotifications = async ({ list, todayTasks, todayStr }) => {
  try {
    let budget = SCHED_BUDGET;
    const prev = readKeys();
    if (isNativeIOS()) {
      try { const p = await LocalNotifications.getPending(); const ours = new Set(prev); const others = (p.notifications || []).length - prev.filter((k) => ours.has(k)).length; budget = Math.max(0, Math.min(SCHED_BUDGET, IOS_PENDING_LIMIT - Math.max(0, others))); } catch (e) { /* plugin unavailable */ }
    }
    const plan = planNotifications({ list, todayTasks, todayStr, budget });
    const { cancel, schedule } = diffPlan(prev, plan);
    if (isNativeIOS()) {
      await Promise.all(cancel.map((k) => cancelLocal(k)));
      for (const n of schedule) await scheduleLocal(n.key, { route: '/home', type: n.kind || 'sched', ...n });
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      webTimers.forEach((h) => clearTimeout(h)); webTimers.clear();
      schedule.filter((n) => n.at - Date.now() < 86400000).forEach((n) => webTimers.set(n.key, setTimeout(() => { try { const w = new Notification(n.title, { body: n.body }); w.onclick = () => { try { window.focus(); } catch (e) { /* */ } if (window.location.pathname !== '/home') window.location.assign('/home'); w.close(); }; } catch (e) { /* ignore */ } }, n.at - Date.now())));
    }
    localStorage.setItem(STORE, JSON.stringify(schedule.map((n) => n.key)));
    return schedule.length;
  } catch (e) { console.warn('scheduled reminders sync failed', e); return 0; }
};
