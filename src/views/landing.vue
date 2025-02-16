<template>
  <div class="container">
    <h2>Schedule a Notification</h2>
    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="scheduleNotification" class="button">Save AS</button>
    <span>Summer is a princess</span>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useOneSignal } from '@onesignal/onesignal-vue3';
import axios from 'axios';

const taskTime = ref('');
const playerId = ref('');
const { OneSignal, isOneSignalInitialized } = useOneSignal(); // Get OneSignal instance

const fetchPlayerId = async () => {
  try {
    if (!isOneSignalInitialized.value) {
      console.warn('OneSignal is not yet initialized. Retrying...');
      setTimeout(fetchPlayerId, 2000); // Retry after 2 seconds
      return;
    }

    const userId = await OneSignal.getUserId(); // Get Player ID from OneSignal
    if (userId) {
      playerId.value = userId;
      localStorage.setItem('player_id', userId);
    } else {
      console.warn('User is not subscribed to notifications.');
    }
  } catch (error) {
    console.error('Error fetching player ID:', error);
  }
};

// Call the function after OneSignal initializes
onMounted(() => {
  setTimeout(fetchPlayerId, 3000); // Ensure OneSignal is ready before fetching
});

const scheduleNotification = async () => {
  if (!taskTime.value) {
    alert('Please enter a valid date and time.');
    return;
  }

  if (!playerId.value) {
    alert('Player ID not found. Please ensure OneSignal is initialized.');
    return;
  }

  const notificationTime = new Date(taskTime.value).toISOString();

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your actual API key
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Your OneSignal App ID
    "include_player_ids": [playerId.value], // Use the dynamic player ID
    "contents": {"en": "It's time for your scheduled task!"},
    "headings": {"en": "Task Reminder"},
    "send_after": notificationTime,
    "url": "https://your-app.com" // Optional: Link to your app or task page
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {headers});

    if (response.data.id) {
      alert('Notification scheduled successfully!');
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert('Failed to schedule notification. Check console for details.');
  }
};
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
