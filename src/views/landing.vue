<template>
  <div class="container">
    <h2>OneSignal Subscription</h2>

    <p><strong>Your Firebase UID (External ID):</strong> {{ userId || "Not Logged In" }}</p>

    <p v-if="playerId"><strong>Your Player ID:</strong> {{ playerId }}</p>
    <p v-else>Click the button to subscribe and get your Player ID.</p>

    <button @click="fetchPlayerId" :disabled="isLoading || !userId">
      {{ isLoading ? "Loading..." : "Get Player ID" }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Firebase Auth & User Info
const auth = getAuth();
const userId = ref(null); // User UID from Firebase
const playerId = ref(null);
const isLoading = ref(false);

// ✅ Listen for Firebase Authentication changes
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userId.value = user.uid; // Set user UID dynamically
      console.log("Firebase User UID:", user.uid);
    } else {
      userId.value = null; // User is not logged in
    }
  });
});

// ✅ Fetch Player ID & Set External User ID in OneSignal
const fetchPlayerId = async () => {
  if (!window.OneSignal) {
    console.error("OneSignal SDK is not loaded!");
    return;
  }

  if (!userId.value) {
    alert("You must be logged in to get a Player ID.");
    return;
  }

  try {
    isLoading.value = true;
    console.log("Initializing OneSignal...");

    // ✅ Assign Firebase UID as OneSignal External ID
    await window.OneSignal.push(() => {
      window.OneSignal.User.addAlias("external_id", userId.value);
    });
    console.log(`User alias set: external_id -> ${userId.value}`);

    // Wait for OneSignal to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if notifications are enabled
    const isSubscribed = await window.OneSignal.Notifications.isPushEnabled();
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

    // ✅ Create the subscription in OneSignal API
    await createSubscription(userId.value);

  } catch (error) {
    console.error("OneSignal initialization error:", error);
  } finally {
    isLoading.value = false;
  }
};

// ✅ Function to create a OneSignal subscription using Fetch API
const createSubscription = async (externalId) => {
  const headers = {
    "Authorization": "Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy", // Replace with your OneSignal API Key
    "Content-Type": "application/json",
  };

  const appId = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Replace with your OneSignal App ID
  const aliasLabel = "external_id";
  const aliasId = externalId;

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
    enabled: true,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
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
</style>
