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
const synth = window.speechSynthesis; // Web Speech API for TTS

const scheduleNotification = async () => {
  if (!taskTime.value) {
    alert('Please enter a valid date and time.');
    return;
  }

  const notificationTime = new Date(taskTime.value).toISOString();

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_player_ids": ["ff823cf5-aef7-4363-82f7-33c1de7ce02e"], // Replace with user's OneSignal player ID
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

// Initialize OneSignal Notification Click Handling
onMounted(() => {
  if (window.OneSignal) {
    window.OneSignal.push(() => {
      console.log("OneSignal is initialized.");

      // Listen for notification click event
      window.OneSignal.on('notificationClick', (event) => {
        console.log("OneSignal notification clicked:", event);
        const message = event.notification.body;
        speakNotification(message);
      });

      // Backup method: Listen for notification display and speak it immediately
      window.OneSignal.on('notificationDisplay', (event) => {
        console.log("OneSignal notification displayed:", event);
      });
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
