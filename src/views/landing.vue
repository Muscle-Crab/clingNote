<template>
  <div>
    <button @click="getPlayerId">Get Player ID</button>
    <button @click="sendNotification">Send Notification</button>
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

      window.OneSignal.push(async function () {
        try {
          const id = window.OneSignal.User.onesignalId; // ✅ Use onesignalId directly
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

    async function sendNotification() {
      if (!playerId.value) {
        console.warn("⚠️ Cannot send notification. Player ID is missing.");
        return;
      }

      const notificationData = {
        app_id: "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // ✅ Your OneSignal App ID
        include_player_ids: [playerId.value], // ✅ Target the retrieved Player ID
        headings: { en: "Test Notification" },
        contents: { en: "This is a test notification from Vue.js!" },
      };

      try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy", // ⚠️ TEMPORARY USE ONLY - REMOVE AFTER TESTING
          },
          body: JSON.stringify(notificationData),
        });

        const result = await response.json();
        console.log("✅ Notification sent successfully:", result);
        alert("✅ Notification Sent!");
      } catch (error) {
        console.error("❌ Error sending notification:", error);
        alert("❌ Failed to send notification!");
      }
    }

    onMounted(() => {
      getPlayerId(); // Auto-fetch Player ID on mount
    });

    return {
      playerId,
      getPlayerId,
      sendNotification,
    };
  },
};
</script>
