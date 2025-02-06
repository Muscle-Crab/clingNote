<template>
  <div class="container">
    <h2>Set a Reminder fjkldjf;djfd</h2>

    <div class="form-container">
      <label for="reminder-title">Reminder Title:</label>
      <input type="text" v-model="reminderTitle" placeholder="Enter reminder title" />

      <label for="reminder-date">Date:</label>
      <input type="date" v-model="reminderDate" />

      <label for="reminder-time">Time:</label>
      <input type="time" v-model="reminderTime" />

      <button @click="setReminder" class="btn add-reminder">
        Add Reminder to Calendar App
      </button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      reminderTitle: "",
      reminderDate: "",
      reminderTime: "",
    };
  },
  methods: {
    setReminder() {
      if (!this.reminderTitle || !this.reminderDate || !this.reminderTime) {
        alert("Please enter all reminder details!");
        return;
      }

      const reminderDateTime = new Date(`${this.reminderDate}T${this.reminderTime}:00`);
      const formattedDate = reminderDateTime.toISOString().split("T")[0];
      const formattedTime = reminderDateTime.toTimeString().split(" ")[0];

      // Check if the user is on an Apple device (iOS/macOS)
      const isAppleDevice = navigator.userAgent.match(/(iPhone|iPad|Macintosh)/i);

      if (isAppleDevice) {
        // Open Apple Reminders App
        const appleReminderUrl = `x-apple-reminderkit://create?title=${encodeURIComponent(
            this.reminderTitle
        )}&dueDate=${formattedDate}T${formattedTime}`;
        window.location.href = appleReminderUrl;
      } else {
        // Open Google Calendar Reminder (Web & Android)
        const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
            this.reminderTitle
        )}&dates=${formattedDate}T${formattedTime.replace(/:/g, "")}Z/${formattedDate}T${formattedTime.replace(
            /:/g,
            ""
        )}Z&details=Reminder%20set%20from%20Vue.js%20app&reminders=1`;
        window.open(googleCalendarUrl, "_blank");
      }
    },
  },
};
</script>

<style scoped>
.container {
  max-width: 400px;
  margin: 50px auto;
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: #fff;
}

h2 {
  color: #333;
  margin-bottom: 20px;
}

.form-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

label {
  margin: 10px 0 5px;
  font-weight: bold;
}

input {
  width: 80%;
  padding: 8px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 14px;
}

.btn {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
  margin: 10px;
}

.add-reminder {
  background: #34a853;
  color: white;
}

.add-reminder:hover {
  background: #2c8c41;
}
</style>
