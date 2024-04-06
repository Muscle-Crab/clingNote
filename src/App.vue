<!--<template>-->
<!--  <div>-->
<!--    <router-view></router-view>-->
<!--  </div>-->
<!--</template>-->

<!--<script setup>-->
<!--</script>-->

<!--<style scoped>-->
<!--/* Your CSS styles here */-->
<!--</style>-->

<template>
  <div class="container bg-gray-100 min-h-screen p-4">
    <!-- Calendar display -->
    <div class="calendar bg-white rounded-md shadow-md mb-6 p-3">
      <div class="current-date text-2xl font-bold mb-4">{{ currentDate }}</div>
      <div class="grid grid-cols-7 gap-2">
        <div v-for="(day, index) in days" :key="index" class="day-container flex flex-col items-center justify-center" :class="{ 'bg-gray-200': isToday(index), 'bg-blue-200': isSelected(index) }" @click="selectDate(index)">
          <div class="font-semibold">{{ day.day }}</div>
          <div>{{ day.date }}</div>
        </div>
      </div>
    </div>

    <!-- Daily routine tasks -->
    <div class="daily-routine">
      <h2 class="text-2xl font-bold mb-4">Daily Routine</h2>
      <div v-if="selectedDayRoutine.length === 0" class="text-gray-500">No tasks for selected day.</div>
      <div v-else>
        <div v-for="(task, index) in selectedDayRoutine" :key="index" class="task-card bg-white rounded-lg shadow-md p-4 mb-4">
          <div class="flex items-center mb-2">
            <div :style="{ backgroundColor: generateRandomColor() }" class="w-8 h-8 rounded-full flex items-center justify-center mr-2">
              <i class="fas fa-check text-white"></i>
            </div>
            <div>
              <div class="text-lg font-semibold" :class="{ 'line-through': task.completed }">{{ task.title }}</div>
              <div class="text-sm text-gray-500">{{ task.time }}</div>
            </div>
          </div>
          <button @click="toggleTaskCompletion(index)"  class="text-blue-500">Mark Completed</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import data from '@/data.json';

const selectedDayIndex = ref(-1);

const generateRandomColor = () => {
  // Generate a random color code
  return '#' + Math.floor(Math.random()*16777215).toString(16);
};

const getCurrentDate = () => {
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
};

const currentDate = ref(getCurrentDate());

const weeklyRoutines = data.weeklyRoutines;
const days = data.days;

const isToday = (index) => {
  return index === new Date().getDay();
};

const selectDate = (index) => {
  selectedDayIndex.value = index;
  updateRoutine();
};

const isSelected = (index) => {
  return index === selectedDayIndex.value;
};

const getSelectedDayRoutine = () => {
  return selectedDayIndex.value !== -1 ? weeklyRoutines[selectedDayIndex.value].tasks : [];
};

const selectedDayRoutine = ref([]);

const updateRoutine = () => {
  selectedDayRoutine.value = getSelectedDayRoutine();
};

const toggleTaskCompletion = async (index) => {
  const task = selectedDayRoutine.value[index];
  task.completed = !task.completed;

  if (task.completed) {
    // Find the next incomplete task
    const nextTaskIndex = selectedDayRoutine.value.findIndex(t => !t.completed && t.title !== task.title);

    if (nextTaskIndex !== -1) {
      const nextTask = selectedDayRoutine.value[nextTaskIndex];

      // Speech synthesis for task completion
      const completionMessage = `Task ${task.title} completed. It's time to begin the next task, ${nextTask.title}.`;
      speak(completionMessage);

      // Send notification for the next incomplete task
      try {
        await axios.post(
            'https://onesignal.com/api/v1/notifications',
            {
              app_id: '65d866ad-f59c-4557-9d75-4ccf7fe60a47',
              included_segments: ['All'],
              data: { foo: 'bar' },
              contents: { en: nextTask.title } // Use next task title for notification content
            },
            {
              headers: {
                Authorization: 'Bearer ZWY3MWJhMDUtNTU1Yi00NGViLThmNjItNDNhZTY0YzMwOGRh',
                'Content-Type': 'application/json'
              }
            }
        );

        console.log('Notification sent for task:', nextTask.title);
      } catch (error) {
        console.error('Error sending notification for task:', nextTask.title, error);
      }
    }
  }
};

const speak = (text) => {
  const message = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(message);
};

</script>
