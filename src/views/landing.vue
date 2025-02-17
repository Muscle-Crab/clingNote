<script setup>
import { ref, onMounted } from "vue";
import { storePlayerId } from "@/utils/oneSignal";

const playerId = ref(null);

const getPlayerId = () => {
  window.OneSignal = window.OneSignal || [];
  window.OneSignal.push(async () => {
    try {
      const id = await window.OneSignal.getUserId();
      if (id) {
        playerId.value = id;
        storePlayerId(id); // Store only if valid
      } else {
        console.warn("OneSignal Player ID is null or undefined.");
      }
    } catch (error) {
      console.error("Error retrieving Player ID:", error);
    }
  });
};

onMounted(() => {
  getPlayerId();
});
</script>

<template>
  <div>
    <h2>OneSignal Player ID</h2>
    <p v-if="playerId">Your Player ID: <strong>{{ playerId }}</strong></p>
    <p v-else>Retrieving Player ID...</p>
  </div>
</template>
