<template>
  <div>
    <h1 class="text-xl font-bold">Task Manager fkdjjfkd</h1>
    <div v-for="(task, index) in tasks" :key="index" class="p-4 border rounded my-2">
      <h2>{{ task.title }}</h2>
      <p>
        Status:
        <span :class="{ 'text-green-500': task.completed, 'text-red-500': !task.completed }">
          {{ task.completed ? 'Completed' : 'Incomplete' }}
        </span>
      </p>
      <button @click="toggleTaskCompletion(index)" class="bg-blue-500 text-white px-2 py-1 rounded">
        {{ task.completed ? 'Mark Incomplete' : 'Mark Complete' }}
      </button>
    </div>
    <button @click="addTask" class="bg-green-500 text-white px-4 py-2 rounded mt-4">Add Task</button>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';

export default {
  name: 'TaskManager',
  setup() {
    const tasks = ref([
      {title: 'Complete project report', completed: false},
      {title: 'Buy groceries', completed: false},
    ]);

    let reminderInterval = null;

    const addTask = () => {
      const newTask = {title: `Task ${tasks.value.length + 1}`, completed: false};
      tasks.value.push(newTask);
      speak(`New task added: ${newTask.title}`);
      saveTasks();
    };

    const toggleTaskCompletion = (index) => {
      const task = tasks.value[index];
      task.completed = !task.completed;
      const status = task.completed ? 'completed' : 'marked incomplete';
      speak(`Task "${task.title}" has been ${status}`);
      saveTasks();
    };

    const saveTasks = () => {
      localStorage.setItem('tasks', JSON.stringify(tasks.value));
    };

    const loadTasks = () => {
      const savedTasks = JSON.parse(localStorage.getItem('tasks'));
      if (savedTasks) {
        tasks.value = savedTasks;
      }
    };

    const speak = (text) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    };

    const sendNotificationToPlayer = async (message) => {
      const headers = {
        Authorization: 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your actual REST API key
        'Content-Type': 'application/json',
      };

      const data = {
        app_id: 'fc206a71-7d65-4cfa-b8b2-0c10548e1476', // Replace with your OneSignal App ID
        included_segments: ['Subscribed Users'], // Notify all subscribed users
        headings: {en: 'Task Reminder'},
        contents: {en: message},
      };

      try {
        await axios.post('https://onesignal.com/api/v1/notifications', data, {headers});
        console.log('Notification sent successfully');
      } catch (error) {
        console.error('Error sending notification:', error.response?.data || error.message);
      }
    };

    const startReminders = () => {
      if (reminderInterval) {
        clearInterval(reminderInterval);
      }

      reminderInterval = setInterval(async () => {
        const incompleteTasks = tasks.value.filter((task) => !task.completed);
        if (incompleteTasks.length > 0) {
          const taskTitles = incompleteTasks.map((task) => task.title).join(', ');
          const reminderMessage = `You have the following incomplete tasks: ${taskTitles}`;
          await sendNotificationToPlayer(reminderMessage);
          speak(reminderMessage);
        } else {
          const completionMessage = 'Great job! All your tasks are completed.';
          await sendNotificationToPlayer(completionMessage);
          speak(completionMessage);
        }
      }, 60 * 1000); // Sends a notification every minute
    };

    onMounted(() => {
      loadTasks();
      startReminders();
      Notification.requestPermission();
    });

    onUnmounted(() => {
      if (reminderInterval) clearInterval(reminderInterval);
    });

    return {
      tasks,
      addTask,
      toggleTaskCompletion,
    };
  },
};
</script>

<style scoped>
h1 {
  color: #1a202c;
}
</style>
