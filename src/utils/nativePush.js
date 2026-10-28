// iOS native push via the OneSignal Cordova/Capacitor plugin (already a dependency; same OneSignal app as web).
// Server side is unchanged: send-notification targets external_id === Firebase uid, which OneSignal.login(uid) sets.
// Prerequisites outside this repo: APNs auth key (.p8) uploaded in OneSignal -> iOS config; Push Notifications capability on the App ID.
import { isNativeIOS } from '@/utils/platform';
const APP_ID = 'fc206a71-7d65-4cfa-b8b2-0c10548e1476'; // same public OneSignal app id as web (not a secret)
let inited = false;
const os = () => (typeof window !== 'undefined' ? window.plugins?.OneSignal : null);

export const initNativePush = () => { if (!isNativeIOS() || !os()) return false; if (!inited) { os().initialize(APP_ID); inited = true; } return true; }; // true = plugin ready (idempotent)
export const linkNativePushUser = (uid) => { if (!initNativePush()) return; try { uid ? os().login(uid) : os().logout(); } catch (e) { console.warn('native push link failed', e); } };
// Native permission enum (OneSignal OSNotificationPermission): 0 NotDetermined, 1 Denied, 2 Authorized, 3 Provisional, 4 Ephemeral.
export const mapNativePermission = (n) => (n === 2 || n === 3 || n === 4 ? 'granted' : n === 1 ? 'denied' : 'unknown');
// -> { status: 'unsupported'|'unknown'|'denied'|'granted', optedIn: boolean }. Never prompts.
export const getNativePushState = async () => {
  if (!initNativePush()) return { status: 'unsupported', optedIn: false };
  try {
    const status = mapNativePermission(await os().Notifications.permissionNative());
    let optedIn = status === 'granted';
    if (optedIn) { try { optedIn = !!(await os().User.pushSubscription.getOptedInAsync()); } catch (e) { /* keep granted */ } }
    return { status, optedIn };
  } catch (e) { return { status: 'unknown', optedIn: false }; }
};
// Opt out of reminders on this device without touching the iOS permission (the user can opt back in from the same screen).
export const optOutNativePush = () => { if (!initNativePush()) return false; try { os().User.pushSubscription.optOut(); return true; } catch (e) { return false; } };
export const optInNativePush = () => { if (!initNativePush()) return false; try { os().User.pushSubscription.optIn(); return true; } catch (e) { return false; } };
// Call from a user gesture (e.g. "Enable reminders" button) — never on launch.
export const requestNativePushPermission = async () => { if (!initNativePush()) return false; try { return await os().Notifications.requestPermission(true); } catch (e) { return false; } };
