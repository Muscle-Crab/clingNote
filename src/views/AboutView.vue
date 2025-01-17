<template>
  <div>
    <h1 class="text-xl font-bold">Task Manager</h1>
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

    const addTask = async () => {
      const newTask = {title: `Task ${tasks.value.length + 1}`, completed: false};
      tasks.value.push(newTask);
      speak(`New task added: ${newTask.title}`);
      saveTasks();

      // Notify users about the new task
      await sendNotificationToPlayer('UserName', ['ff823cf5-aef7-4363-82f7-33c1de7ce02e']); // Replace with actual player IDs
    };

    const toggleTaskCompletion = async (index) => {
      const task = tasks.value[index];
      task.completed = !task.completed;
      const status = task.completed ? 'completed' : 'marked incomplete';
      speak(`Task "${task.title}" has been ${status}`);
      saveTasks();

      // Optional: Notify users about task status changes
      await sendNotificationToPlayer('UserName', ['ff823cf5-aef7-4363-82f7-33c1de7ce02e']); // Replace with actual player IDs
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

    const notifyUser = (message) => {
      if (Notification.permission === 'granted') {
        new Notification('Task Reminder', {
          body: message,
          icon: '/path-to-icon.png',
        });
      }
    };

    const startReminders = () => {
      if (reminderInterval) {
        clearInterval(reminderInterval);
      }
      reminderInterval = setInterval(() => {
        const incompleteTasks = tasks.value.filter((task) => !task.completed);
        if (incompleteTasks.length > 0) {
          const taskTitles = incompleteTasks.map((task) => task.title).join(', ');
          const reminderMessage = `You have the following incomplete tasks: ${taskTitles}`;
          notifyUser(reminderMessage);
          speak(reminderMessage);
        } else {
          const completionMessage = 'Great job! All your tasks are completed.';
          notifyUser(completionMessage);
          speak(completionMessage);
        }
      }, 60 * 1000); // 1 minute interval
    };

    const sendNotificationToPlayer = async (userName, playerIds) => {
      const headers = {
        Authorization: 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your actual API key
        'Content-Type': 'application/json',
      };

      const data = {
        app_id: "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
        include_player_ids: playerIds, // Array of player IDs
        contents: {en: `${userName} created a new task!`},
        headings: {en: "New Task Alert"},
      };

      try {
        await axios.post('https://onesignal.com/api/v1/notifications', data, {headers});
        console.log('Notification sent successfully');
      } catch (error) {
        console.error('Error sending notification:', error.response?.data || error.message);
      }
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
