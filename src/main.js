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
    appId: '65d866ad-f59c-4557-9d75-4ccf7fe60a47',
});

// Mount the app
app.mount('#app');
