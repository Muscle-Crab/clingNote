<template>
  <div>
    <h2>Schedule a Notification</h2>
    <input v-model="taskTime" type="datetime-local" />
    <button @click="scheduleNotification">Save me</button>
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
    "included_segments": ["Subscribed Users"],
    "send_after": notificationTime,
    "contents": { "en": "It's time for your scheduled task!" },
    "headings": { "en": "Task Reminder" }
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

// Listen for push notifications and trigger TTS
onMounted(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      OneSignal.Notifications.addEventListener('click', (event) => {
        const message = event.notification.body;
        speakNotification(message);
      });

      // Backup method using BroadcastChannel
      const bc = new BroadcastChannel('notification-channel');
      bc.onmessage = event => {
        const message = event.data.body;
        speakNotification(message);
      };
    });
  }
});

// Speak out notifications
const speakNotification = (message) => {
  if (synth) {
    const utterance = new SpeechSynthesisUtterance(message);
    synth.speak(utterance);
  }
};
</script>
