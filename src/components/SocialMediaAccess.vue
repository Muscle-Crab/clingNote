<template>
  <div class=" ">
    <div v-if="completionPercentage < 100">
      <p class="  text-gray-800 mb-3">Earn full points to access only from here</p>
    </div>
    <div v-else>
      <p class="  text-gray-800 mb-3">You can now access  social media from here</p>
    </div>

    <!-- Social Media Icons -->
    <div class="flex justify-center gap-4">
      <button
          v-for="platform in socialPlatforms"
          :key="platform.id"
          @click="attemptToOpenSocialMedia(platform)"
          :disabled="completionPercentage < 100"
          class="w-10 h-10 flex items-center justify-center rounded-full shadow-md transition-all
        duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
      >
        <img :src="platform.icon" :alt="platform.name" class="w-10 h-10" />
      </button>
    </div>

    <!-- Lock message when tasks are incomplete -->
    <p v-if="completionPercentage < 100" class="text-red-500 font-medium mt-3">
      🚫 Complete all tasks to unlock social media access!
    </p>
  </div>
</template>

<script setup>
import { defineProps } from "vue";

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
    web: "https://www.tiktok.com",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png",
    app: "instagram://",
    web: "https://www.instagram.com",
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
    web: "https://www.facebook.com",
  },
];

// Function to open social media apps on mobile
const attemptToOpenSocialMedia = (platform) => {
  if (props.completionPercentage < 100) return; // Prevent access if tasks are incomplete

  // Try opening the app first
  window.location.href = platform.app;

  // If the app fails to open, fallback to the web version
  setTimeout(() => {
    window.open(platform.web, "_blank");
  }, 1500);
};
</script>
