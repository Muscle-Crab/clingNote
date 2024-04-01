<template>
  <div>
    <h2>Send Push Notification</h2>
    <form @submit.prevent="sendNotification">
      <label for="title">Title:</label>
      <input type="text" id="title" v-model="title" required>
      <label for="message">Message:</label>
      <input type="text" id="message" v-model="message" required>
      <label for="icon">Icon:</label>
      <input type="text" id="icon" v-model="icon" required>
      <label for="url">URL:</label>
      <input type="text" id="url" v-model="url" required>
      <button type="submit">Send Notification</button>
    </form>
    <div v-if="notificationId">
      {{ notificationId }}
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: 'Notification Title',
      message: 'Notification Message',
      icon: 'https://yourwebsite.com/icon.png',
      url: 'https://yourwebsite.com/',
      apiKey: 'YOUR_API_KEY',
      notificationId: null
    };
  },
  methods: {
    async sendNotification() {
      try {
        const response = await fetch('https://api.pushalert.co/rest/v1/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'api_key=' + this.apiKey
          },
          body: new URLSearchParams({
            title: this.title,
            message: this.message,
            icon: this.icon,
            url: this.url
          })
        });
        const data = await response.json();
        if (data.success) {
          this.notificationId = data.id;
        } else {
          console.error('Failed to send notification');
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }
  }
};
</script>
