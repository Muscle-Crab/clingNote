<template>
  <div class="container">
    <h2>Calendar Reminder</h2>

    <!-- Event Input Form -->
    <div class="form-container">
      <label for="event-title">Event Title:</label>
      <input type="text" v-model="eventTitle" placeholder="Enter event title" />

      <label for="event-date">Date:</label>
      <input type="date" v-model="eventDate" />

      <label for="event-time">Time:</label>
      <input type="time" v-model="eventTime" />

      <button @click="downloadICSFile" class="btn add-event">
        Add to Calendar App
      </button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      eventTitle: "",
      eventDate: "",
      eventTime: "",
    };
  },
  methods: {
    downloadICSFile() {
      if (!this.eventTitle || !this.eventDate || !this.eventTime) {
        alert("Please enter all event details!");
        return;
      }

      // Convert event date & time to correct format
      const startDateTime = new Date(`${this.eventDate}T${this.eventTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 3600000); // Event duration: 1 hour

      // Format date to YYYYMMDDTHHMMSSZ (UTC time format)
      const formatDate = (date) =>
          date.toISOString().replace(/-|:|\.\d+/g, "");

      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${this.eventTitle}
DESCRIPTION:Reminder set from Vue.js app
DTSTART:${formatDate(startDateTime)}
DTEND:${formatDate(endDateTime)}
LOCATION:Online
BEGIN:VALARM
TRIGGER:-PT0M
ACTION:DISPLAY
DESCRIPTION:Reminder for ${this.eventTitle}
END:VALARM
END:VEVENT
END:VCALENDAR`;

      // Create a downloadable ICS file
      const blob = new Blob([icsContent], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "event.ics";
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
}

.add-event {
  background: #34a853;
  color: white;
}

.add-event:hover {
  background: #2c8c41;
}
</style>
