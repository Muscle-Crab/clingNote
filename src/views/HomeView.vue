<template>
  <div ref="scrollContainer" class="container bg-gray-100 min-h-screen p-4">
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
    <!-- Add new task form -->
    <form @submit.prevent="addNewTask" class="mt-4">
      <label for="newTask" class="block mb-2">Task Name:</label>
      <input type="text" v-model="newTask.title" id="newTask" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task name" required>
      <label for="newTaskTime" class="block mb-2">Task Time:</label>
      <input type="time" v-model="newTask.time" id="newTaskTime" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" required>
      <label for="newTaskLabels" class="block mb-2">Task Labels:</label>
      <input type="text" v-model="newTask.labels" id="newTaskLabels" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task labels (comma-separated)">
      <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-md">Add Task</button>
      <div v-if="error" class="text-red-500 mt-2">{{ error }}</div>
    </form>

    <!-- Edit task form -->
    <form v-if="editingTask !== null" @submit.prevent="updateTask" class="mt-4">
      <label for="editTask" class="block mb-2">Edit Task Name:</label>
      <input type="text" v-model="editedTask.title" id="editTask" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" required>
      <label for="editTaskTime" class="block mb-2">Edit Task Time:</label>
      <input type="time" v-model="editedTask.time" id="editTaskTime" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" required>
      <label for="editTaskLabels" class="block mb-2">Edit Task Labels:</label>
      <input type="text" v-model="editedTask.labels" id="editTaskLabels" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task labels (comma-separated)">
      <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-md">Save Changes</button>
    </form>

    <!-- Daily routine tasks -->
    <div class="daily-routine">
      <h2 class="text-2xl font-bold mb-4">Daily Routine</h2>
      <div v-if="selectedDayRoutine.length === 0" class="text-gray-500">No tasks for selected day.</div>
      <div v-else>
        <div class="scroll-container">
          <draggable handle=".drag-handle" :animation="150" v-model="selectedDayRoutine" tag="div" class="tasks-list" ghost-class="ghost" drag-class="drag">
            <template #item="{ element: task, index }">
              <div class="task-card bg-white rounded-lg shadow-md p-4 mb-4" :class="{ 'draggable': taskIsDragging }">
                <div class="flex items-center mb-2">
                  <div>
                    <div :style="{ backgroundColor: generateRandomColor() }" class="w-8 h-8 rounded-full flex items-center justify-center mr-2">
                      <i class="fas fa-arrows-alt text-white drag-handle"></i>
                    </div>
                  </div>
                  <div>
                    <div class="text-lg font-semibold" :class="{ 'line-through': task.completed }">{{ task.title }}</div>
                    <div class="text-sm text-gray-500">{{ task.time }}</div>

                  </div>
                </div>
                <div class="text-sm text-gray-500">

                      <span class="inline-block bg-gray-200 rounded-full px-2 py-1 text-xs font-semibold text-gray-700 mr-2 mb-2" v-for="(label, index) in task.labels" :key="index">
                         {{ label }}
                     </span>
                </div>
                <div class="flex justify-end items-center">
                  <button @click="toggleTaskCompletion(index)" class="text-blue-500 mr-2">
                    <i class="fas fa-check"></i>
                  </button>
                  <button @click="deleteTask(index)" class="text-red-500">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                  <!-- Add an edit button -->
                  <button @click="startEditingTask(index)" class="text-yellow-500 ml-2">
                    <i class="fas fa-edit"></i>
                  </button>
                </div>
                <div v-if="showNotification" class="notification-popup bg-green-500 text-white px-4 py-2 rounded-md absolute top-4 right-4">
                  Create successfully
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import data from '@/data.json';
import draggable from "vuedraggable";

const selectedDayIndex = ref(-1);
const newTask = ref({
  title: '',
  time: '',
  labels: []
});
const error = ref('');
const editingTask = ref(null); // Track the index of the task being edited
const editedTask = ref({ title: '', time: '', labels: [] }); // Store the edited task's data

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

const sortedSelectedDayRoutine = computed(() => {
  return selectedDayRoutine.value.slice().sort((a, b) => {
    return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
  });
});

const deleteTask = (index) => {
  // Remove the task at the specified index
  selectedDayRoutine.value.splice(index, 1);
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

// Call updateRoutine when the component is mounted
onMounted(() => {
  // Get the index of the current day
  const todayIndex = new Date().getDay();
  // If todayIndex is not -1, set the selectedDayIndex to todayIndex
  if (todayIndex !== -1) {
    selectedDayIndex.value = todayIndex;
    updateRoutine();
  }
});

const showNotification = ref(false);

const addNewTask = () => {
  if (newTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return;
  }

  const task = {
    title: newTask.value.title.trim(),
    completed: false,
    time: formatTime(newTask.value.time),
    labels: newTask.value.labels.split(',').map(label => label.trim()) // Parse labels from input string
  };

  selectedDayRoutine.value.push(task);
  selectedDayRoutine.value.sort((a, b) => {
    return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
  });

  newTask.value = {
    title: '',
    time: '',
    labels: []
  };
  error.value = '';

  // Show the notification
  showNotification.value = true;
  // Hide the notification after 3 seconds
  setTimeout(() => {
    showNotification.value = false;
  }, 3000);
};

const formatTime = (time) => {
  const [hours, minutes] = time.split(':');
  const amPm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  const formattedHours = parseInt(hours) % 12 || 12;
  return `${formattedHours}:${minutes} ${amPm}`;
};

const startEditingTask = (index) => {
  editingTask.value = index;
  // Populate the edit form with the task's current data
  editedTask.value.title = selectedDayRoutine.value[index].title;
  editedTask.value.time = selectedDayRoutine.value[index].time;
  editedTask.value.labels = selectedDayRoutine.value[index].labels.join(', '); // Join labels into a string
};

const updateTask = () => {
  if (editedTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return;
  }

  // Update the task with the edited information
  selectedDayRoutine.value[editingTask.value].title = editedTask.value.title.trim();
  selectedDayRoutine.value[editingTask.value].time = formatTime(editedTask.value.time);
  selectedDayRoutine.value[editingTask.value].labels = editedTask.value.labels.split(',').map(label => label.trim()); // Parse labels from input string

  // Clear the edit form and error message
  editingTask.value = null;
  editedTask.value = { title: '', time: '', labels: [] };
  error.value = '';
};

</script>

<style scoped>

.notification-popup {
  transition: opacity 0.5s ease-in-out;
}
.tasks-list {
  cursor: move; /* Show cursor as pointer to indicate draggable */
}
.ghost {
  visibility: hidden;
}

.draggable {
  cursor: grab; /* Show cursor as grab while dragging */
}
.task-card {
  border-left: 3px solid red;
  border-right: 3px solid blue;
}
.drag {
  transform: rotate(5deg);
}
</style>
