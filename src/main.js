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
    appId: '7562ab0c-0921-48c1-a06e-b89abc63a34e',
});

// Mount the app
app.mount('#app');
