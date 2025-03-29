<template>
  <div class="p-4">
    Test
  </div>
</template>

<script>
export default {
  data() {
    return {
      tasks: [
        { id: 1, name: 'Write report', duration: 30, running: false, remaining: 1800 },
        { id: 2, name: 'Workout', duration: 45, running: false, remaining: 2700 },
        { id: 3, name: 'Study session', duration: 60, running: false, remaining: 3600 },
      ],
    };
  },
  methods: {
    startTask(task) {
      if (task.running) return;

      task.running = true;
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        task.remaining = task.duration * 60 - elapsed;
        if (task.remaining <= 0) {
          clearInterval(interval);
          task.running = false;
          task.remaining = 0;
          this.notifyUser(task.name + ' is complete!');
        }
      }, 1000);

      // Schedule a notification (basic, can integrate with OneSignal)
      if ('Notification' in window && Notification.permission === 'granted') {
        setTimeout(() => {
          this.notifyUser(`${task.name} is finished!`);
        }, task.duration * 60 * 1000);
      }
    },
    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    },
    notifyUser(message) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      } else {
        new Notification(message);
      }
    },
  },
};
</script>
