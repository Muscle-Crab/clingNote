<script setup>
import { ref, onMounted } from 'vue';

const playerId = ref(null);
const userId = "some-user-id-123"; // Replace with actual user ID from your system

onMounted(async () => {
  if (window.OneSignal) {
    try {
      // Wait for OneSignal initialization
      await window.OneSignal.init();

      // Set external_id for the user
      await window.OneSignal.User.addAlias("external_id", userId);

      // Check if the user is already subscribed
      const isSubscribed = await window.OneSignal.Notifications.isPushEnabled();

      if (isSubscribed) {
        playerId.value = await window.OneSignal.User.getId();
        console.log('User is already subscribed with player_id:', playerId.value);
        createSubscription(userId, playerId.value); // Create subscription if already subscribed
      }

      // Listen for subscription changes
      window.OneSignal.Notifications.addEventListener('permissionChange', async (event) => {
        if (event === 'granted') {
          playerId.value = await window.OneSignal.User.getId();
          console.log('User subscribed, player_id:', playerId.value);
          createSubscription(userId, playerId.value); // Create subscription after subscription
        }
      });

    } catch (error) {
      console.error('OneSignal initialization error:', error);
    }
  } else {
    console.error('OneSignal is not available.');
  }
});

// Function to create a OneSignal subscription using Fetch API
const createSubscription = async (userId, playerId) => {
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Your OneSignal API Key
    'Content-Type': 'application/json'
  };

  const appId = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Your OneSignal App ID
  const aliasLabel = "external_id"; // Recommended alias
  const aliasId = userId; // The user's unique ID

  // Get push token
  const pushToken = await window.OneSignal.User.PushSubscription.token;

  if (!pushToken) {
    console.error("Push token not available.");
    return;
  }

  const url = `https://api.onesignal.com/apps/${appId}/users/by/${aliasLabel}/${aliasId}/subscriptions`;

  const data = {
    type: "push", // Subscription type (web push)
    token: pushToken,
    enabled: true // Ensure the subscription is active
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
</script>

<template>
  <div>
    <h2>OneSignal Subscriptions</h2>
    <p v-if="playerId">Your Player ID: <strong>{{ playerId }}</strong></p>
    <p v-else>Click the bell to subscribe and get your Player ID.</p>
  </div>
</template>
