<template>
  <div class="container">
    <h2>Schedule a Notification</h2>

    <!-- Display Player ID if available -->
    <p v-if="playerId">Your Player ID: <strong>{{ playerId }}</strong></p>

    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="scheduleNotification" class="button">Save</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const taskTime = ref('');
const playerId = ref(null);
const synth = window.speechSynthesis; // Web Speech API for TTS

const scheduleNotification = async () => {
  if (!taskTime.value) {
    alert('Please enter a valid date and time.');
    return;
  }

  if (!playerId.value) {
    alert('Player ID not found. Please enable notifications.');
    return;
  }

  const notificationTime = new Date(taskTime.value).toISOString();

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_player_ids": [playerId.value], // Use dynamic Player ID
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

// Ensure OneSignal is initialized before retrieving Player ID
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

// Function to retrieve OneSignal Player ID using SDK v16+
const getPlayerId = async () => {
  await waitForOneSignal(); // Wait until OneSignal is ready

  if (window.OneSignal) {
    try {
      const userId = await window.OneSignal.User.getId();
      if (userId) {
        playerId.value = userId;
        console.log('OneSignal User ID:', userId);
      } else {
        console.warn('OneSignal User ID not available.');
      }
    } catch (error) {
      console.error('Error getting OneSignal User ID:', error);
    }
  } else {
    console.warn('OneSignal is not initialized.');
  }
};

onMounted(async () => {
  await getPlayerId();

  if (window.OneSignal) {
    console.log("OneSignal is initialized.");

    // Listen for notification click event
    window.OneSignal.Event.on('notification.clicked', (event) => {
      console.log("OneSignal notification clicked:", event);
      const message = event.notification.body;
      speakNotification(message);
    });

    // Listen for notification display event
    window.OneSignal.Event.on('notification.displayed', (event) => {
      console.log("OneSignal notification displayed:", event);
    });
  }

  // Backup method using BroadcastChannel
  const bc = new BroadcastChannel('notification-channel');
  bc.onmessage = event => {
    console.log("BroadcastChannel received message:", event.data);
    const message = event.data.body;
    speakNotification(message);
  };
});

// Speak out notifications
const speakNotification = (message) => {
  console.log("Speaking notification:", message);

  if (!synth) {
    console.error("Speech synthesis not available");
    return;
  }

  // Stop any ongoing speech
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "en-US"; // Adjust for language preferences
  utterance.rate = 1.0; // Adjust speed if needed
  synth.speak(utterance);
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
