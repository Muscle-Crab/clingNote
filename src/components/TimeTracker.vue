<template>
  <div class="w-full flex flex-col items-center space-y-2 text-center">
    <div class="w-full bg-gray-800 text-white py-2 text-lg font-semibold">
      ⏳ Hours Used Today: {{ formattedTime }}
    </div>
    <p class="w-full text-sm text-red-600 italic">
      "{{ motivationalQuote }}"
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";

const startOfDay = ref(null);
const elapsedTime = ref(0);
let interval;

// List of motivational quotes about time
const quotes = [
  "Time waits for no one. Use it wisely.",
  "The way we spend our time defines who we are.",
  "Lost time is never found again.",
  "Every second is a chance to change your life.",
  "The future depends on what you do today.",
  "You may delay, but time will not.",
  "Make every moment count – because time never stops.",
  "Don't count the days, make the days count."
];

// Pick a random quote
const motivationalQuote = ref(quotes[Math.floor(Math.random() * quotes.length)]);

// Function to get the start of today (midnight)
const getStartOfDay = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set time to midnight
  return now.getTime();
};

// Load start of the day
const loadStartOfDay = () => {
  const savedStartOfDay = localStorage.getItem("startOfDay");
  if (savedStartOfDay && new Date().toDateString() === new Date(parseInt(savedStartOfDay, 10)).toDateString()) {
    startOfDay.value = parseInt(savedStartOfDay, 10);
  } else {
    startOfDay.value = getStartOfDay();
    localStorage.setItem("startOfDay", startOfDay.value);
  }
};

// Update elapsed time since midnight
const updateElapsedTime = () => {
  elapsedTime.value = Math.floor((Date.now() - startOfDay.value) / 1000);
};

// Format elapsed time as 12-hour HH:MM:SS AM/PM
const formattedTime = computed(() => {
  let hours = Math.floor(elapsedTime.value / 3600);
  let minutes = Math.floor((elapsedTime.value % 3600) / 60);
  let seconds = elapsedTime.value % 60;

  const period = hours >= 12 ? "" : "";
  hours = hours % 12 || 12; // Convert 0 or 12 to 12-hour format

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} ${period}`;
});

// Start tracking time
onMounted(() => {
  loadStartOfDay();
  updateElapsedTime();
  interval = setInterval(updateElapsedTime, 1000);
});

// Cleanup when unmounted
onUnmounted(() => {
  clearInterval(interval);
});
</script>

<style scoped>
/* No additional styles needed since Tailwind handles everything */
</style>
