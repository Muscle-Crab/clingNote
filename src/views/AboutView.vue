<template>
  <div>
    <h1 class="text-xl font-bold">Task Manager</h1>
    <div v-for="(task, index) in tasks" :key="index" class="p-4 border rounded my-2">
      <h2>{{ task.title }}</h2>
      <p>Status: <span :class="{ 'text-green-500': task.completed, 'text-red-500': !task.completed }">{{ task.completed ? 'Completed' : 'Incomplete' }}</span></p>
      <button @click="toggleTaskCompletion(index)" class="bg-blue-500 text-white px-2 py-1 rounded">
        {{ task.completed ? 'Mark Incomplete' : 'Mark Complete' }}
      </button>
    </div>
    <button @click="addTask" class="bg-green-500 text-white px-4 py-2 rounded mt-4">Add Task</button>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';

export default {
  name: 'TaskManager',
  setup() {
    const tasks = ref([
      { title: 'Complete project report', completed: false },
      { title: 'Buy groceries', completed: false },
    ]);

    let reminderInterval = null;

    const addTask = () => {
      const newTask = { title: `Task ${tasks.value.length + 1}`, completed: false, synced: false };
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

    const startReminders = () => {
      // Clear any existing interval to prevent duplicates
      if (reminderInterval) {
        clearInterval(reminderInterval);
      }

      // Set up a new interval to run every 5 minutes
      reminderInterval = setInterval(() => {
        const incompleteTasks = tasks.value.filter((task) => !task.completed);
        if (incompleteTasks.length > 0) {
          const taskTitles = incompleteTasks.map((task) => task.title).join(', ');
          speak(`Reminder: You have the following incomplete tasks: ${taskTitles}`);
        } else {
          speak('Great job! All your tasks are completed.');
        }
      }, 5 * 60 * 1000); // 5 minutes in milliseconds
    };

    const stopReminders = () => {
      if (reminderInterval) {
        clearInterval(reminderInterval);
      }
    };

    onMounted(() => {
      loadTasks();
      startReminders(); // Start reminders when the component is mounted
    });

    onUnmounted(() => {
      stopReminders(); // Stop reminders when the component is unmounted
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
