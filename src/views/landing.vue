<template>
  <div class="app-container">
    <h1>Task-Based Social Media Access</h1>

    <!-- Show Progress -->
    <p>You have completed {{ completedTasks }} / {{ totalTasks }} tasks.</p>

    <!-- Social Media Buttons -->
    <button @click="attemptToOpenSocialMedia('tiktok')">Open TikTok</button>
    <button @click="attemptToOpenSocialMedia('instagram')">Open Instagram</button>
    <button @click="attemptToOpenSocialMedia('youtube')">Open YouTube</button>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

// Simulated task completion system
const totalTasks = ref(5); // Total required tasks
const completedTasks = ref(3); // Tasks completed by the user

// Calculate points (10 points per completed task)
const pointsAccumulated = computed(() => completedTasks.value * 10);
const requiredPoints = computed(() => totalTasks.value * 10);

// Function to check if the user can open social media
const attemptToOpenSocialMedia = (app) => {
  // if (pointsAccumulated.value < requiredPoints.value) {
  //   alert(`🚫 You need to complete ${totalTasks.value - completedTasks.value} more tasks before using ${app}!`);
  //   return;
  // }

  // Define app deep links, Play Store/App Store fallback, and web URLs
  const urls = {
    tiktok: {
      app: "tiktok://", // Try to open the app
      androidIntent: "intent://www.tiktok.com#Intent;package=com.zhiliaoapp.musically;scheme=https;end;", // Android-only
      store: "https://play.google.com/store/apps/details?id=com.zhiliaoapp.musically", // Google Play Store
      appstore: "https://apps.apple.com/app/tiktok/id835599320", // Apple App Store
      web: "https://www.tiktok.com", // Fallback to web
    },
    instagram: {
      app: "instagram://",
      store: "https://play.google.com/store/apps/details?id=com.instagram.android",
      appstore: "https://apps.apple.com/app/instagram/id389801252",
      web: "https://www.instagram.com",
    },
    youtube: {
      app: "vnd.youtube://",
      store: "https://play.google.com/store/apps/details?id=com.google.android.youtube",
      appstore: "https://apps.apple.com/app/youtube/id544007664",
      web: "https://www.youtube.com",
    },
  };

  const selectedApp = urls[app];

  // Try opening the native app
  window.location.href = selectedApp.app;

  // If it fails, after 2 seconds, check if the user is still on the PWA
  setTimeout(() => {
    // If the user is still on the PWA, open the Play Store/App Store
    if (navigator.userAgent.includes("Android")) {
      window.location.href = selectedApp.store; // Redirect to Play Store
    } else if (navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")) {
      window.location.href = selectedApp.appstore; // Redirect to App Store
    } else {
      window.open(selectedApp.web, "_blank"); // Open in web browser
    }
  }, 2000);
};
</script>

<style scoped>
.app-container {
  text-align: center;
  font-family: Arial, sans-serif;
}
button {
  margin: 10px;
  padding: 10px 15px;
  border: none;
  background: #007bff;
  color: white;
  border-radius: 5px;
  cursor: pointer;
}
button:hover {
  background: #0056b3;
}
</style>
