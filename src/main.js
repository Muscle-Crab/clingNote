import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import OneSignalVue from '@onesignal/onesignal-vue3'


const app = createApp(App);
// Initialize OneSignal Plugin
// app.use(OneSignalVue, {
//     appId: "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Your OneSignal App ID
//     allowLocalhostAsSecureOrigin: true, // Allow localhost for testing
// });
// Initialize the Vue app


// Use plugins
app.use(store);
app.use(router);

// Mount the app
app.mount('#app');
