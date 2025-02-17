import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import OneSignalVuePlugin from '@onesignal/onesignal-vue3';

// Initialize Vue app
const app = createApp(App);

// Use plugins
app.use(store);
app.use(router);

// Initialize OneSignal
app.use(OneSignalVuePlugin, {
    appId: 'fc206a71-7d65-4cfa-b8b2-0c10548e1476', // Your OneSignal App ID
    allowLocalhostAsSecureOrigin: true, // Enable for localhost testing
    notifyButton: {
        enable: true, // Show the notification permission button
    },
    autoResubscribe: true, // Automatically resubscribe returning users
});

// Wait for OneSignal to be ready and retrieve the Player ID
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const OneSignal = app.config.globalProperties.$OneSignal;

        await OneSignal.init({
            appId: 'fc206a71-7d65-4cfa-b8b2-0c10548e1476',
        });

        console.log("OneSignal Initialized");

        // Check if push notifications are enabled
        const isSubscribed = await OneSignal.isPushNotificationsEnabled();
        console.log("User is subscribed:", isSubscribed);

        if (isSubscribed) {
            const playerId = await OneSignal.getUserId();
            console.log("OneSignal Player ID:", playerId);
            localStorage.setItem("playerId", playerId); // Store for later use
        } else {
            console.log("User has not subscribed to notifications.");
            OneSignal.showSlidedownPrompt(); // Ask user for permission
        }
    } catch (error) {
        console.error("OneSignal error:", error);
    }
});

// Mount the app
app.mount('#app');
