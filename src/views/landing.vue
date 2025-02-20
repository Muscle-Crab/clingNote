<template>
  <div class="container">
    <h2>Schedule a Notification changed</h2>
    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="scheduleNotification" class="button">Save</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const taskTime = ref('');
const userExternalId = ref(null); // Dynamic external ID

const ONE_SIGNAL_APP_ID = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Your OneSignal App ID
const ONE_SIGNAL_API_KEY = "ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy"; // Your OneSignal API Key

// ✅ Function to Get Dynamic External ID (Replace with your logic)
const fetchUserExternalId = async () => {
  try {
    // Example: Fetch from API or local storage
    const response = await axios.get("/api/user"); // Replace with actual API endpoint
    if (response.data && response.data.external_id) {
      userExternalId.value = response.data.external_id;
      console.log("Fetched External ID:", userExternalId.value);
    } else {
      console.error("External ID not found.");
    }
  } catch (error) {
    console.error("Error fetching user external ID:", error);
  }
};

// ✅ Function to Check If a OneSignal User Exists, Create if Not
const getOrCreateUser = async () => {
  if (!userExternalId.value) {
    console.error("No external ID available.");
    return null;
  }

  const url = `https://api.onesignal.com/apps/${ONE_SIGNAL_APP_ID}/users/by/external_id/${userExternalId.value}`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Key ${ONE_SIGNAL_API_KEY}`
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (data && data.identity) {
      console.log("User exists:", data.identity.external_id);
      return data.identity.external_id;
    } else {
      console.log("User does not exist, creating user...");
      return await createOneSignalUser();
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
};

// ✅ Function to Create a OneSignal User
const createOneSignalUser = async () => {
  if (!userExternalId.value) {
    console.error("Cannot create user: No external ID available.");
    return null;
  }

  const url = `https://api.onesignal.com/apps/${ONE_SIGNAL_APP_ID}/users`;
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Key ${ONE_SIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      identity: { external_id: userExternalId.value },
      properties: {
        language: 'en',
        timezone_id: 'America/Los_Angeles',
        lat: 90,
        long: 135,
        country: 'US',
        first_active: Math.floor(Date.now() / 1000),
        last_active: Math.floor(Date.now() / 1000)
      }
    })
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (data && data.identity) {
      console.log("User created successfully:", data.identity.external_id);
      return data.identity.external_id;
    } else {
      console.error("Failed to create user.");
      return null;
    }
  } catch (error) {
    console.error("Error creating user:", error);
    return null;
  }
};

// ✅ Function to Schedule a Notification Using External ID
const scheduleNotification = async () => {
  if (!taskTime.value) {
    alert('Please enter a valid date and time.');
    return;
  }

  if (!userExternalId.value) {
    alert("Error: No user external ID available.");
    return;
  }

  const notificationTime = new Date(taskTime.value).toISOString();
  const externalId = await getOrCreateUser();

  if (!externalId) {
    alert("Error: Unable to retrieve or create OneSignal External ID.");
    return;
  }

  const headers = {
    'Authorization': `Bearer ${ONE_SIGNAL_API_KEY}`,
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": ONE_SIGNAL_APP_ID,
    "include_aliases": { "external_id": [externalId] }, // ✅ Send notification using external_id
    "contents": { "en": "It's time for your scheduled task!" },
    "headings": { "en": "Task Reminder" },
    "send_after": notificationTime,
    "url": "https://your-app.com"
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });

    if (response.data.id) {
      alert('Notification scheduled successfully!');
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert('Failed to schedule notification.');
  }
};

// ✅ Ensure External ID is Fetched on Page Load
onMounted(async () => {
  await fetchUserExternalId(); // Fetch the dynamic external ID
  await getOrCreateUser(); // Ensure the user exists in OneSignal
});
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
