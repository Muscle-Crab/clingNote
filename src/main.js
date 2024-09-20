import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import OneSignalVuePlugin from '@onesignal/onesignal-vue3'

// Initialize the Vue app
const app = createApp(App);

// Use plugins
app.use(store);
app.use(router);
app.use(OneSignalVuePlugin, {
    appId: 'fc206a71-7d65-4cfa-b8b2-0c10548e1476',
});

// Mount the app
app.mount('#app');
