import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { storePlayerId } from "./utils/oneSignal"; // Import function to store Player ID

// Firebase Authentication listener
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.uid);

        // Wait for OneSignal to be ready before retrieving the Player ID
        window.OneSignal = window.OneSignal || [];
        window.OneSignal.push(() => {
            storePlayerId(); // Store OneSignal Player ID when user logs in
        });
    } else {
        console.log("User logged out");
    }
});

// Create and mount Vue app
const app = createApp(App);
app.use(router);
app.mount('#app');
