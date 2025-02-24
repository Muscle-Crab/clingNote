<template>
  <div>
    <button @click="getPlayerId">Get Player ID</button>
    <p v-if="playerId">Player ID fdfdfdfd: {{ playerId }}</p>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  setup() {
    const playerId = ref(null);

    // Ensure OneSignal is loaded before accessing it
    async function waitForOneSignal() {
      return new Promise((resolve) => {
        if (window.OneSignal) {
          console.log("✅ OneSignal is available.");
          resolve();
        } else {
          console.warn("⏳ Waiting for OneSignal...");
          let checkInterval = setInterval(() => {
            if (window.OneSignal) {
              clearInterval(checkInterval);
              console.log("✅ OneSignal is now available.");
              resolve();
            }
          }, 500);
        }
      });
    }

    async function getPlayerId() {
      await waitForOneSignal(); // Ensure OneSignal is loaded

      try {
        if (window.OneSignal.User && window.OneSignal.User.onesignalId) {
          playerId.value = window.OneSignal.User.onesignalId;
          console.log("✅ OneSignal Player ID:", playerId.value);
        } else {
          console.warn("⚠️ Player ID is not available. Ensure the user is subscribed.");
        }
      } catch (error) {
        console.error("❌ Error retrieving Player ID:", error);
      }
    }

    onMounted(() => {
      getPlayerId(); // Automatically fetch Player ID on mount
    });

    return {
      playerId,
      getPlayerId,
    };
  },
};
</script>
