<template>
  <div class="container">
    <h2>Schedule a Notification</h2>

    <p v-if="externalUserId">Your External User ID: <strong>{{ externalUserId }}</strong></p>
    <p v-else>Loading External User ID...</p>

    <input v-model="taskTime" type="datetime-local" class="input" />
    <button @click="scheduleNotification" class="button">Save</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const taskTime = ref('');
const externalUserId = ref(null);
const synth = window.speechSynthesis; // Web Speech API for TTS

// Mock function to get user ID from authentication system
const getUserId = async () => {
  // Replace this with your actual method to get the logged-in user's ID
  return localStorage.getItem("user_id") || "guest_" + Math.floor(Math.random() * 10000);
};

// Schedule notification using External User ID
const scheduleNotification = async () => {
  if (!taskTime.value) {
    alert('Please enter a valid date and time.');
    return;
  }

  if (!externalUserId.value) {
    alert('External User ID not found. Please enable notifications.');
    return;
  }

  const notificationTime = new Date(taskTime.value).toISOString();

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_external_user_ids": [externalUserId.value], // Use External User ID
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

// Set and retrieve External User ID dynamically
const setupExternalUserId = async () => {
  await waitForOneSignal(); // Ensure OneSignal is ready

  const userId = await getUserId(); // Retrieve user ID dynamically
  if (!userId) {
    console.warn("No user ID available.");
    return;
  }

  if (window.OneSignal) {
    try {
      // Set the dynamically retrieved External User ID
      await window.OneSignal.User.setExternalId(userId);
      console.log("External User ID set:", userId);

      // Retrieve the External User ID
      const storedUserId = await window.OneSignal.User.getExternalId();
      if (storedUserId) {
        externalUserId.value = storedUserId;
        console.log('OneSignal External User ID:', storedUserId);
      } else {
        console.warn('OneSignal External User ID not available.');
      }
    } catch (error) {
      console.error('Error setting/retrieving External User ID:', error);
    }
  } else {
    console.warn('OneSignal is not initialized.');
  }
};

onMounted(async () => {
  await setupExternalUserId();

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

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "en-US";
  utterance.rate = 1.0;
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
