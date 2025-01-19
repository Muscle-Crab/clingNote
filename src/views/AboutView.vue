<template>
  <div class="player-id">
    <h1>OneSignal Player ID</h1>
    <p v-if="playerId">Your Player ID: {{ playerId }}</p>
    <p v-else>Fetching Player ID...</p>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'PlayerId',
  setup() {
    const playerId = ref(null);

    const fetchPlayerId = async () => {
      const OneSignal = window.OneSignal || [];
      OneSignal.push(async () => {
        const id = await OneSignal.getUserId();
        playerId.value = id;
        console.log('Player ID:', id);
      });
    };

    onMounted(() => {
      fetchPlayerId();
    });

    return {
      playerId,
    };
  },
};
</script>

<style>
.player-id {
  text-align: center;
  font-family: Arial, sans-serif;
  margin-top: 20px;
}
</style>
