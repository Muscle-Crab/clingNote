<template>
  <button @click="sendNotification">Send Notification</button>
</template>

<script>
export default {
  methods: {
    sendNotification() {
      PushAlert.sendNotification({
        title: 'New Message',
        body: 'You have a new message!'
      });
    }
  }
}
</script>
