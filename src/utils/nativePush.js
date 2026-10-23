// iOS native push via the OneSignal Cordova/Capacitor plugin (already a dependency; same OneSignal app as web).
// Server side is unchanged: send-notification targets external_id === Firebase uid, which OneSignal.login(uid) sets.
// Prerequisites outside this repo: APNs auth key (.p8) uploaded in OneSignal -> iOS config; Push Notifications capability on the App ID.
import { isNativeIOS } from '@/utils/platform';
const APP_ID = 'fc206a71-7d65-4cfa-b8b2-0c10548e1476'; // same public OneSignal app id as web (not a secret)
let inited = false;
const os = () => (typeof window !== 'undefined' ? window.plugins?.OneSignal : null);

export const initNativePush = () => { if (!isNativeIOS() || inited || !os()) return false; os().initialize(APP_ID); inited = true; return true; };
export const linkNativePushUser = (uid) => { if (!initNativePush()) return; try { uid ? os().login(uid) : os().logout(); } catch (e) { console.warn('native push link failed', e); } };
// Call from a user gesture (e.g. "Enable reminders" button) — never on launch.
export const requestNativePushPermission = async () => { if (!initNativePush()) return false; try { return await os().Notifications.requestPermission(true); } catch (e) { return false; } };
