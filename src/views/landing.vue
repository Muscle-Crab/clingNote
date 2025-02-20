<template>
  <div class="container">
    <h2>Schedule a Notification</h2>
    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="scheduleNotification" class="button">Save</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const taskTime = ref('');
const ONE_SIGNAL_APP_ID = "fc206a71-7d65-4cfa-b8b2-0c10548e1476"; // Your OneSignal App ID
const ONE_SIGNAL_API_KEY = "ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy"; // Your OneSignal API Key
const USER_EXTERNAL_ID = "test_external_id"; // Replace with dynamic user ID

// ✅ Function to Check If a OneSignal User Exists, Create if Not
const getOrCreateUser = async () => {
  const url = `https://api.onesignal.com/apps/${ONE_SIGNAL_APP_ID}/users/by/external_id/${USER_EXTERNAL_ID}`;
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
  const url = `https://api.onesignal.com/apps/${ONE_SIGNAL_APP_ID}/users`;
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Key ${ONE_SIGNAL_API_KEY}`
    },
    body: JSON.stringify({
      identity: { external_id: USER_EXTERNAL_ID },
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
    "include_aliases": {"external_id": [externalId]}, // ✅ Send notification using external_id
    "contents": {"en": "It's time for your scheduled task!"},
    "headings": {"en": "Task Reminder"},
    "send_after": notificationTime,
    "url": "https://your-app.com"
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {headers});

    if (response.data.id) {
      alert('Notification scheduled successfully!');
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert('Failed to schedule notification.');
  }
};

// ✅ Ensure OneSignal is initialized only once
onMounted(() => {
  getOrCreateUser();
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
