import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/ui.css'

import OneSignalVue from '@onesignal/onesignal-vue3'
import { isNative, isNativeIOS } from './utils/platform'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebaseConfig'
import { loadPrefs, loadCustomImage } from './utils/bgPrefs'
import { applyBackgroundImage } from './utils/bgImage'
import { interceptBlankLinks } from './utils/openExternal'


// Saved home/header background picture (per device); default = the original forest art.
try { const bp = loadPrefs(); applyBackgroundImage(bp.image, loadCustomImage()); } catch (e) { /* cosmetic only */ }

interceptBlankLinks(); // iOS shell: target=_blank links open in the in-app browser

const app = createApp(App);

// Web push (OneSignal/FCM service workers) does not run in the iOS WKWebView shell; native APNs push replaces it there.
if (!isNative()) app.use(OneSignalVue, {
    appId: "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Your OneSignal App ID
    allowLocalhostAsSecureOrigin: true, // Allow localhost for testing
});



// Use plugins
app.use(store);
app.use(router);

// Native shell only: if the app fails to start (blank screen), show the reason on screen instead of an empty page, so a TestFlight tester can report it.
if (isNative()) {
  const show = (title, detail) => {
    console.error('[ClingNote] ' + title + ':', detail);
    // Production: log only, never a red overlay over the UI. The on-screen box is for dev/debug builds (VUE_APP_DEBUG_OVERLAY=1).
    if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_DEBUG_OVERLAY !== '1') return;
    try {
      let box = document.getElementById('native-startup-error');
      if (!box) {
        box = document.createElement('pre');
        box.id = 'native-startup-error';
        box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:#2b0a0a;color:#ffd2d2;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;z-index:2147483647';
        document.body.appendChild(box);
      }
      box.textContent += title + ': ' + String(detail).slice(0, 600) + '\n';
    } catch (e) { /* ignore */ }
  };
  window.addEventListener('error', (e) => show('Error', e.message + (e.filename ? ' @ ' + e.filename + ':' + e.lineno : '')));
  window.addEventListener('unhandledrejection', (e) => show('Unhandled', (e.reason && (e.reason.stack || e.reason.message)) || e.reason));
  app.config.errorHandler = (err, _i, info) => show('Vue (' + info + ')', (err && (err.stack || err.message)) || err);
  router.onError((err) => show('Router', (err && (err.stack || err.message)) || err));
  setTimeout(() => { if (!router.currentRoute.value.name) show('Startup', 'first page did not load after 8s at ' + location.href); }, 8000);
}

// Mount the app
app.mount('#app');

// iOS: link the RevenueCat customer to the Firebase uid (app_user_id === uid) and log out on sign-out.
if (isNativeIOS()) {
  onAuthStateChanged(auth, (u) => import('./utils/iap').then((m) => m.identifyIapUser(u)).catch(() => {}));
  onAuthStateChanged(auth, (u) => import('./utils/nativePush').then((m) => m.linkNativePushUser(u ? u.uid : null)).catch(() => {}));
}

// Notification taps (native OneSignal push + local notifications) -> the right screen, also on cold start (queued until router + auth ready).
if (isNative()) {
  const authReady = new Promise((res) => { const off = onAuthStateChanged(auth, () => { off(); res(); }); setTimeout(res, 4000); });
  // Wake-up alarm (iOS): per-account load on auth changes + the notification buttons ('Set alarm' / 'Not today' / Snooze / Stop).
  const wakeMod = import('./composables/useWakeAlarm').then((w) => { w.installWakeAlarm({ onAuth: (cb) => onAuthStateChanged(auth, cb) }); return w; });
  Promise.all([import('./utils/notifTap'), import('@capacitor/local-notifications'), import('./utils/nativePush')]).then(([t, ln, np]) => {
    np.initNativePush();
    t.installNotificationTaps({ router, authReady, oneSignal: window.plugins?.OneSignal, localNotifications: ln.LocalNotifications, speak: (line) => import('@/composables/useVoiceover').then((v) => v.speakLive(line)).catch(() => {}), onAction: (a) => wakeMod.then((w) => w.onWakeNotificationAction(a)).catch(() => {}) });
  }).catch(() => {});
}

// Universal links / custom-scheme opens (e.g. pal QR scanned with the iPhone Camera) → in-app route.
import('@capacitor/core').then(async ({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  const { App: CapApp } = await import('@capacitor/app');
  const widget = Capacitor.getPlatform() === 'ios' ? await import('./utils/widgetSync').catch(() => null) : null;
  if (widget) { widget.installWidgetSync(); widget.installWidgetFocus(router); }
  // Cold start from a widget tap (e.g. clingnote://add): appUrlOpen can fire before this listener exists, so read the launch URL once.
  if (widget) CapApp.getLaunchUrl().then((r) => { if (r && r.url) widget.handleWidgetUrl(r.url, router); }).catch(() => {});
  CapApp.addListener('appUrlOpen', ({ url }) => {
    if (widget && widget.handleWidgetUrl(url, router)) return; // home-screen widget tap: clingnote://task/<id>
    try { const u = new URL(url); const path = (u.protocol.startsWith('http') ? '' : (u.host ? '/' + u.host : '')) + u.pathname + u.search; if (/^\/(pal|pals|m)\b/.test(path)) router.push(path); } catch (e) { /* ignore */ }
  });
}).catch(() => {});

// iOS WKWebView: block pinch (gesturestart) and double-tap zoom.
if (typeof document !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent || '')) {
  const stop = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, stop, { passive: false }));
  document.addEventListener('dblclick', stop, { passive: false });
}
