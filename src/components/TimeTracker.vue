<template>
  <div class="w-full flex flex-col items-center space-y-2 text-center">
    <div class="w-full bg-gray-800 text-white py-2 text-lg font-semibold flex justify-between items-center px-4">
      <span>⏳ Hours Left Today: {{ formattedTimeLeft }}</span>
      <button @click="toggleAudio" class="text-white text-2xl focus:outline-none">
        {{ isMuted ? "🔇" : "🔊" }}
      </button>
    </div>
    <p class="w-full text-sm text-red-600 italic">
      "{{ motivationalQuote }}"
    </p>
    <audio ref="audioPlayer" loop></audio>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import tickSound from "@/assets/tick.mp3"; // Import the audio file

const secondsInDay = 16 * 60 * 60; // 24 hours - 8 hours for sleep
const elapsedTime = ref(0);
const audioPlayer = ref(null);
const isMuted = ref(false); // Track mute state
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

// Update elapsed time since wake-up (assuming wake-up at 8 AM)
const updateElapsedTime = () => {
  const now = new Date();
  const secondsSinceWakeUp = (now.getHours() - 8) * 3600 + now.getMinutes() * 60 + now.getSeconds();
  elapsedTime.value = Math.max(0, Math.min(secondsSinceWakeUp, secondsInDay)); // Ensure within bounds
};

// Compute time left for today
const formattedTimeLeft = computed(() => {
  let remainingSeconds = Math.max(0, secondsInDay - elapsedTime.value);
  let hours = Math.floor(remainingSeconds / 3600);
  let minutes = Math.floor((remainingSeconds % 3600) / 60);
  let seconds = remainingSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

// Toggle audio mute/unmute
const toggleAudio = () => {
  if (audioPlayer.value) {
    isMuted.value = !isMuted.value;
    audioPlayer.value.muted = isMuted.value;
  }
};

// Start tracking time and play audio
onMounted(() => {
  updateElapsedTime();
  interval = setInterval(updateElapsedTime, 1000);

  if (audioPlayer.value) {
    audioPlayer.value.src = tickSound;
    audioPlayer.value.loop = true;
    audioPlayer.value.play().catch(error => {
      console.error("Audio playback failed:", error);
    });
  }
});

// Cleanup when unmounted
onUnmounted(() => {
  clearInterval(interval);
});
</script>

<style scoped>
/* No additional styles needed since Tailwind handles everything */
</style>
