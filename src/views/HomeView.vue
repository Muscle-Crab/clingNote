<template>
  <div ref="scrollContainer" class="h-[100vh] overflow-auto bg-gray-100 p-3"  >

    <div
        class="streak-display p-2 rounded-lg shadow-md mb-2 text-center flex flex-col items-center justify-center"
        :class="{
    'bg-yellow-100': streak < 3,
    'bg-green-100': streak >= 3 && streak < 7,
    'bg-blue-100': streak >= 7
  }"
    >
      <!-- Streak and Badge Icons Row -->
      <!-- Streak and Badge Icons Row -->
      <div v-if="streak === 0" class="flex flex-col items-center justify-center">
        <div class="text-4xl">😢</div>
        <h2 class="text-lg font-bold text-red-500">No streak yet!</h2>
        <p class="text-sm text-gray-600">Complete today's tasks to start a new streak!</p>
      </div>
      <div v-else class="flex items-center justify-between w-full">
        <h2 class="text-lg font-bold">Streak: {{ streak }} days</h2>

        <!-- Display badges if unlocked -->
        <div v-if="unlockedBadges.length > 0" class="flex space-x-2">
    <span
        v-for="badge in unlockedBadges"
        :key="badge.days"
        class="text-2xl badge-icon"
    >
      {{ badge.icon }}
    </span>
        </div>
      </div>

      <!-- Motivational Message -->
      <p class="text-sm text-gray-700 mt-1">{{ motivationalMessage }}</p>
    </div>
    <!-- Calendar display -->
    <div class="calendar-task-card bg-white rounded-2xl mb-2 shadow-lg p-2 mb-2 w-full max-w-4xl mx-auto">
      <!-- Calendar Section -->
      <div class="calendar-section mb-2">
        <div class="current-date font-bold text-gray-900 mb-4">
          {{ currentDate }}
        </div>
        <div class="grid grid-cols-7 gap-3">
          <div
              v-for="(day, index) in days"
              :key="index"
              class="day-container flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all duration-300"
              :class="{
          'bg-gray-100 border border-gray-300': !isToday(index) && !isSelected(index),
          'bg-blue-200 text-white': isSelected(index),
          'bg-blue-500 text-white font-bold shadow-inner': isToday(index)
        }"
              @click="selectDate(index)"
          >
            <div class="text-lg">{{ day.day }}</div>
            <div class="text-sm">{{ day.date }}</div>
          </div>
        </div>
      </div>

      <!-- Task Completion Section -->

      <div class="milestone-journey w-full h-auto relative p-6   rounded-lg ">
        <!-- Animated Progress Bar -->
        <div class="relative w-full h-[2px] bg-gray-300 rounded-full">
          <div
              class="absolute h-full bg-blue-500 transition-all duration-700 ease-out"
              :style="{ width: calculateCompletionPercentage(task) + '%' }"
          ></div>
        </div>

        <!-- Milestones with icons and labels -->
        <div
            v-for="(milestone, index) in milestones"
            :key="index"
            class="flex flex-col items-center absolute top-0 transform -translate-x-1/2"
            :style="{
      left: index === 0
        ? '0%'    /* First icon aligns perfectly to the left */
        : index === milestones.length - 1
        ? '100%'  /* Last icon aligns perfectly to the right */
        : `${milestone.position}%`,
      transform: index === 0
        ? 'translateX(0)' /* Remove extra margin for the first icon */
        : index === milestones.length - 1
        ? 'translateX(-100%)' /* Adjust for the last icon */
        : 'translateX(-50%)',
    }"
        >
          <!-- Milestone Icon -->
          <div
              class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-1 transition-transform duration-500"
              :class="{
        'bg-blue-500 scale-110': calculateCompletionPercentage(task) >= milestone.percent,
        'bg-gray-400 scale-100': calculateCompletionPercentage(task) < milestone.percent,
      }"
          >
            <div
                class="text-xl sm:text-2xl transition-transform duration-500"
                :class="{ 'animate-bounce': calculateCompletionPercentage(task) >= milestone.percent }"
            >
              {{ milestone.icon }}
            </div>
          </div>


        </div>

        <!-- Percentage Display -->
        <div class="absolute top-[-2rem] right-4 bg-blue-100 text-blue-600 px-4 py-1 rounded-full shadow-md text-sm sm:text-base">
          Progress: {{ calculateCompletionPercentage(task) }}%
        </div>
      </div>



    </div>
    <!-- Modal toggle button -->
    <div class="fixed bottom-12 right-5 z-50">
      <button
          @click="openModal"
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-full shadow-lg transition-transform transform hover:scale-105"
      >
        <i class="fas fa-plus"></i> <!-- Font Awesome plus icon -->
      </button>
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
            <input type="text" v-model="newTask.title" id="newTask" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2 text-[16px]" placeholder="Enter task name" required>
            <label for="newTaskTime" class="block mb-2">Task Time:</label>
            <input type="time" v-model="newTask.time" id="newTaskTime" class="w-full border-gray-300 rounded-md px-4 py-2 mb-2" >
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
    <div class="daily-routine   min-h-screen">
      <div v-if="filteredTasks?.length === 0" class="text-gray-500 text-center mt-8">
        No tasks match your search.
      </div>
      <div v-else>
        <div class="scroll-container overflow-y-auto h-[80vh]">
          <draggable
              handle=".drag-handle"
              :animation="150"
              v-model="selectedDayRoutine"
              tag="div"
              class="tasks-list space-y-2"
              ghost-class="ghost"
              drag-class="drag"
              @end="handleDragEnd"
          >
            <template #item="{ element: task, index }">
              <div
                  class="task-card bg-white rounded-xl shadow-lg p-5 relative hover:shadow-xl transition-shadow duration-300"
                  :class="{ 'draggable': taskIsDragging }"
              >
                <div class="flex items-center mb-3">
                  <!-- Drag Icon -->
                  <div>
                    <div
                        :style="{ backgroundColor: generateRandomColor() }"
                        class="w-10 h-10 rounded-full flex items-center justify-center mr-3 shadow-sm"
                    >
                      <i class="fas fa-arrows-alt text-white drag-handle"></i>
                    </div>
                  </div>

                  <!-- Task Title and Time -->
                  <div>
                    <div
                        class="text-lg font-semibold text-gray-800"
                        :class="{ 'line-through text-gray-500': task.completed }"
                    >
                      {{ task.title }}
                    </div>
<!--                    <div v-if="task.time" class="text-sm text-gray-400">{{ task.time }}</div>-->
                    <!-- User Icon and Name with Spinning Icon -->
                    <div class="flex items-center space-x-2 text-xs">
                      <!-- Incomplete Task Indicator -->
                      <div v-if="!task.completed && index !== topIncompleteTaskIndex" class="text-yellow-500">
                        <i class="fas fa-circle"></i> Incomplete
                      </div>

                      <!-- In Progress Task Indicator -->
                      <div v-if="index === topIncompleteTaskIndex" class="text-blue-500 flex items-center">
                        <i class="fas fa-hourglass-half animate-spin-slow mr-1"></i> In Progress
                      </div>

                      <!-- Completed Task Indicator -->
                      <div v-if="task.completed" class="text-green-500">
                        <i class="fas fa-check-circle"></i> Completed
                      </div>
                    </div>

                  </div>
                </div>



                <!-- Task Priority -->
<!--                <div class="flex items-center space-x-2 mb-3">-->
<!--                  <svg-->
<!--                      v-if="task.priority === 'high'"-->
<!--                      class="h-5 w-5 text-red-500"-->
<!--                      fill="none"-->
<!--                      stroke="currentColor"-->
<!--                      viewBox="0 0 24 24"-->
<!--                      xmlns="http://www.w3.org/2000/svg"-->
<!--                  >-->
<!--                    <path-->
<!--                        stroke-linecap="round"-->
<!--                        stroke-linejoin="round"-->
<!--                        stroke-width="2"-->
<!--                        d="M5 11l7-7 7 7M5 19l7-7 7 7"-->
<!--                    ></path>-->
<!--                  </svg>-->
<!--                  <svg-->
<!--                      v-else-if="task.priority === 'medium'"-->
<!--                      class="h-5 w-5 text-purple-500"-->
<!--                      fill="none"-->
<!--                      stroke="currentColor"-->
<!--                      viewBox="0 0 24 24"-->
<!--                      xmlns="http://www.w3.org/2000/svg"-->
<!--                  >-->
<!--                    <path-->
<!--                        stroke-linecap="round"-->
<!--                        stroke-linejoin="round"-->
<!--                        stroke-width="2"-->
<!--                        d="M5 11l7-7 7 7M5 19l7-7 7 7"-->
<!--                    ></path>-->
<!--                  </svg>-->
<!--                  <svg-->
<!--                      v-else-if="task.priority === 'low'"-->
<!--                      class="h-5 w-5 text-yellow-500"-->
<!--                      fill="none"-->
<!--                      stroke="currentColor"-->
<!--                      viewBox="0 0 24 24"-->
<!--                      xmlns="http://www.w3.org/2000/svg"-->
<!--                  >-->
<!--                    <path-->
<!--                        stroke-linecap="round"-->
<!--                        stroke-linejoin="round"-->
<!--                        stroke-width="2"-->
<!--                        d="M5 11l7-7 7 7M5 19l7-7 7 7"-->
<!--                    ></path>-->
<!--                  </svg>-->
<!--                </div>-->

                <!-- Task Labels -->
                <div class="flex flex-wrap gap-2 mb-3">
      <span
          class="inline-block bg-gray-200 rounded-full px-3 py-1 text-xs font-medium text-gray-600"
          v-for="(label, index) in task.labels"
          :key="index"
      >
        {{ label }}
      </span>
                </div>

                <!-- User Icon and Name Inline with Task Actions -->
                <div class="flex items-center justify-between mb-3">
                  <!-- User Icon and Name -->
                  <div class="flex">
                    <i class="fas fa-user  "></i>
                    <div class="text-sm font-medium text-gray-700 ml-1">{{ task.userName }}</div>
                  </div>

                  <!-- Task Actions -->
                  <div class="flex items-center space-x-3">
                    <button
                        @click="toggleTaskCompletion(index)"
                        class="text-green-500 hover:text-green-700"
                    >
                      <i class="fas fa-check"></i>
                    </button>
                    <button
                        @click="deleteTask(index)"
                        class="text-red-500 hover:text-red-700"
                    >
                      <i class="fas fa-trash-alt"></i>
                    </button>
                    <button
                        @click="startEditingTask(index)"
                        class="text-yellow-500 hover:text-yellow-700"
                    >
                      <i class="fas fa-edit"></i>
                    </button>
                  </div>
                </div>


                <!-- Notification -->
                <div
                    v-if="showNotification"
                    class="notification-popup bg-green-500 text-white px-4 py-2 rounded-md absolute top-4 right-4 shadow-lg"
                >
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
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { auth } from '@/firebaseConfig'; // Assuming you have Firebase authentication configured
import { onAuthStateChanged } from 'firebase/auth';
import data from '@/data.json';
import draggable from "vuedraggable";
import {db} from '@/firebaseConfig'; // Assuming you have imported the Firebase setup file and exported the db instance
import {collection, doc, setDoc, serverTimestamp, getDoc, updateDoc} from 'firebase/firestore';
const modalOpen = ref(false);
import axios from 'axios';

// Define reactive state
const isRunning = ref([]);
const currentTime = ref([]);
const duration = ref(60 * 60); // Duration in seconds
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
const fetchUserName = async (userId) => {
  try {
    const userDocRef = doc(db, 'users', userId); // Ensure you have a `users` collection
    const userDocSnapshot = await getDoc(userDocRef);

    if (userDocSnapshot.exists()) {
      return userDocSnapshot.data().name; // Assuming the user's name is stored under `name`
    } else {
      console.warn('User document not found');
      return 'Unknown User';
    }
  } catch (error) {
    console.error('Error fetching user name:', error);
    return 'Error Fetching User';
  }
};

const sendNotificationToPlayer = async (userName) => {
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your actual API key
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    "include_player_ids": ["ff823cf5-aef7-4363-82f7-33c1de7ce02e"],
    "contents": { "en": `${userName} created a new task!` },
    "headings": { "en": "New Task Alert" }
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};





const openModal = () => {
  modalOpen.value = true;
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
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', options).format(today);
};
const generateWeekDates = () => {
  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
  const week = [];

  for (let i = 0; i < 7; i++) {
    const diff = i - currentDayIndex;
    const day = new Date(today);
    day.setDate(today.getDate() + diff);

    // Format the date as YYYY-MM-DD in local time
    const formattedDate = day.toLocaleDateString('en-CA'); // 'en-CA' formats as YYYY-MM-DD
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day);

    week.push({ day: dayName, date: formattedDate });
  }

  days.value = week;
};


// Call this function when the component is mounted
onMounted(() => {
  generateWeekDates();
  console.log('Generated days array:', days.value);
});

const currentDate = ref(getCurrentDate());

let weeklyRoutines = [];

const fetchSelectedDayRoutine = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      const tasks = selectedDayDocSnapshot.data().tasks || [];

      // Fetch user names for each task
      const tasksWithUserNames = await Promise.all(
          tasks.map(async (task) => {
            try {
              const userDocRef = doc(db, 'users', task.userId);
              const userDocSnapshot = await getDoc(userDocRef);

              if (userDocSnapshot.exists()) {
                const userName = userDocSnapshot.data().name;
                return { ...task, userName };
              } else {
                return { ...task, userName: 'Unknown User' };
              }
            } catch (error) {
              console.error('Error fetching user name:', error);
              return { ...task, userName: 'Error Fetching User' };
            }
          })
      );

      selectedDayRoutine.value = tasksWithUserNames;
    } else {
      selectedDayRoutine.value = []; // No tasks for this user and day
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
  }
};
const days = data.days;

const isToday = (index) => {
  return index === new Date().getDay();
};
// Function to update the displayed current date
const updateCurrentDate = () => {
  if (selectedDayIndex.value !== -1) {
    const selectedDay = days.value[selectedDayIndex.value];
    if (selectedDay && selectedDay.date) {
      // Parse the date safely to avoid time zone issues
      const [year, month, day] = selectedDay.date.split('-'); // Split YYYY-MM-DD
      const fullDate = new Date(year, month - 1, day); // Create a Date object with zero-based month

      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      currentDate.value = new Intl.DateTimeFormat('en-US', options).format(fullDate);
    }
  }
};



// Watch for tab (day) changes and update the current date
watch(selectedDayIndex, updateCurrentDate);

// On mounted, set the initial date to today's tab
onMounted(() => {
  const todayIndex = new Date().getDay();
  selectedDayIndex.value = todayIndex; // Initialize to today's tab
  updateCurrentDate(); // Update the displayed current date
});
const selectDate = (index) => {
  selectedDayIndex.value = index;
  updateRoutine();
  updateCurrentDate()
  fetchSelectedDayRoutine();
};

const isSelected = (index) => {
  return index === selectedDayIndex.value;
};

const getSelectedDayRoutine = () => {
  return selectedDayIndex.value !== -1 ? weeklyRoutines?.tasks : [];
};



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
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

  try {
    selectedDayRoutine.value.splice(index, 1);

    await updateDoc(selectedDayDocRef, {
      tasks: selectedDayRoutine.value,
      updatedAt: serverTimestamp()
    });

    console.log('Task deleted successfully');
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};
// Computed property to get the index of the top-most incomplete task
const topIncompleteTaskIndex = computed(() => {
  return selectedDayRoutine.value.findIndex((task) => !task.completed);
});

const toggleTaskCompletion = async (index) => {
  const task = { ...selectedDayRoutine.value[index] }; // Create a copy of the task to avoid direct mutation
  task.completed = !task.completed; // Toggle the completed state
  startSpinning(index);

  // Voice response when task is completed or marked incomplete
  if (task.completed) {
    speak(`Great job! You completed the task: ${task.title}.`);
    announceNextTask(); // Announce the next task
  } else {
    speak(`You have marked the task: ${task.title} as incomplete.`);
  }

  selectedDayRoutine.value.splice(index, 1, task); // Update the task locally

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      const tasks = selectedDayDocSnapshot.data().tasks || [];
      tasks[index] = task; // Update the task at the correct index

      await updateDoc(selectedDayDocRef, {
        tasks: tasks,
        updatedAt: serverTimestamp()
      });

      console.log('Task completion updated successfully');
    }
  } catch (error) {
    console.error('Error updating task completion:', error);
  }

  // Check streak after toggling task completion
  checkStreakOnCompletion();
};






const handleDragEnd = async () => {
  if (selectedDayIndex.value === -1 || !userId.value) {
    console.error('No selected day or user is not logged in');
    return;
  }

  try {
    // Reference the Firestore document for the selected day and user
    const selectedDayDocRef = doc(
        db,
        'weeklyRoutines',
        `${userId.value}_${days[selectedDayIndex.value].day}`
    );

    // Check if the document exists before updating
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      await updateDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value, // Save the reordered tasks
        updatedAt: serverTimestamp(),   // Update the timestamp
      });
      console.log('Task order updated successfully in Firestore');
    } else {
      console.warn('Selected day document does not exist. Creating a new one...');
      // Create a new document if it does not exist
      await setDoc(selectedDayDocRef, {
        tasks: selectedDayRoutine.value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('New document created and task order saved.');
    }
  } catch (error) {
    console.error('Error updating task order:', error);
  }
};

const speak = (text) => {
  const message = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(message);
};
const announceNextTask = () => {
  const nextTask = selectedDayRoutine.value.find((task) => !task.completed);
  if (nextTask) {
    speak(`Your next task is: ${nextTask.title}.`);
  } else {
    speak("Congratulations! All tasks are complete.");
  }
};

onMounted(() => {
  const todayIndex = new Date().getDay();
  if (todayIndex !== -1) {
    selectedDayIndex.value = todayIndex;
    updateRoutine();
    fetchSelectedDayRoutine();
  }
});
onMounted(() => {
  const todayIndex = new Date().getDay();
  if (todayIndex !== -1) {
    selectedDayIndex.value = todayIndex;
  }
});
onAuthStateChanged(auth, (user) => {
  if (user) {
    userId.value = user.uid; // Set user ID when the user logs in
    console.log('User ID:', userId.value);

    // Fetch tasks and streak after user ID is set
    fetchStreakOnLoad(); // Ensure this runs after userId is set

    const todayIndex = new Date().getDay();
    if (todayIndex !== -1) {
      selectedDayIndex.value = todayIndex;
      fetchSelectedDayRoutine(); // Fetch tasks for the current day
    }
  } else {
    userId.value = null; // Clear user ID when the user logs out
    selectedDayRoutine.value = []; // Clear tasks when no user is logged in
  }
});

const userId = ref(null);

const addNewTask = async () => {
  if (!userId.value) {
    error.value = 'You must be logged in to add a task';
    return;
  }

  if (newTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return;
  }

  const labels = typeof newTask.value.labels === 'string'
      ? newTask.value.labels.split(',').map(label => label.trim())
      : [];

  const task = {
    title: newTask.value.title.trim(),
    completed: false,
    time: formatTime(newTask.value.time),
    priority: newTask.value.priority,
    labels: labels,
    notes: newTask.value.notes,
    userId: userId.value,
    createdAt: new Date().toISOString()
  };

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    let existingTasks = [];
    if (selectedDayDocSnapshot.exists()) {
      existingTasks = selectedDayDocSnapshot.data().tasks || []; // Fallback to empty array if tasks is undefined
    }

    await setDoc(selectedDayDocRef, {
      tasks: [...existingTasks, task],
      updatedAt: serverTimestamp()
    });

    selectedDayRoutine.value = [...existingTasks, task]; // Update the local state
    selectedDayRoutine.value.sort((a, b) => {
      return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
    });

    newTask.value = { title: '', time: '', priority: 'low', labels: [], notes: '' };
    closeModal()
    error.value = '';




    // Send notification to the specific player ID
    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName);
    }
    showNotification.value = true;
    setTimeout(() => {
      showNotification.value = false;
    }, 3000);
  } catch (error) {
    console.error('Error adding task:', error);
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

// Reactive state for streak tracking
const streak = ref(0);
const lastCompletionDate = ref(null);
const unlockedBadges = ref([]);
const motivationalMessage = ref('');
const selectedDayRoutine = ref([]);
const showNotification = ref(false);


// List of predefined badges
const badges = [
  { days: 1, name: 'Consistency Starter', description: 'Completed tasks for 3 days in a row!', icon: '🔥' },
  { days: 7, name: 'Streak Warrior', description: 'Completed tasks for 7 days in a row!', icon: '🏅' },
  { days: 30, name: 'Master of Routine', description: 'Completed tasks for 30 days in a row!', icon: '💪' }
];


// Function to check for streak continuation
const checkStreakOnCompletion = async () => {
  const completionPercentage = calculateCompletionPercentage();

  if (completionPercentage === 100) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const streakDocRef = doc(db, 'streaks', userId.value);
      const streakDocSnapshot = await getDoc(streakDocRef);

      if (streakDocSnapshot.exists()) {
        const data = streakDocSnapshot.data();
        lastCompletionDate.value = data.lastCompletionDate;
        streak.value = data.streak;

        if (lastCompletionDate.value === yesterdayStr) {
          streak.value += 1; // Continue streak
        } else if (lastCompletionDate.value !== today) {
          streak.value = 1; // Reset streak
        }
      } else {
        streak.value = 1; // Initialize streak
      }

      lastCompletionDate.value = today;

      // Update streak in Firestore
      await updateStreakInFirestore();

      checkForBadges();
      updateMotivationalMessage();
    } catch (error) {
      console.error('Error checking streak continuation:', error);
    }
  } else {
    console.log('Completion is not 100%. Streak not updated.');
  }
};



const fetchStreakOnLoad = async () => {
  if (!userId.value) return; // Ensure user is logged in

  const streakDocRef = doc(db, 'streaks', userId.value); // Use userId as document ID

  try {
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      streak.value = data.streak || 0;
      lastCompletionDate.value = data.lastCompletionDate || null;
      unlockedBadges.value = data.unlockedBadges || [];
      console.log('Streak and badges fetched:', streak.value, unlockedBadges.value);
    } else {
      console.log('No streak document found for this user');
    }

    updateMotivationalMessage();
  } catch (error) {
    console.error('Error fetching streak on load:', error);
  }
};

const updateStreakInFirestore = async () => {
  if (!userId.value) return; // Ensure user is logged in

  const streakDocRef = doc(db, 'streaks', userId.value); // Use userId as document ID

  try {
    await setDoc(streakDocRef, {
      streak: streak.value,
      lastCompletionDate: lastCompletionDate.value,
      unlockedBadges: unlockedBadges.value,
      updatedAt: serverTimestamp()
    });
    console.log('Streak updated in Firestore:', streak.value);
  } catch (error) {
    console.error('Error updating streak in Firestore:', error);
  }
};


onMounted(() => {
  fetchStreakOnLoad(); // Fetch streak when the app is loaded
  const todayIndex = new Date().getDay();
  if (todayIndex !== -1) {
    selectedDayIndex.value = todayIndex;
    updateRoutine();
    fetchSelectedDayRoutine();
  }
});

// Function to update motivational message
const updateMotivationalMessage = () => {
  if (streak.value >= 7) {
    motivationalMessage.value = "You're on fire! Keep it up!";
  } else if (streak.value >= 3) {
    motivationalMessage.value = "Great job! You're building a habit!";
  } if (streak.value >= 1 && streak.value <= 3) {
    motivationalMessage.value = "Good start! Keep going!";
  }
};

const checkForBadges = async () => {
  badges.forEach(async (badge) => {
    if (streak.value === badge.days && !unlockedBadges.value.some((b) => b.days === badge.days)) {
      unlockedBadges.value.push(badge);
      console.log(`Badge unlocked: ${badge.name}`);

      try {
        await updateStreakInFirestore(); // Save updated badges
      } catch (error) {
        console.error('Error updating unlocked badges:', error);
      }
    }
  });
};




// Call checkStreak when component is mounted
onMounted(() => {

  checkStreakOnCompletion();
});

const milestones = ref([
  { label: '0%', percent: 0, position: 0, icon: '🚶' },      // Walking icon for start
  { label: '25%', percent: 25, position: 25, icon: '🏃' },   // Running icon
  { label: '50%', percent: 50, position: 50, icon: '🚴' },   // Biking icon
  { label: '75%', percent: 75, position: 75, icon: '🚗' },   // Car icon
  { label: '100%', percent: 100, position: 100, icon: '🚀' } // Rocket icon for completion
]);
const spinningTasks = ref([]);

// Function to check if a task is spinning
const isSpinning = (index) => {
  return spinningTasks.value[index] || false;
};

// Function to start spinning for a specific task
const startSpinning = (index) => {
  spinningTasks.value[index] = true;

  // Stop spinning after a set duration (e.g., 5 seconds)
  setTimeout(() => {
    spinningTasks.value[index] = false;
  }, 5000); // Adjust the duration as needed
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

.streak-display {
  background-color: #fef3c7;
}



.badge-display span {
  font-size: 2rem;
}

 .badge-icon {
   display: inline-block;
   font-size: 2rem;
   animation: pulse 1.5s infinite;
 }

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}
input[type="text"],
input[type="time"],
select,
textarea {
  font-size: 16px;
  line-height: 1.5;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 0.375rem;
  width: 100%;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin 3s linear infinite;
}
</style>