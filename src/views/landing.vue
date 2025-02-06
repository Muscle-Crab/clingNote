<template>
  <div class="container">
    <h2>Set a Reminder</h2>

    <!-- Reminder Input Form -->
    <div class="form-container">
      <label for="reminder-title">Reminder Title:</label>
      <input type="text" v-model="reminderTitle" placeholder="Enter reminder title" />

      <label for="reminder-date">Date:</label>
      <input type="date" v-model="reminderDate" />

      <label for="reminder-time">Time:</label>
      <input type="time" v-model="reminderTime" />

      <button @click="setReminderInGoogleCalendar" class="btn google-calendar">
        Add Reminder to Google Calendar
      </button>

      <button @click="downloadReminderICSFile" class="btn add-reminder">
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
    // 1️⃣ Add Reminder to Google Calendar (No Login Required)
    setReminderInGoogleCalendar() {
      if (!this.reminderTitle || !this.reminderDate || !this.reminderTime) {
        alert("Please enter all reminder details!");
        return;
      }

      // Format date and time
      const dateTime = new Date(`${this.reminderDate}T${this.reminderTime}`).toISOString().replace(/-|:|\.\d+/g, "");

      // Encode the details for URL
      const title = encodeURIComponent(this.reminderTitle);
      const details = encodeURIComponent("Reminder set from Vue.js app.");
      const location = encodeURIComponent("Online");

      // Google Calendar reminder link
      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dateTime}/${dateTime}`;

      // Open Google Calendar with pre-filled reminder
      window.open(googleCalendarUrl, "_blank");
    },

    // 2️⃣ Add Reminder to Default Calendar App (iOS, Android, Windows)
    downloadReminderICSFile() {
      if (!this.reminderTitle || !this.reminderDate || !this.reminderTime) {
        alert("Please enter all reminder details!");
        return;
      }

      // Format date & time
      const reminderDateTime = new Date(`${this.reminderDate}T${this.reminderTime}:00`);
      const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, "");

      // Create an ICS file formatted as a reminder
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
SUMMARY:${this.reminderTitle}
DESCRIPTION:Reminder set from Vue.js app.
DUE:${formatDate(reminderDateTime)}
END:VTODO
END:VCALENDAR`;

      // Create and download ICS file
      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "reminder.ics";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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

.google-calendar {
  background: #4285f4;
  color: white;
}

.google-calendar:hover {
  background: #357ae8;
}

.add-reminder {
  background: #34a853;
  color: white;
}

.add-reminder:hover {
  background: #2c8c41;
}
</style>
