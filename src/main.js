import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/ui.css'

import OneSignalVue from '@onesignal/onesignal-vue3'
import { isNative, isNativeIOS } from './utils/platform'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebaseConfig'


const app = createApp(App);

// Web push (OneSignal/FCM service workers) does not run in the iOS WKWebView shell; native APNs push replaces it there.
if (!isNative()) app.use(OneSignalVue, {
    appId: "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Your OneSignal App ID
    allowLocalhostAsSecureOrigin: true, // Allow localhost for testing
});



// Use plugins
app.use(store);
app.use(router);

// Mount the app
app.mount('#app');

// iOS: link the RevenueCat customer to the Firebase uid (app_user_id === uid) and log out on sign-out.
if (isNativeIOS()) {
  onAuthStateChanged(auth, (u) => import('./utils/iap').then((m) => m.identifyIapUser(u)).catch(() => {}));
  onAuthStateChanged(auth, (u) => import('./utils/nativePush').then((m) => m.linkNativePushUser(u ? u.uid : null)).catch(() => {}));
}
