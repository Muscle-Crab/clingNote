<script setup>
import { ref, onMounted } from 'vue';

const playerId = ref(null);

onMounted(async () => {
  if (window.OneSignal) {
    try {
      // Wait for OneSignal initialization
      await window.OneSignal.init();

      // Check if the user is already subscribed
      const isSubscribed = await window.OneSignal.Notifications.isPushEnabled();

      if (isSubscribed) {
        playerId.value = await window.OneSignal.User.getId();
        console.log('User is already subscribed with player_id:', playerId.value);
      }

      // Listen for permission changes (subscription events)
      window.OneSignal.Notifications.addEventListener('permissionChange', async (event) => {
        if (event === 'granted') {
          playerId.value = await window.OneSignal.User.getId();
          console.log('User subscribed, player_id:', playerId.value);
        }
      });

    } catch (error) {
      console.error('OneSignal initialization error:', error);
    }
  } else {
    console.error('OneSignal is not available.');
  }
});
</script>

<template>
  <div>
    <h2>OneSignal Subscriptions</h2>
    <p v-if="playerId">Your Player ID: <strong>{{ playerId }}</strong></p>
    <p v-else>Click the bell to subscribe and get your Player ID.</p>
  </div>
</template>
