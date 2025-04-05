<template>
  <div v-if="!isExpired">
    <div class="text-sm text-gray-600 mb-1">
      ⏳ {{ formattedTimeRemaining }}
    </div>
    <div class="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
      <div
          class="h-full bg-blue-500 transition-all duration-200 ease-out"
          :style="{ width: progress + '%' }"
      ></div>
    </div>
  </div>
  <div v-else class="text-sm text-red-500">⏰ Reminder time reached</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';

const props = defineProps({
  reminderTime: {
    type: String,
    required: true, // ISO format: '2025-04-05T14:30'
  },
});

const progress = ref(0);
const formattedTimeRemaining = ref('');
const isExpired = ref(false);

let animationFrameId = null;

const updateCountdown = () => {
  const now = Date.now();
  const end = new Date(props.reminderTime).getTime();
  const totalDuration = end - startTime.value;
  const timeLeft = end - now;

  if (timeLeft <= 0) {
    isExpired.value = true;
    progress.value = 100;
    formattedTimeRemaining.value = '0s';
    cancelAnimationFrame(animationFrameId);
    return;
  }

  // Format remaining time
  const totalSeconds = Math.floor(timeLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  formattedTimeRemaining.value = `${hours}h ${minutes}m ${seconds}s`;

  // Calculate percentage
  progress.value = Math.min(100, ((now - startTime.value) / totalDuration) * 100);

  animationFrameId = requestAnimationFrame(updateCountdown);
};

const startTime = ref(Date.now());

onMounted(() => {
  const reminder = new Date(props.reminderTime).getTime();
  const now = Date.now();

  // If reminder is in the past, skip
  if (now >= reminder) {
    isExpired.value = true;
    progress.value = 100;
    formattedTimeRemaining.value = '0s';
    return;
  }

  startTime.value = now;
  animationFrameId = requestAnimationFrame(updateCountdown);
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId);
});
</script>
