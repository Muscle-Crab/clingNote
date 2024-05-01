<template>
  <div ref="scrollContainer" class="p-4 h-[100vh]  overflow-auto" style="background: teal">

     <navi/>
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
    <!-- Modal toggle button -->
    <div class="fixed bottom-12 right-5">
      <button @click="openModal" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        <i class="fas fa-plus"></i> <!-- Font Awesome plus icon -->
      </button>
    </div>
    <div class="task-card bg-white rounded-lg shadow-md p-4 mb-2" :class="{ 'draggable': taskIsDragging }">
      <!-- Existing code... -->
      <div class="text-sm text-gray-500 mb-2">Completion: {{ calculateCompletionPercentage(task) }}%</div>
      <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: calculateCompletionPercentage(task) + '%' }"></div>
      </div>
      <!-- Existing code... -->
    </div>

    <!-- Main modal -->
    <div :class="{ 'hidden': !modalOpen }" @keydown.escape="closeModal" tabindex="-1" aria-hidden="true" class="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-modal md:h-full">
      <!-- Modal content -->
      <div class="relative p-4 w-full max-w-2xl h-full md:h-auto">
        <div class="relative p-4 bg-white rounded-lg shadow dark:bg-gray-800 sm:p-5">
          <!-- Modal header -->
          <div class="flex justify-between items-center pb-4 mb-4 rounded-t border-b sm:mb-5 dark:border-gray-600">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Add Task
            </h3>
            <button @click="closeModal" type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white">
              <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
              <span class="sr-only">Close modal</span>
            </button>
          </div>
          <!-- Modal body -->
          <form @submit.prevent="addNewTask">
            <label for="newTask" class="block mb-2">Task Name:</label>
            <input type="text" v-model="newTask.title" id="newTask" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task name" required>
            <label for="newTaskTime" class="block mb-2">Task Time:</label>
            <input type="time" v-model="newTask.time" id="newTaskTime" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" required>
            <label for="newTaskPriority" class="block mb-2">Task Priority:</label>
            <select v-model="newTask.priority" id="newTaskPriority" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <label for="newTaskLabels" class="block mb-2">Task Labels:</label>
            <input type="text" v-model="newTask.labels" id="newTaskLabels" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task labels (comma-separated)">
            <label for="newTaskNotes" class="block mb-2">Task Notes:</label>
            <textarea v-model="newTask.notes" id="newTaskNotes" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task notes"></textarea>
            <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-md">Add Task</button>
            <div v-if="error" class="text-red-500 mt-2">{{ error }}</div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit task form -->
    <form v-if="editingTask !== null" @submit.prevent="updateTask" class="mt-4">
      <label for="editTask" class="block mb-2">Edit Task Name:</label>
      <input type="text" v-model="editedTask.title" id="editTask" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" required>
      <label for="editTaskTime" class="block mb-2">Edit Task Time:</label>
      <input type="time" v-model="editedTask.time" id="editTaskTime" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" required>
      <label for="editTaskPriority" class="block mb-2">Edit Task Priority:</label>
      <select v-model="editedTask.priority" id="editTaskPriority" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <label for="editTaskLabels" class="block mb-2">Edit Task Labels:</label>
      <input type="text" v-model="editedTask.labels" id="editTaskLabels" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task labels (comma-separated)">
      <label for="editTaskNotes" class="block mb-2">Edit Task Notes:</label>
      <textarea v-model="editedTask.notes" id="editTaskNotes" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Enter task notes"></textarea>
      <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-md">Save Changes</button>
    </form>

<!--    &lt;!&ndash; Search input field &ndash;&gt;-->
<!--    <input type="text" v-model="searchQuery" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" placeholder="Search tasks">-->

    <!-- Daily routine tasks -->
    <div class="daily-routine">
      <h2 class="text-2xl font-bold mb-4">Daily Routine</h2>
      <div v-if="filteredTasks?.length === 0" class="text-gray-500">No tasks match your search.</div>
      <div v-else>
        <div class="scroll-container">
          <draggable handle=".drag-handle" :animation="150" v-model="selectedDayRoutine" tag="div" class="tasks-list" ghost-class="ghost" drag-class="drag" @end="handleDragEnd">
            <template #item="{ element: task, index }">
              <div class="task-card bg-white rounded-lg shadow-md p-4 mb-2" :class="{ 'draggable': taskIsDragging }">
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
                <h2>{{ formatTimes(index)}}</h2>

                <div class="flex items-center">
                  <svg v-if="task.priority === 'high'" class="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"></path>
                  </svg>
                  <svg v-else-if="task.priority === 'medium'" class="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"></path>
                  </svg>
                  <svg v-else-if="task.priority === 'low'" class="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"></path>
                  </svg>
                </div>
                <div class="text-sm text-gray-500">{{ task.notes }}</div>
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
                  <!-- Add a play button -->
                  <button @click="startTimer(index)" v-if="!isRunning[index]" class="text-green-500 ml-2">
                    <i class="fas fa-play"></i>
                  </button>
                  <!-- Stop timer button -->
                  <button @click="stopTimer(index)" v-if="isRunning[index]" class="text-red-500 ml-2">
                    <i class="fas fa-stop"></i>
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
import { ref, onMounted, computed, reactive } from 'vue';
import axios from 'axios'
import navi from '@/components/nav.vue'
import data from '@/data.json';
import draggable from "vuedraggable";
import {db} from '@/firebaseConfig'; // Assuming you have imported the Firebase setup file and exported the db instance
import {collection, doc, setDoc, serverTimestamp, getDoc, updateDoc} from 'firebase/firestore';
const modalOpen = ref(false);


// Define reactive state
const isRunning = ref([]);
const currentTime = ref([]);
const duration = ref(60); // Duration in seconds
const timers = [];

// Define function to format time
const formatTimes = (index) => {
  // Ensure currentTime[index] is defined and not NaN
  if (typeof currentTime.value[index] === 'undefined' || isNaN(currentTime.value[index])) {
    return '00:00';
  }

  // Format remaining time as MM:SS
  const minutes = Math.floor(currentTime.value[index] / 60);
  const seconds = currentTime.value[index] % 60;
  return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Define function to start timer
const startTimer = (index) => {
  // If the timer is already running, pause it
  if (isRunning.value[index]) {
    pauseTimer(index);
    return;
  }

  // Start the timer
  isRunning.value[index] = true;
  timers[index] = setInterval(() => {
    if (currentTime.value[index] < duration.value) {
      currentTime.value[index]++;

    } else {
      stopTimer(index);
    }
  }, 1000);
};


// Define function to stop timer
const stopTimer = (index) => {
  if (isRunning.value[index]) {
    clearInterval(timers[index]);
    isRunning.value[index] = false;
    currentTime.value[index] = 0;
  }
};
const closeModal = () => {
  modalOpen.value = false;
};
const selectedDayIndex = ref(-1);
const newTask = ref({
  title: '',
  time: '',
  priority: 'low',
  labels: [],
  notes: ''
});
const error = ref('');
const editingTask = ref(null);
const editedTask = ref({title: '', time: '', priority: 'low', labels: [], notes: ''});
const searchQuery = ref('');

const generateRandomColor = () => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
};

const getCurrentDate = () => {
  const options = {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'};
  return new Date().toLocaleDateString('en-US', options);
};

const currentDate = ref(getCurrentDate());

let weeklyRoutines = [];

const fetchSelectedDayRoutine = async () => {
  try {
    if (selectedDayIndex.value !== -1) {
      const selectedDayDocRef = doc(db, 'weeklyRoutines', days[selectedDayIndex.value].day);
      const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);
      if (selectedDayDocSnapshot.exists()) {
        selectedDayRoutine.value = selectedDayDocSnapshot.data().tasks;
      } else {
        selectedDayRoutine.value = []; // No tasks for this day
      }
    }
  } catch (error) {
    console.error('Error fetching selected day routine:', error);
  }
};
const days = data.days;

const isToday = (index) => {
  return index === new Date().getDay();
};

const selectDate = (index) => {
  selectedDayIndex.value = index;
  updateRoutine();
  fetchSelectedDayRoutine();
};

const isSelected = (index) => {
  return index === selectedDayIndex.value;
};

const getSelectedDayRoutine = () => {
  return selectedDayIndex.value !== -1 ? weeklyRoutines?.tasks : [];
};

const selectedDayRoutine = ref([]);

const updateRoutine = () => {
  selectedDayRoutine.value = getSelectedDayRoutine();
  fetchSelectedDayRoutine();

};

const sortedSelectedDayRoutine = computed(() => {
  return selectedDayRoutine.value.slice().sort((a, b) => {
    return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
  });
});

const deleteTask = async (index) => {
  try {
    // Get the reference to the document containing the tasks for the selected day
    const selectedDayDocRef = doc(db, 'weeklyRoutines', days[selectedDayIndex.value].day);

    // Fetch the document snapshot
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    // Check if the document exists
    if (selectedDayDocSnapshot.exists()) {
      // Remove the task from the array in memory
      selectedDayRoutine.value.splice(index, 1);

      // Update the tasks in the Firestore document
      await updateDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

const toggleTaskCompletion = async (index) => {
  const task = selectedDayRoutine.value[index];
  task.completed = !task.completed;

  if (task.completed) {
    const nextTaskIndex = selectedDayRoutine.value.findIndex(t => !t.completed && t.title !== task.title);

    if (nextTaskIndex !== -1) {
      const nextTask = selectedDayRoutine.value[nextTaskIndex];
      const completionMessage = `Task ${task.title} completed. It's time to begin the next task, ${nextTask.title}.`;
      // speak(completionMessage);
      showNotification.value = true;
    }
  }
};
const handleDragEnd = async () => {
  try {
    const selectedDayDocRef = doc(db, 'weeklyRoutines', days[selectedDayIndex.value].day);
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      await updateDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating task order:', error);
  }
};
const speak = (text) => {
  const message = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(message);
};

onMounted(() => {
  const todayIndex = new Date().getDay();
  if (todayIndex !== -1) {
    selectedDayIndex.value = todayIndex;
    updateRoutine();
    fetchSelectedDayRoutine();
  }
});

const showNotification = ref(false);

const addNewTask = async () => {
  if (newTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return;
  }

  const task = {
    title: newTask.value.title.trim(),
    completed: false,
    time: formatTime(newTask.value.time),
    priority: newTask.value.priority,
    labels: newTask.value.labels.split(',').map(label => label.trim()),
    notes: newTask.value.notes
  };

  try {
    const selectedDayDocRef = doc(db, 'weeklyRoutines', days[selectedDayIndex.value].day);
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      await updateDoc(selectedDayDocRef, {
        tasks: [...selectedDayDocSnapshot.data().tasks, task],
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(selectedDayDocRef, {
        day: days[selectedDayIndex.value].day,
        tasks: [task],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    selectedDayRoutine.value.push(task);
    selectedDayRoutine.value.sort((a, b) => {
      return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
    });

    newTask.value = {
      title: '',
      time: '',
      priority: 'low',
      labels: [],
      notes: ''
    };
    error.value = '';

    showNotification.value = true;
    setTimeout(() => {
      showNotification.value = false;
    }, 3000);
  } catch (error) {
    console.error('Error adding task to Firestore:', error);
  }
};

const formatTime = (time) => {
  const [hours, minutes] = time.split(':');
  const amPm = parseInt(hours) >= 12 ? 'PM' : 'AM';
  const formattedHours = parseInt(hours) % 12 || 12;
  return `${formattedHours}:${minutes} ${amPm}`;
};

const startEditingTask = (index) => {
  editingTask.value = index;
  const task = selectedDayRoutine.value[index];
  editedTask.value.title = task.title;
  editedTask.value.time = task.time;
  editedTask.value.priority = task.priority;
  editedTask.value.labels = task.labels.join(', ');
  editedTask.value.notes = task.notes;
};

const updateTask = async () => {
  if (editedTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return;
  }

  const index = editingTask.value;

  try {
    // Get the reference to the document containing the tasks for the selected day
    const selectedDayDocRef = doc(db, 'weeklyRoutines', days[selectedDayIndex.value].day);

    // Fetch the document snapshot
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    // Check if the document exists
    if (selectedDayDocSnapshot.exists()) {
      // Update the task in the array in memory
      selectedDayRoutine.value[index].title = editedTask.value.title.trim();
      selectedDayRoutine.value[index].time = formatTime(editedTask.value.time);
      selectedDayRoutine.value[index].priority = editedTask.value.priority;
      selectedDayRoutine.value[index].labels = editedTask.value.labels.split(',').map(label => label.trim());
      selectedDayRoutine.value[index].notes = editedTask.value.notes;

      // Update the tasks in the Firestore document
      await updateDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value,
        updatedAt: serverTimestamp()
      });

      // Reset editingTask and editedTask
      editingTask.value = null;
      editedTask.value = {
        title: '',
        time: '',
        priority: 'low',
        labels: [],
        notes: ''
      };

      error.value = ''; // Reset error message
    }
  } catch (error) {
    console.error('Error updating task:', error);
  }
};

const filteredTasks = computed(() => {
  let tasksToFilter = selectedDayRoutine.value;

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase();
    return selectedDayRoutine.value.filter(task => {
      return task.title.toLowerCase().includes(query) ||
          task.time.toLowerCase().includes(query) ||
          task.priority.toLowerCase().includes(query) ||
          task.labels.some(label => label.toLowerCase().includes(query)) ||
          task.notes.toLowerCase().includes(query);
    });
  }
});
const calculateCompletionPercentage = (task) => {
  if (!selectedDayRoutine.value) {
    return 0; // Return 0 if selectedDayRoutine is not yet defined
  }

  const completedTasks = selectedDayRoutine.value.filter(t => t.completed).length;
  const totalTasks = selectedDayRoutine.value.length;
  return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
};
const priorityClass = (priority) => {
  switch (priority) {
    case 'high':
      return 'text-red-500 font-bold';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-gray-500';
    default:
      return '';
  }
};
</script>


<style scoped>
.notification-popup {
  transition: opacity 0.5s ease-in-out;
}

.tasks-list {
  cursor: move;
}

.ghost {
  visibility: hidden;
}

.draggable {
  cursor: grab;
}
.task-card {
  border-left: 3px solid red;
  border-right: 3px solid blue;
}
.drag {
  transform: rotate(5deg);
}
</style>
