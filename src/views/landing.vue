<template>
  <div class="container">
    <h2>Schedule a Notification dalton</h2>
    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="sendNotificationToDevice" class="button">Save</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const taskTime = ref('');
const playerId = ref(null); // ✅ Store the OneSignal Player ID
const ONE_SIGNAL_APP_ID = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Your OneSignal App ID
const ONE_SIGNAL_API_KEY = "ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy"; // Your OneSignal API Key

// ✅ Function to Get the Current Device Player ID
const getPlayerIdFromAPI = async () => {
  const ONE_SIGNAL_APP_ID = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Your OneSignal App ID
  const ONE_SIGNAL_API_KEY = "ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy"; // Your OneSignal API Key
  const USER_EXTERNAL_ID = "test_external_id"; // Replace with the actual user ID

  const url = `https://api.onesignal.com/apps/${ONE_SIGNAL_APP_ID}/users/by/external_id/${USER_EXTERNAL_ID}`;

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Key ${ONE_SIGNAL_API_KEY}`, // ✅ Required API Key
    },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();

    // ✅ Extract Player ID from response
    if (data.subscriptions && data.subscriptions.length > 0) {
      const playerId = data.subscriptions[0].id;
      console.log("Player ID:", playerId);
      return playerId;
    } else {
      console.warn("No subscriptions found for this user.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching player ID:", error);
    return null;
  }
};


// ✅ Function to Schedule a Notification for the Current Device
const sendNotificationToDevice = async () => {
  const playerId = await getPlayerIdFromAPI();

  if (!playerId) {
    alert("No Player ID found. Ensure notifications are enabled.");
    return;
  }

  const url = "https://onesignal.com/api/v1/notifications";
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ONE_SIGNAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: ONE_SIGNAL_APP_ID,
      include_player_ids: [playerId], // ✅ Send to this specific device
      contents: { en: "Your scheduled notification!" },
      headings: { en: "Task Reminder" },
      send_after: new Date().toISOString(),
    }),
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log("OneSignal Response:", data);

    if (data.errors) {
      console.error("OneSignal Errors:", data.errors);
      alert(`Failed to send notification: ${data.errors.join(", ")}`);
    } else if (data.id) {
      alert("Notification sent successfully!");
    } else {
      alert("Failed to send notification.");
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    alert("Failed to send notification.");
  }
};


// ✅ Initialize OneSignal and Get Player ID When Component Mounts

</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.input {
  width: 100%;
  max-width: 300px;
  padding: 10px;
  margin: 10px 0;
  font-size: 16px;
}

.button {
  padding: 10px 15px;
  font-size: 16px;
  background-color: #007bff;
  color: white;
  border: none;
  cursor: pointer;
  border-radius: 5px;
}

.button:hover {
  background-color: #0056b3;
}
</style>
