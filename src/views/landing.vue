<template>
  <div class="container">
    <h2>OneSignal Notification Setup</h2>

    <!-- Input for setting External User ID -->
    <input v-model="inputUserId" type="text" placeholder="Enter External User ID" class="input" />
    <button @click="setExternalUserId" class="button">Set External ID</button>

    <!-- Display External User ID -->
    <p v-if="externalUserId">Your External User ID: <strong>{{ externalUserId }}</strong></p>

    <!-- Schedule Notification Section -->
    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="scheduleNotification" class="button">Schedule Notification</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const taskTime = ref('');
const inputUserId = ref('');
const externalUserId = ref(null);
const synth = window.speechSynthesis;

// Function to set External User ID in OneSignal
const setExternalUserId = async () => {
  if (!inputUserId.value) {
    alert('Please enter an External User ID.');
    return;
  }

  await waitForOneSignal(); // Ensure OneSignal is ready

  if (window.OneSignal) {
    try {
      await window.OneSignal.User.setExternalId(inputUserId.value);
      externalUserId.value = inputUserId.value;
      console.log("External User ID set:", inputUserId.value);
      alert("External User ID set successfully!");
    } catch (error) {
      console.error("Error setting External User ID:", error);
      alert("Failed to set External User ID.");
    }
  } else {
    console.warn('OneSignal is not initialized.');
  }
};

// Function to schedule a notification
const scheduleNotification = async () => {
  if (!taskTime.value) {
    alert('Please enter a valid date and time.');
    return;
  }

  if (!externalUserId.value) {
    alert('External User ID not found. Please set it first.');
    return;
  }

  const notificationTime = new Date(taskTime.value).toISOString();
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_external_user_ids": [externalUserId.value],
    "contents": { "en": "It's time for your scheduled task!" },
    "headings": { "en": "Task Reminder" },
    "send_after": notificationTime,
    "url": "https://clingnote.netlify.app"
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

// Wait for OneSignal to be ready
const waitForOneSignal = async () => {
  return new Promise((resolve) => {
    const checkReady = () => {
      if (window.OneSignal && window.OneSignal.isReady) {
        console.log('OneSignal is ready.');
        resolve();
      } else {
        console.log('Waiting for OneSignal to initialize...');
      }
    };
    checkReady();
  });
};

// Retrieve the saved External User ID on page load
const getExternalUserId = async () => {
  await waitForOneSignal();

  if (window.OneSignal) {
    try {
      const userId = await window.OneSignal.User.getExternalId();
      if (userId) {
        externalUserId.value = userId;
        console.log('Retrieved OneSignal External User ID:', userId);
      }
    } catch (error) {
      console.error('Error retrieving External User ID:', error);
    }
  }
};

onMounted(async () => {
  await getExternalUserId();
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
