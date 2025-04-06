<template>
  <div class="p-4 bg-white rounded-lg shadow-md text-gray-800">
    <h3 class="text-lg font-semibold mb-2">OneSignal Player ID</h3>
    <p v-if="playerId" class="break-all text-green-600">{{ playerId }}</p>
    <p v-else class="text-red-500">Not available or not subscribed.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const playerId = ref('');

onMounted(() => {
  try {
    const id = window.OneSignal?.User?.PushSubscription?.id;
    if (id) {
      playerId.value = id;
    }
  } catch (error) {
    console.error('Error retrieving OneSignal Player ID:', error);
  }
});
</script>
