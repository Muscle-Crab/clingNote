<template>
  <div>
    <button @click="getPlayerId">Get Player ID  flkdjfkldjfldfldk</button>
    <p v-if="playerId">Player ID: {{ playerId }}</p>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  setup() {
    const playerId = ref(null);

    async function getPlayerId() {
      if (!window.OneSignal) {
        console.error("❌ OneSignal is not available.");
        return;
      }

      window.OneSignal.push(async function() {
        try {
          const id = await window.OneSignal.User.PushSubscription.getId();
          if (id) {
            playerId.value = id;
            console.log("✅ OneSignal Player ID:", id);
          } else {
            console.warn("⚠️ Player ID is not available. Ensure the user is subscribed.");
          }
        } catch (error) {
          console.error("❌ Error retrieving Player ID:", error);
        }
      });
    }

    onMounted(() => {
      getPlayerId(); // Auto-fetch Player ID on mount
    });

    return {
      playerId,
      getPlayerId,
    };
  },
};
</script>
