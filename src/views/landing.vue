<template>
  <div class="container">
    <h2>OneSignal Subscription fdfdf</h2>

    <p><strong>Your External ID:</strong> {{ userId }}</p>

    <p v-if="playerId"><strong>Your Player ID:</strong> {{ playerId }}</p>
    <p v-else>Click the button to subscribe and get your Player ID.</p>

    <button @click="fetchPlayerId" :disabled="isLoading">
      {{ isLoading ? "Loading..." : "Get Player ID" }}
    </button>

    <div v-if="playerId" class="notification-section">
      <h3>Send Test Notification</h3>
      <button @click="sendTestNotification">
        About (Send Test Notification)
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const playerId = ref(null);
const userId = ref("dsDDbr945rawMAUKKpIAJcnPYrX2"); // Replace with actual user ID
const isLoading = ref(false);

const fetchPlayerId = async () => {
  if (!window.OneSignal) {
    console.error("OneSignal SDK is not loaded!");
    return;
  }

  try {
    isLoading.value = true;
    console.log("Initializing OneSignal...");

    // Assign user external ID
    await window.OneSignal.User.addAlias("external_id", userId.value);
    console.log(`User alias set: external_id -> ${userId.value}`);

    // Wait for OneSignal to be ready
    await new Promise(resolve => setTimeout(resolve, 2000)); // Allow initialization time

    // Check if user is subscribed
    const isSubscribed = await window.OneSignal.User.PushSubscription.optedIn;
    console.log("Is user subscribed?", isSubscribed);

    if (!isSubscribed) {
      console.log("User is not subscribed. Asking for permission...");

      // Request notification permission
      const permission = await window.OneSignal.Notifications.requestPermission();
      if (permission !== "granted") {
        console.error("User denied notification permission.");
        isLoading.value = false;
        return;
      }
    }

    // Fetch player_id
    playerId.value = await window.OneSignal.User.getId();
    console.log("User subscribed, player_id:", playerId.value);

    // Register subscription
    await createSubscription(userId.value, playerId.value);

  } catch (error) {
    console.error("OneSignal initialization error:", error);
  } finally {
    isLoading.value = false;
  }
};

// Function to create a OneSignal subscription using Fetch API
const createSubscription = async (userId, playerId) => {
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your OneSignal API Key
    'Content-Type': 'application/json'
  };

  const appId = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Replace with your OneSignal App ID
  const aliasLabel = "external_id";
  const aliasId = userId;

  // Get push token
  const pushToken = await window.OneSignal.User.PushSubscription.token;

  if (!pushToken) {
    console.error("Push token not available.");
    return;
  }

  const url = `https://api.onesignal.com/apps/${appId}/users/by/${aliasLabel}/${aliasId}/subscriptions`;

  const data = {
    type: "push",
    token: pushToken,
    enabled: true
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Subscription created:", result);
  } catch (error) {
    console.error("Error creating subscription:", error);
  }
};

// Function to send a test notification to the subscribed device
const sendTestNotification = async () => {
  if (!playerId.value) {
    console.error("User is not subscribed or player ID is not available.");
    return;
  }

  const headers = {
    'Authorization': 'Basic ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your OneSignal API Key
    'Content-Type': 'application/json'
  };

  const appId = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Replace with your OneSignal App ID

  const data = {
    app_id: appId,
    include_aliases: { "external_id": [userId.value] }, // Send to specific user
    contents: { "en": "This is a test notification!" }, // Test message
    headings: { "en": "Test Alert" }, // Notification title
    url: "https://yourwebsite.com" // Optional URL
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });

    const result = await response.json();
    console.log("Test notification sent:", result);
  } catch (error) {
    console.error("Error sending test notification:", error);
  }
};
</script>

<style scoped>
.container {
  text-align: center;
  padding: 20px;
}

button {
  padding: 10px 15px;
  border: none;
  background-color: #007bff;
  color: white;
  font-size: 16px;
  cursor: pointer;
  border-radius: 5px;
  margin-top: 10px;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.notification-section {
  margin-top: 20px;
}
</style>
