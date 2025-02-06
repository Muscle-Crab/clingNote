<template>
  <div class="container">
    <h2>Set a Reminder</h2>

    <div class="form-container">
      <label for="reminder-title">Reminder Title Change:</label>
      <input type="text" v-model="reminderTitle" placeholder="Enter reminder title" />

      <label for="reminder-date">Date:</label>
      <input type="date" v-model="reminderDate" />

      <label for="reminder-time">Time:</label>
      <input type="time" v-model="reminderTime" />

      <button @click="sendReminderToCalendar" class="btn add-reminder">
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
    sendReminderToCalendar() {
      if (!this.reminderTitle || !this.reminderDate || !this.reminderTime) {
        alert("Please enter all reminder details!");
        return;
      }

      // Convert the selected date & time to a correct format
      const reminderDateTime = new Date(`${this.reminderDate}T${this.reminderTime}:00`);
      const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, "");

      // Create an ICS file formatted for reminders
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
SUMMARY:${this.reminderTitle}
DESCRIPTION:Reminder from Vue.js app.
DUE:${formatDate(reminderDateTime)}
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR`;

      // Create a Blob for the ICS file
      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);

      // Open the file directly in the Calendar app instead of downloading
      window.location.href = url;
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
