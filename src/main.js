import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import OneSignalVuePlugin from '@onesignal/onesignal-vue3'

// Initialize the Vue app
const app = createApp(App);
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/custom-sw.js')
        .then(() => console.log('Custom Service Worker Registered'))
        .catch(error => console.error('Service Worker Registration Failed:', error));
}

// Use plugins
app.use(store);
app.use(router);
app.use(OneSignalVuePlugin, {
    appId: 'fc206a71-7d65-4cfa-b8b2-0c10548e1476', // Your OneSignal App ID
    allowLocalhostAsSecureOrigin: true, // Enable for localhost testing
    notifyButton: {
        enable: true, // Show the notification permission button
    },
    autoResubscribe: true, // Automatically resubscribe returning users
});

// Mount the app
app.mount('#app');
