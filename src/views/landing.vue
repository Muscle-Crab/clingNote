<template>
  <div>
    <h2>OneSignal Player ID</h2>
    <p v-if="playerId">Your Player ID: {{ playerId }}</p>
    <p v-else>Fetching Player ID...</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const playerId = ref(null);

const getPlayerId = () => {
  if (window.OneSignal) {
    window.OneSignal.push(async function () {
      try {
        const id = await window.OneSignal.getUserId();
        playerId.value = id;
        console.log("Player ID:", id);
      } catch (error) {
        console.error("Error fetching Player ID:", error);
      }
    });
  } else {
    console.error("OneSignal is not loaded yet.");
  }
};

onMounted(() => {
  getPlayerId();
});
</script>

<style scoped>
h2 {
  font-size: 1.5rem;
  margin-bottom: 10px;
}

p {
  font-size: 1rem;
  color: #333;
}
</style>
