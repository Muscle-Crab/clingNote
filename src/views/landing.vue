<template>
  <div>
    <button @click="getSubscriptionId">Get Subscription ID</button>
    <button @click="sendNotification">Send Notification</button>
    <p v-if="subscriptionId">Subscription ID: {{ subscriptionId }}</p>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  setup() {
    const subscriptionId = ref(null);

    async function getSubscriptionId() {
      if (!window.OneSignal) {
        console.error("❌ OneSignal is not available.");
        return;
      }

      window.OneSignal.push(async function () {
        try {
          const id = window.OneSignal.User.PushSubscription.id; // ✅ Use `.id` instead of `getId()`
          if (id) {
            subscriptionId.value = id;
            console.log("✅ OneSignal Subscription ID:", id);
          } else {
            console.warn("⚠️ Subscription ID is not available. Ensure the user is subscribed.");
          }
        } catch (error) {
          console.error("❌ Error retrieving Subscription ID:", error);
        }
      });
    }

    async function sendNotification() {
      if (!subscriptionId.value) {
        console.warn("⚠️ Cannot send notification. Subscription ID is missing.");
        return;
      }

      const notificationData = {
        app_id: "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // ✅ Your OneSignal App ID
        include_player_ids: [subscriptionId.value], // ✅ Use Subscription ID here
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
        if (result.errors) {
          console.error("❌ Notification API Error:", result.errors);
          alert("❌ Failed to send notification! Check the console.");
        } else {
          console.log("✅ Notification sent successfully:", result);
          alert("✅ Notification Sent!");
        }
      } catch (error) {
        console.error("❌ Error sending notification:", error);
        alert("❌ Failed to send notification!");
      }
    }

    onMounted(() => {
      getSubscriptionId(); // Auto-fetch Subscription ID on mount
    });

    return {
      subscriptionId,
      getSubscriptionId,
      sendNotification,
    };
  },
};
</script>
