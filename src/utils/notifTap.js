// Native notification taps (OneSignal remote push + Capacitor local notifications) -> router navigation.
// Cold start: the tap can arrive before the router/auth are ready, so the route is queued and pushed once both are ready
// (the router guard then sends a signed-out user to /login?redirect=<route>). Warm start: pushed immediately.
import { resolveNotificationRoute } from '@/utils/notifRoute';

let router = null; let ready = false; let pending = null;
const go = () => { if (!router || !ready || !pending) return; const r = pending; pending = null; if (router.currentRoute.value.fullPath !== r) router.push(r).catch(() => {}); };
export const handleNotificationTap = (n) => { pending = resolveNotificationRoute(n); go(); return pending; };

export const installNotificationTaps = ({ router: r, authReady, oneSignal, localNotifications }) => {
  router = r;
  Promise.all([r.isReady(), authReady || Promise.resolve()]).then(() => { ready = true; go(); }).catch(() => { ready = true; go(); });
  try {
    if (oneSignal && oneSignal.Notifications && oneSignal.Notifications.addEventListener) {
      oneSignal.Notifications.addEventListener('click', (ev) => { const x = (ev && ev.notification) || {}; handleNotificationTap({ launchURL: x.launchURL, additionalData: x.additionalData, title: x.title, body: x.body }); });
    }
  } catch (e) { /* plugin missing */ }
  try {
    if (localNotifications && localNotifications.addListener) {
      localNotifications.addListener('localNotificationActionPerformed', (a) => { const x = (a && a.notification) || {}; handleNotificationTap({ extra: x.extra, title: x.title, body: x.body }); });
    }
  } catch (e) { /* plugin missing */ }
};
export const _reset = () => { router = null; ready = false; pending = null; };
