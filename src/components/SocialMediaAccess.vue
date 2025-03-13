<template>
  <div class="text-center">
    <div v-if="completionPercentage < 60">
      <p class="text-sm text-gray-800 mb-3">Earn over 60 points to access social media</p>
    </div>
    <div v-else>
      <p class="text-sm text-green-600 font-semibold mb-3">✅ You can now access social media from here</p>
    </div>

    <!-- Social Media Icons -->
    <div class="flex justify-center gap-4">
      <button
          v-for="platform in socialPlatforms"
          :key="platform.id"
          @click="attemptToOpenSocialMedia(platform)"
          :disabled="completionPercentage < 60"
          class="w-12 h-12 flex items-center justify-center rounded-full shadow-md transition-all duration-300
        hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        <img
            :src="platform.icon"
            :alt="platform.name"
            class="w-7 h-7 transition-all duration-300"
            :class="{'opacity-40 grayscale': completionPercentage < 60}"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps } from "vue";
import { onMounted } from "vue";

const props = defineProps({
  completionPercentage: Number, // Receiving prop from parent
});

// Define social media platforms with app deep links
const socialPlatforms = [
  {
    id: "tiktok",
    name: "TikTok",
    icon: "https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg",
    app: "tiktok://",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png",
    app: "instagram://",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg",
    app: "vnd.youtube://",
    web: "https://www.youtube.com",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg",
    app: "fb://",
  },
];

// Your app's deep link URL (replace with your actual app's deep link)
const appDeepLink = "yourapp://home";

// Function to open social media apps on mobile
const attemptToOpenSocialMedia = (platform) => {
  if (props.completionPercentage < 60) return; // Prevent access if points are below 60

  const userAgent = navigator.userAgent || navigator.vendor;

  // If user is inside TikTok app
  if (userAgent.includes("TikTok")) {
    if (platform.id === "tiktok") {
      // Force TikTok to open in the default browser (for Android)
      window.location.href = `intent://${platform.web.replace("https://", "")}#Intent;scheme=https;package=com.android.chrome;end;`;
      return;
    } else {
      return;
    }
  }

  // Store return path in session storage
  sessionStorage.setItem("returnToApp", appDeepLink);

  // Try opening the app first
  window.location.href = platform.app;
};

// Ensure returning from social media redirects back to your app
onMounted(() => {
  const returnToApp = sessionStorage.getItem("returnToApp");
  if (returnToApp) {
    sessionStorage.removeItem("returnToApp");
    window.location.href = returnToApp;
  }
});
</script>
