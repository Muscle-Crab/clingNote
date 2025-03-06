<template>
  <div ref="scrollContainer" class="h-[100vh] overflow-auto bg-gray-200 p-3"  >
    <div v-if="isLoading" class="flex justify-center items-center h-full">
      <div class="flex items-center space-x-2">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-700 font-medium">Loading tasks...</span>
      </div>
    </div>
    <div v-else>




      <div
          class="streak-display p-3 rounded shadow-sm mb-2 flex flex-col sm:flex-row items-center sm:justify-between"
          :class="{
    'bg-yellow-50': streak < 3,
    'bg-green-50': streak >= 3 && streak < 7,
    'bg-blue-50': streak >= 7
  }"
      >
        <!-- Streak on the left -->
        <div class="flex items-center space-x-3 w-full sm:w-auto mb-1 sm:mb-0">
          <!-- Streak Icon -->
          <div class="flex items-center justify-center w-10 h-10 bg-blue-100 text-blue-600 rounded-full">
            <div class="streak-icon">
              {{ getStreakIcon(streak) }}
            </div>
          </div>

          <!-- Streak and Credits Information -->
          <div class="flex flex-col">
            <h2 class="text-sm font-semibold text-gray-800">
              🔥<span class="text-blue-600">{{ streak }}</span> days
            </h2>
            <p v-if="streak === 0" class="text-xs text-red-500 font-medium mt-1">
              No streak yet!
            </p>

            <p v-else class="text-xs text-gray-600 mt-1">
              {{ motivationalMessage }}
            </p>

          </div>
        </div>

        <!-- Icon and Credits on the right -->
        <div class="flex flex-col items-center sm:items-end">
          <div class="text-sm font-medium text-blue-500 flex items-center">
            <!-- Display message when idle time is not yet available -->
            <span v-if="pointsAccumulated < totalPoints && !isNaN(pointsAccumulated) && !isNaN(totalPoints)">
      You need
      <span class="text-yellow-500 font-semibold">
        💰{{ totalPoints - pointsAccumulated }}
      </span>
      more points to earn idle time.
    </span>
            <!-- Display message when idle time is available -->
            <span v-else class="text-green-500 font-semibold">
      Idle time is now available! 🎉
    </span>
          </div>
        </div>

      </div>

      <div v-if="showFullScreenAnimation" class="fixed inset-0 bg-gradient-to-br from-green-500 via-blue-500 to-purple-500 flex items-center justify-center z-50">
        <div class="text-center">

          <h1 class="text-4xl font-bold text-white animate-bounce">🎉 All Tasks Completed! 🔥<span class="text-yellow-600">{{ streak }}</span> days</h1>
          <p class="text-lg text-white mt-4">Congratulations on completing all your tasks!</p>
          <button
              @click="closeFullScreenAnimation"
              class="mt-6 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:bg-blue-100"
          >
            Close
          </button>
        </div>
      </div>
      <!-- Calendar display -->
      <div class="calendar-task-card
      bg-gray-100 rounded-2xl mb-2 shadow-lg p-2 mb-2 w-full max-w-4xl mx-auto"


      >
        <!-- Calendar Section -->
        <div class="calendar-section mb-2">
          <div class="current-date font-bold text-gray-900 mb-4">

            <span>{{ currentDate }}</span>
            <TimeTracker />
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
    'bg-blue-500 scale-110': calculateCompletionPercentage(task) > 0 && calculateCompletionPercentage(task) >= milestone.percent,
    'bg-gray-400 scale-100': calculateCompletionPercentage(task) <= 0 || calculateCompletionPercentage(task) < milestone.percent,
  }"
            >
              <div
                  class="text-xl sm:text-2xl transition-transform duration-500"
                  :class="{ 'animate-bounce': calculateCompletionPercentage(task) > 0 && calculateCompletionPercentage(task) >= milestone.percent }"
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
      <div class="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50">
        <router-link
            :to="userId ? '#' : '/login'"
            @click.native.prevent="userId && openModal('task')"
            class="relative flex items-center justify-center w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg transform hover:scale-105 transition-transform duration-200"
        >
          <!-- Pulsating Background Effect -->
          <span class="absolute inset-0 rounded-full bg-blue-500 opacity-50 animate-ping"></span>

          <!-- Plus Icon -->
          <svg class="relative w-7 h-7 z-10" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M12 4v16m8-8H4" />
          </svg>
        </router-link>






      </div>

      <!-- Main modal -->
      <div
          v-if="modalOpen"
          class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4"
      >
        <!-- Modal Content -->
        <div
            class="bg-white w-full max-w-lg md:max-w-xl lg:max-w-2xl rounded-lg shadow-lg flex flex-col"
            style="max-height: 80vh; overflow-y: auto;"
        >

          <!-- Modal Header (Fixed) -->
          <div class="flex justify-between items-center p-4 border-b bg-gray-100">
            <h3 class="text-lg font-semibold text-gray-900">Add Task</h3>
            <button @click="closeModal" class="text-gray-500 hover:text-gray-700 text-2xl">
              ✕
            </button>
          </div>

          <!-- Scrollable Modal Body -->
          <form @submit.prevent="addNewTask" class="flex flex-col flex-1">
            <div class="p-4 flex-1 overflow-y-auto max-h-[60vh]">
              <!-- Task Input -->
              <div>
                <label for="newTask" class="block font-medium">Task Name:</label>
                <input
                    type="text"
                    v-model="newTask.title"
                    id="newTask"
                    class="w-full border border-gray-300 rounded-md px-4 py-2"
                    placeholder="Enter task name"
                    required
                />
              </div>

              <!-- Advanced Options Toggle -->
              <div class="flex items-center cursor-pointer text-blue-500 font-medium mt-2" @click="showAdvanced = !showAdvanced">
                <span class="mr-2">Advanced Options</span>
                <i :class="showAdvanced ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
              </div>

              <!-- Advanced Fields -->
              <transition name="fade">
                <div v-if="showAdvanced" class="flex flex-col space-y-3 mt-3">
                  <label for="newTaskReminderDate">Reminder Date:</label>
                  <input
                      type="date"
                      v-model="newTask.reminder.date"
                      id="newTaskReminderDate"
                      class="w-full border border-gray-300 rounded-md px-4 py-2"
                  />

                  <label for="newTaskReminderTime">Reminder Time:</label>
                  <input
                      type="time"
                      v-model="newTask.reminder.time"
                      id="newTaskReminderTime"
                      class="w-full border border-gray-300 rounded-md px-4 py-2"
                  />

                  <label for="newTaskReminderRepeat">Repeat:</label>
                  <select
                      v-model="newTask.reminder.repeat"
                      id="newTaskReminderRepeat"
                      class="w-full border border-gray-300 rounded-md px-4 py-2"
                  >
                    <option value="">No Repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>

                  <label for="newTaskDays">Select Days:</label>
                  <div class="flex flex-wrap gap-2 mb-2">
                    <div v-for="(day, index) in days" :key="index" class="flex items-center space-x-2">
                      <input type="checkbox" :id="'day-' + index" :value="day" v-model="newTask.selectedDays" class="form-checkbox" />
                      <label :for="'day-' + index" class="text-sm">{{ day.day }}</label>
                    </div>
                  </div>
                  <select v-model="newTask.type" id="taskType" class="w-full border border-gray-300 rounded-md px-4 py-2">

                    <option value="recurring">Recurring</option>
                    <option value="one-time">One-time</option>
                  </select>
                  <label for="taskPosition">Insert Position:</label>
                  <select
                      v-model="newTask.position"
                      id="taskPosition"
                      class="w-full border border-gray-300 rounded-md px-4 py-2"
                  >
                    <option :value="0">First</option>
                    <option
                        v-for="(task, index) in selectedDayRoutine"
                        :key="index"
                        :value="index + 1"
                    >
                      {{ index + 2 }}{{ getOrdinalSuffix(index + 2) }}
                    </option>
                  </select>

                  <label for="newTaskLabels">Task Labels:</label>
                  <input
                      type="text"
                      v-model="newTask.labels"
                      id="newTaskLabels"
                      class="w-full border border-gray-300 rounded-md px-4 py-2"
                      placeholder="Enter task labels (comma-separated)"
                  />

                  <label for="newTaskNotes">Task Notes:</label>
                  <textarea
                      v-model="newTask.notes"
                      id="newTaskNotes"
                      class="w-full border border-gray-300 rounded-md px-4 py-2"
                      placeholder="Enter task notes"
                  ></textarea>
                </div>
              </transition>

              <div v-if="error" class="text-red-500 mt-2">{{ error }}</div>
            </div>

            <!-- Modal Footer (Fixed) -->
            <div class="bg-gray-100 p-4 border-t flex justify-end">
              <button type="submit" class="bg-blue-500 text-white px-6 py-2 rounded-md shadow-md hover:bg-blue-600 transition">
                Add Task
              </button>
            </div>
          </form>
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
        <div v-if="selectedDayRoutine?.length === 0" class="flex flex-col items-center justify-center mt-16">
          <img
              src="https://cdn.pixabay.com/photo/2017/02/01/11/12/bulb-2029707_640.png"
              alt="No tasks illustration"
              class="w-48 h-48 mb-6"
          />
          <h2 class="text-lg font-semibold text-gray-700">No tasks found!</h2>
          <p class="text-sm text-gray-500 mt-2">You don’t have any tasks for this day. Add a new task to get started.</p>

        </div>
        <div v-else>
          <div class="scroll-container overflow-y-auto h-[80vh]">
            <div v-if="selectedDayIndex === new Date().getDay()" class="flex items-center justify-between cursor-pointer my-2" >
              <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span class=" tracking-wide text-gray-600">Completed</span>
                  <span class="text-sm font-medium bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
        {{ completedTaskCount }}/{{ selectedDayRoutine?.length }}
    </span>
                </h3>
              </h3>

              <button @click="showCompleted = !showCompleted">
                <i
                    :class="{
            'fas fa-eye text-gray-500': showCompleted,
            'fas fa-eye-slash text-gray-500': !showCompleted,
          }"
                    class="text-xl"
                ></i>
              </button>
            </div>
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
                <div   v-if="(!task.completed || (isToday(selectedDayIndex) && showCompleted))"
                    class="task-card bg-white rounded-xl shadow-lg p-5 relative hover:shadow-xl transition-shadow duration-300"
                    :class="{
    'bg-gray-200': task.completed && isToday(selectedDayIndex), // Add a light green background for completed tasks
     // Add a light red background for incomplete tasks
    'draggable': taskIsDragging
  }"
                >
                  <div class="flex items-center ">
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
                          :class="{ 'line-through text-gray-500': task.completed && isToday(selectedDayIndex) }"
                      >
                        {{ task.title }}
                      </div>
                      <div v-if="task.reminder?.date && task.reminder?.time" class="text-sm text-gray-500 mt-1 flex items-center">
                        📅 {{ formatShortDate(task.reminder.date) }} • ⏰ {{ formatTime(task.reminder.time) }}
                        <button @click="removeNotification(task, index)" class="ml-2 text-red-500 hover:text-red-700">
                          ❌
                        </button>
                      </div>


                      <div class="absolute top-2 right-2 bg-blue-100  px-2 py-1 rounded-full text-xs font-bold flex items-center ">
                        <span>10</span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" fill="gold" />
                          <circle cx="12" cy="12" r="8" fill="goldenrod" />
                          <circle cx="9" cy="9" r="3" fill="rgba(255, 255, 255, 0.4)" />
                          <text x="12" y="16" font-size="12" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">
                            $
                          </text>
                        </svg>

                      </div>

                      <!--                    <div v-if="task.time" class="text-sm text-gray-400">{{ task.time }}</div>-->
                      <!-- User Icon and Name with Spinning Icon -->
                      <div class="flex items-center space-x-2 text-xs">
                        <!-- Incomplete Task Indicator -->
                        <div v-if="!task.completed && isToday(selectedDayIndex)" class="text-yellow-500">
                          <i class="fas fa-circle"></i> Incomplete
                        </div>
                        <div>
                          <!-- Button to Open Modal -->


                          <!-- Modal -->
                          <div v-if="isModalOpen" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                            <div class="bg-white p-5 rounded-lg shadow-lg w-96">
                              <h2 class="text-lg font-semibold mb-4">Add Reminder</h2>

                              <p class="text-md font-medium mb-3">
                                Task: <span class="font-semibold text-blue-600">{{ selectedTaskTitle }}</span>
                              </p>

                              <form @submit.prevent="handleAddReminder">
                                <label for="reminderDate" class="block mb-2">Date:</label>
                                <input type="date" v-model="reminder.date" id="reminderDate" class="w-full border-gray-300 rounded-md p-2 mb-2" required>

                                <label for="reminderTime" class="block mb-2">Time:</label>
                                <input type="time" v-model="reminder.time" id="reminderTime" class="w-full border-gray-300 rounded-md p-2 mb-2" required>
                                <label for="reminderRepeat" class="block mb-2">Repeat:</label>
                                <select v-model="reminder.repeat" id="reminderRepeat" class="w-full border-gray-300 rounded-md p-2 mb-2">
                                  <option value="">No Repeat</option>
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="yearly">Yearly</option>
                                </select>
                                <div class="flex justify-end mt-4">
                                  <button @click="closeModal" type="button" class="mr-2 px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
                                  <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md">Add to Calendar</button>
                                </div>
                              </form>
                            </div>
                          </div>

                        </div>
                        <!-- In Progress Task Indicator -->
                        <div v-if="isToday(selectedDayIndex) && index === topIncompleteTaskIndex" class="text-blue-500 flex items-center">
                          <i class="fas fa-hourglass-half animate-spin-slow mr-1"></i> In Progress
                        </div>

                        <!-- Completed Task Indicator -->
                        <div v-if="task.completed && isToday(selectedDayIndex)"  class="text-green-500">
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
                  <div class="flex items-center justify-between mb-3 space-x-4">
                    <!-- User Icon and Name -->
                    <div class="flex items-center space-x-2 relative">

                      <span class="text-xs font-medium text-gray-700 relative -top-1">{{ task.notes }}</span>
                    </div>

                    <!-- Task Actions -->
                    <div class="flex items-center space-x-2">

                      <!-- Task Completion Radio Button -->
                      <button
                          v-if="isToday(selectedDayIndex)"
                          @click="toggleTaskCompletion(index)"
                          class="absolute top-2 left-2 focus:outline-none"
                      >
                        <i
                            :class="task.completed ? 'fas fa-dot-circle text-green-500' : 'far fa-circle text-gray-400'"
                            class="text-xl transition-all duration-300 ease-in-out"
                        ></i>
                      </button>

                      <button
                          @click="openModal('calendar', index, task.title)"
                          class="rounded-md text-xs sm:text-sm"
                      >
                        📅
                      </button>

                      <button
                          v-if="!isToday(selectedDayIndex)"
                          @click="deleteTask(index)"
                          class="text-red-500 hover:text-red-700 text-xs sm:text-sm"
                      >
                        🗑️
                      </button>

                      <button
                          @click="openTransferModal(index)"
                          class="text-blue-500 hover:text-blue-700 text-xs sm:text-sm"
                      >
                        🔄
                      </button>

                      <button
                          @click="openWontDoModal(index)"
                          class="text-orange-500 hover:text-orange-700 text-xs sm:text-sm"
                      >
                        🚫
                      </button>
                    </div>
                  </div>


                  <div
                      class="absolute bottom-2 left-2 w-5 h-5 flex items-center justify-center bg-gray-300 rounded-full text-xs font-bold text-gray-800 shadow-sm"
                  >
                    {{ index + 1 }}
                  </div>
                  <div v-if="wontDoModalOpen" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div class="bg-white p-5 rounded-lg shadow-lg w-96">
                      <h2 class="text-lg font-semibold mb-4">Mark as "Won't Do"</h2>

                      <p class="text-gray-700 mb-2">Why won't you do this task?</p>
                      <textarea v-model="wontDoReason" class="w-full border rounded-md p-2 mb-3"></textarea>

                      <div class="flex justify-end mt-4">
                        <button @click="wontDoModalOpen = false" class="mr-2 px-4 py-2 bg-red-300 rounded-md">
                          <i class="fa fa-times"></i> <!-- Cancel icon -->
                        </button>
                        <button @click="markTaskAsWontDo" class="px-4 py-2 bg-blue-300 rounded-md">
                          <i class="fa fa-check"></i> <!-- Confirm icon -->
                        </button>

                      </div>
                    </div>
                  </div>
                  <!-- Notification -->
                  <div
                      v-if="showNotification"
                      class="notification-popup bg-green-500 text-white px-4 py-2 rounded-md absolute top-4 right-4 shadow-lg"
                  >
                    Create successfully
                  </div>
                  <div v-if="transferNotification" class="fixed top-5 right-5 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300">
                    {{ transferNotification }}
                  </div>
                  <div v-if="transferModalOpen" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div class="bg-white p-5 rounded-lg shadow-lg w-96">
                      <h2 class="text-lg font-semibold mb-4">Select a Day to Transfer</h2>

                      <label for="transferDay" class="block mb-2 text-gray-700">Choose a day:</label>
                      <select v-model="selectedTransferDay" id="transferDay" class="w-full border border-gray-300 rounded-md p-2">
                        <option v-for="(day, index) in days" :key="index" :value="index" :disabled="index === selectedDayIndex">
                          {{ day.day }} - {{ day.date }}
                        </option>
                      </select>

                      <div class="flex justify-end mt-4">
                        <button @click="closeTransferModal" class="mr-2 px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
                        <button @click="transferTask()" class="px-4 py-2 bg-blue-500 text-white rounded-md">Transfer</button>
                      </div>
                    </div>
                  </div>

                </div>

              </template>

            </draggable>
            <div v-if="wontDoTasks.length != 0" class=" p-3 bg-red-100 rounded-lg">
              <h3 class="text-lg font-semibold text-red-700">Won't Do Tasks</h3>
              <ul>
                <li v-for="(task, index) in wontDoTasks" :key="index" class="flex  items-center bg-white p-2 rounded-md mt-2">
                  <button @click="undoWontDo(index)" class="text-green-500 hover:text-green-700">
                    <i class="fas fa-undo"></i>
                  </button>
                  <span class="ml-2">{{ task.title }} - {{ task.wontDoReason }}</span>

                </li>
              </ul>
            </div>
          </div>
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
import TimeTracker from "@/components/TimeTracker.vue";
// Define reactive state

const currentTime = ref([]);
const showAdvanced = ref(false)

// Define function to format time

const transferModalOpen = ref(false);
const selectedTransferTaskIndex = ref(null);
const selectedTransferDay = ref(null);

const openTransferModal = (index) => {
  selectedTransferTaskIndex.value = index;
  transferModalOpen.value = true;
};


const closeTransferModal = () => {
  transferModalOpen.value = false;
  selectedTransferTaskIndex.value = null;
  selectedTransferDay.value = null;
};

const transferNotification = ref(null);



const isModalOpen = ref(false);
const selectedTaskTitle = ref(""); // Stores the title of the selected task
const reminder = ref({ date: "", time: "" });

// Open Modal and Set Task Title


// Close Modal

const selectedTaskIndex = ref(null);
// Function to Download `.ics` File
const handleAddReminder = async () => {
  if (!reminder.value.date || !reminder.value.time) {
    alert("Please enter both date and time!");
    return;
  }

  if (selectedTaskIndex.value === null) {
    alert("No task selected!");
    return;
  }

  // Get the selected task
  const task = { ...selectedDayRoutine.value[selectedTaskIndex.value] };
  task.reminder = {
    date: reminder.value.date,
    time: reminder.value.time,
    repeat: reminder.value.repeat || "",
  };

  // Update Firestore
  try {
    const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];
      tasks[selectedTaskIndex.value] = task;

      await updateDoc(selectedDayDocRef, {
        tasks: tasks,
        updatedAt: serverTimestamp()
      });

      selectedDayRoutine.value[selectedTaskIndex.value] = task;
      console.log("Reminder added successfully to the task.");

      // Schedule notification
      await scheduleNotification(task, task.reminder);
    }
  } catch (error) {
    console.error("Error updating task with reminder:", error);
    return;
  }

  // Close Modal
  closeModal();
  reminder.value = { date: "", time: "", repeat: "" };
};





const transferTask = async () => {
  if (!userId.value || selectedTransferTaskIndex.value === null || selectedTransferDay.value === null) {
    console.warn("Invalid task or day selection");
    return;
  }

  const currentDayIndex = selectedDayIndex.value;
  const targetDayIndex = selectedTransferDay.value;
  if (currentDayIndex === targetDayIndex) {
    console.warn("Cannot transfer task to the same day");
    return;
  }

  const currentDay = days[currentDayIndex].day;
  const targetDay = days[targetDayIndex].day;

  const currentDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${currentDay}`);
  const targetDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${targetDay}`);

  try {
    const currentDayDocSnapshot = await getDoc(currentDayDocRef);
    const targetDayDocSnapshot = await getDoc(targetDayDocRef);

    let currentTasks = currentDayDocSnapshot.exists() ? currentDayDocSnapshot.data().tasks : [];
    let targetTasks = targetDayDocSnapshot.exists() ? targetDayDocSnapshot.data().tasks : [];

    // Remove the task from the current day and add it to the selected day
    const [task] = currentTasks.splice(selectedTransferTaskIndex.value, 1);
    if (!task) return;

    targetTasks.push(task);

    // Update Firestore
    await updateDoc(currentDayDocRef, {
      tasks: currentTasks,
      updatedAt: serverTimestamp()
    });

    await setDoc(targetDayDocRef, {
      tasks: targetTasks,
      updatedAt: serverTimestamp()
    });

    // Update UI
    selectedDayRoutine.value = currentTasks;
    if (selectedDayIndex.value === targetDayIndex) {
      selectedDayRoutine.value = targetTasks;
    }

    console.log(`Task "${task.title}" moved to ${targetDay}`);

    // **Show Transfer Notification**
    transferNotification.value = `Task "${task.title}" moved to ${targetDay}`;
    setTimeout(() => {
      transferNotification.value = null;
    }, 3000); // Auto-hide after 3 seconds

    // Close modal
    closeTransferModal();
  } catch (error) {
    console.error('Error transferring task:', error);
  }
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
const scheduleNotification = async (task, reminder) => {
  if (!task || !reminder.date || !reminder.time) {
    console.error("Invalid task or reminder data");
    return;
  }

  // Convert reminder.time to 12-hour format
  const convertTo12HourFormat = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 0 or 12 to 12 AM/PM
    return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formattedTime = convertTo12HourFormat(reminder.time);

  const scheduledDateTime = new Date(`${reminder.date}T${reminder.time}:00`).toISOString();
  const playerId = window.OneSignal.User.PushSubscription.id;

  if (!playerId) {
    console.error("Player ID not found. Make sure OneSignal is initialized.");
    return;
  }

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your OneSignal API key
    'Content-Type': 'application/json'
  };

  const notificationData = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Replace with your OneSignal App ID
    "include_player_ids": [playerId], // Replace with actual user player ID
    "contents": { "en": `${task.title} at ${formattedTime}` },
    "headings": { "en": "Task Reminder" },
    "send_after": scheduledDateTime, // Schedule the notification
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', notificationData, { headers });
    console.log('Scheduled notification successfully:', response.data);

    // Save notification ID in Firestore for later cancellation
    if (response.data.id) {
      task.reminder.notificationId = response.data.id;

      // Update Firestore
      const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);
      const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

      if (selectedDayDocSnapshot.exists()) {
        let tasks = selectedDayDocSnapshot.data().tasks || [];
        tasks[selectedTaskIndex.value] = task;

        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp()
        });

        console.log("Reminder with notification ID saved successfully.");
      }
    }

    // Display confirmation alert
    alert(`Task "${task.title}" has been scheduled successfully for ${formattedTime}!`);

  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert("Failed to schedule the task. Please try again.");
  }
};


const sendNotificationToPlayer = async (userName, action) => {
  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // Replace with your actual API key
    'Content-Type': 'application/json'
  };

  // Define the content and heading based on the action
  const actionMessages = {
    created: {
      content: `${userName} created a new task!`,
      heading: "New Task Alert"
    },
    completed: {
      content: `${userName} completed a task!`,
      heading: "Task Completed"
    }
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // Replace with your actual OneSignal app ID
    "include_player_ids": ["ff823cf5-aef7-4363-82f7-33c1de7ce02e"], // Replace with the user's device/player ID
    "contents": { "en": actionMessages[action]?.content || "An action was performed." },
    "headings": { "en": actionMessages[action]?.heading || "Notification" }
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};



const openModal = (type = 'task', index = null, title = '') => {
  if (type === 'calendar') {
    selectedTaskIndex.value = index; // Store task index
    selectedTaskTitle.value = title || "Task Reminder";
    isModalOpen.value = true;
  } else {
    modalOpen.value = true;
  }
};

const showCompleted = ref(false);



// Close Modal
const closeModal = () => {
  isModalOpen.value = false;
  reminder.value = { date: "", time: "" };
  modalOpen.value = false
};
const selectedDayIndex = ref(-1);
const newTask = ref({
  title: '',
  time: '',
  priority: 'low',
  labels: [],
  notes: '',
  selectedDays: [],
  position: 0,
  type: 'recurring',
  reminder: { date: '', time: '', repeat: '' }  // Now defined
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

  const selectedDay = days[selectedDayIndex.value];
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay.day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];

      const isTodaySelected = selectedDay.date === getTodayDate();
      const isPastDay = new Date(selectedDay.date) < new Date(getTodayDate());

      // If the selected day is in the past, reset all tasks to incomplete
      if (isPastDay) {
        tasks = tasks.map(task => ({
          ...task,
          completed: false
        }));

        // Update Firestore with reset tasks
        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp()
        });
      }

      // Fetch user names for each task
      const tasksWithUserNames = await Promise.all(
          tasks.map(async (task) => {
            try {
              if (!task.userId) {
                return { ...task, userName: 'Unknown User' };
              }

              const userDocRef = doc(db, 'users', task.userId);
              const userDocSnapshot = await getDoc(userDocRef);

              const userName = userDocSnapshot.exists()
                  ? userDocSnapshot.data().name
                  : 'Unknown User';

              return { ...task, userName };
            } catch (error) {
              console.error('Error fetching user name:', error);
              return { ...task, userName: 'Error Fetching User' };
            }
          })
      );

      selectedDayRoutine.value = tasksWithUserNames || [];
    } else {
      selectedDayRoutine.value = []; // No tasks for this user and day
    }
  } catch (error) {
    console.error('Error fetching tasks for the selected day:', error);
    selectedDayRoutine.value = []; // Clear tasks on error
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
const milestoneMessages = {
  7: "One week of success! 🌟",
  15: "Halfway to a month! 🚀",
  30: "Amazing! A full month streak! 🎖️"
};

// Function to get motivational messages for milestones
const getMilestoneMessage = (streak) => {
  return milestoneMessages[streak] || "Keep it going!";
};
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
    // If both tasks have the same completion status, sort by time
    if (a.completed === b.completed) {
      return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
    }
    // If task A is completed and task B is not, A comes first
    return a.completed ? -1 : 1;
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
  if (task.completed) {
    userCredits.value += 10; // Award 10 credits for completing a task
    console.log(`Credits earned: 10. Total credits: ${userCredits.value}`);
    // speak(`Great job! You completed the task: ${task.title}.`);
    announceNextTask(index); // Pass the index of the completed task
    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "completed");
    }
  } else {
    userCredits.value -= 10; // Deduct credits if task is marked incomplete
    console.log(`Credits deducted: 10. Total credits: ${userCredits.value}`);
  }

  // Remove one-time tasks from the UI immediately
  if (task.type === "one-time") {
    selectedDayRoutine.value.splice(index, 1);
  } else {
    selectedDayRoutine.value.splice(index, 1, task); // Update recurring tasks
  }

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];

      if (task.type === "one-time") {
        // Remove the one-time task completely
        tasks = tasks.filter((_, i) => i !== index);
      } else {
        tasks[index] = task; // Otherwise, update the task
      }

      if (tasks.length > 0) {
        // Update Firestore with remaining tasks
        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp(),
        });
      } else {
        // If no tasks remain, delete the entire document
        await deleteDoc(selectedDayDocRef);
      }

      console.log("Task completion updated successfully");
    }
  } catch (error) {
    console.error("Error updating task completion:", error);
  }

  // Check streak after toggling task completion
  checkStreakOnCompletion();
  checkAllTasksCompleted();
  selectedDayRoutine.value = selectedDayRoutine.value.filter(task => !task.completed || showCompleted);
  showCompleted.value = false;
};

const wontDoModalOpen = ref(false);
const wontDoReason = ref("");
const selectedWontDoTaskIndex = ref(null);
const wontDoTasks = ref([]); // Separate list for Won't Do tasks

const openWontDoModal = (index) => {
  selectedWontDoTaskIndex.value = index;
  wontDoReason.value = "";
  wontDoModalOpen.value = true;
};
const markTaskAsWontDo = async () => {
  if (selectedWontDoTaskIndex.value === null) return;

  const task = {
    ...selectedDayRoutine.value[selectedWontDoTaskIndex.value],
    wontDoReason: wontDoReason.value
  };

  // Remove task from routine
  selectedDayRoutine.value.splice(selectedWontDoTaskIndex.value, 1);

  // Add to "Won't Do" list
  wontDoTasks.value.push(task);

  // Firestore: Store "Won't Do" tasks
  try {
    const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days[selectedDayIndex.value].day}`);
    await setDoc(wontDoDocRef, {
      tasks: wontDoTasks.value,
      updatedAt: serverTimestamp()
    });

    console.log("Task marked as 'Won't Do' and saved to Firestore.");
  } catch (error) {
    console.error("Error saving 'Won't Do' task:", error);
  }

  // Close modal
  wontDoModalOpen.value = false;
};

const undoWontDo = async (index) => {
  const task = wontDoTasks.value.splice(index, 1)[0];
  selectedDayRoutine.value.push(task);

  // Update Firestore
  const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days[selectedDayIndex.value].day}`);
  await setDoc(wontDoDocRef, { tasks: wontDoTasks.value, updatedAt: serverTimestamp() });

  console.log("Task restored from 'Won't Do'");
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
const announceNextTask = (completedIndex) => {
  const nextTask = selectedDayRoutine.value.find((task, index) => !task.completed && index !== completedIndex);
  if (nextTask) {
    speak(`Your next task is: ${nextTask.title}.`);
  } else {
    speak("Congratulations! All tasks are complete.");
  }
};

const showFullScreenAnimation = ref(false);

const checkAllTasksCompleted = async () => {
  const allCompleted = selectedDayRoutine.value.every(task => task.completed);

  if (allCompleted) {
    // 🎉 Show completion animation
    showFullScreenAnimation.value = true;
    speak("Congratulations! You've completed all your tasks!");
    updateStreakOnCompletion(); // 🔥 Update streak progression

    // 🗑 Remove one-time tasks & reset recurring tasks
    selectedDayRoutine.value = selectedDayRoutine.value.filter(task => {
      if (task.type === "one-time") {
        return false; // Remove from array (will also be removed from Firestore)
      } else {
        task.completed = false; // Reset recurring task to incomplete
        return true; // Keep in array
      }
    });

    // 🔄 Update Firestore
    try {
      const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

      if (selectedDayRoutine.value.length > 0) {
        await updateDoc(selectedDayDocRef, {
          tasks: selectedDayRoutine.value,
          updatedAt: serverTimestamp()
        });
        console.log("✅ One-time tasks removed, recurring tasks reset.");
      } else {
        await deleteDoc(selectedDayDocRef); // Remove document if no tasks remain
        console.log("🗑 All tasks removed. Firestore document deleted.");
      }

    } catch (error) {
      console.error("❌ Error updating Firestore:", error);
    }
  }
};


const updateStreakOnCompletion = async () => {
  if (!userId.value) return;

  const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0]; // Get yesterday's date

  const streakDocRef = doc(db, 'streaks', userId.value);

  try {
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      lastCompletionDate.value = data.lastCompletionDate || null;
      streak.value = data.streak || 0;

      // ✅ Prevent multiple streak updates per day
      if (lastCompletionDate.value === today) {
        console.log("User already earned a streak today. No update needed.");
        return; // 🚀 Exit early if streak is already updated today
      }

      // 🔥 Continue streak if yesterday was completed
      if (lastCompletionDate.value === yesterdayStr) {
        streak.value += 1;
      } else {
        // ⏳ If there's a gap, reset the streak
        streak.value = 1;
      }

      // Update last completion date to today
      lastCompletionDate.value = today;

      await updateDoc(streakDocRef, {
        streak: streak.value,
        lastCompletionDate: today,
        updatedAt: serverTimestamp(),
      });

      console.log(`🎉 Streak updated: ${streak.value}`);
    } else {
      // No existing streak, start fresh
      await setDoc(streakDocRef, {
        streak: 1,
        lastCompletionDate: today,
        updatedAt: serverTimestamp()
      });

      streak.value = 1;
      lastCompletionDate.value = today;

      console.log("🔥 New streak started at 1.");
    }

    checkForBadges(); // Update badges if applicable
    updateMotivationalMessage();
  } catch (error) {
    console.error("❌ Error updating streak:", error);
  }
};

const closeFullScreenAnimation = () => {
  showFullScreenAnimation.value = false;
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

  // Fallback to the currently selected day if no days are explicitly selected
  const selectedDays =
      newTask.value.selectedDays.length > 0
          ? newTask.value.selectedDays
          : [days[selectedDayIndex.value]];

  const labels =
      typeof newTask.value.labels === 'string'
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
    type: newTask.value.type,
    createdAt: new Date().toISOString()
  };

  // If reminder data is provided, attach it to the task
  if (newTask.value.reminder.date && newTask.value.reminder.time) {
    task.reminder = { ...newTask.value.reminder };
  }

  try {
    for (const selectedDay of selectedDays) {
      const selectedDayDocRef = doc(
          db,
          'weeklyRoutines',
          `${userId.value}_${selectedDay.day}`
      );
      const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

      let existingTasks = [];
      if (selectedDayDocSnapshot.exists()) {
        existingTasks = selectedDayDocSnapshot.data().tasks || [];
      }

      // Insert task at the specified position
      const position = parseInt(newTask.value.position, 10);
      existingTasks.splice(position, 0, task);

      await setDoc(selectedDayDocRef, {
        tasks: existingTasks,
        updatedAt: serverTimestamp()
      });

      // Update the UI if the task belongs to the currently selected day
      if (selectedDay.day === days[selectedDayIndex.value].day) {
        selectedDayRoutine.value = [...existingTasks].sort((a, b) => {
          return new Date('1970/01/01 ' + a.time) - new Date('1970/01/01 ' + b.time);
        });
      }
    }

    // If a reminder was set, schedule the notification
    if (task.reminder) {
      scheduleNotification(task, task.reminder);
    }

    // Reset the newTask state after adding, ensuring the reminder object is always defined
    newTask.value = {
      title: '',
      time: '',
      priority: 'low',
      labels: [],
      notes: '',
      selectedDays: [],
      position: 0,
      reminder: { date: '', time: '', repeat: '' },
      type: 'recurring',
    };
    closeModal();
    error.value = '';

    // Optionally, send a notification for task creation
    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "created");
    }
  } catch (error) {
    console.error('Error adding task:', error);
  }
};




const userCredits = ref(0);


const updateCreditsInFirestore = async () => {
  const userDocRef = doc(db, 'users', userId.value);

  try {
    await updateDoc(userDocRef, {
      credits: userCredits.value,
      updatedAt: serverTimestamp(),
    });
    console.log('Credits updated in Firestore');
  } catch (error) {
    console.error('Error updating credits:', error);
  }
};

watch(userCredits, updateCreditsInFirestore);
const fetchUserCredits = async () => {
  if (!userId.value) return;

  const userDocRef = doc(db, 'users', userId.value);

  try {
    const userDocSnapshot = await getDoc(userDocRef);
    if (userDocSnapshot.exists()) {
      userCredits.value = userDocSnapshot.data().credits || 0;
      console.log('User credits loaded:', userCredits.value);
    }
  } catch (error) {
    console.error('Error fetching user credits:', error);
  }
};

onMounted(fetchUserCredits);

const formatShortDate = (date) => {
  if (!date) return "";
  const options = { month: "short", day: "numeric" }; // Example: "Feb 19"
  return new Date(date).toLocaleDateString("en-US", options);
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
  const todayIndex = new Date().getDay(); // Get current day index
  if (selectedDayIndex.value !== todayIndex) {
    return 0; // Reset progress for non-today tabs
  }

  if (!selectedDayRoutine.value) return 0;

  const totalTasks = selectedDayRoutine.value.length + wontDoTasks.value.length;
  const completedTasks = selectedDayRoutine.value.filter(task => task.completed).length;

  return totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
};

const fetchWontDoTasks = async () => {
  if (!userId.value || selectedDayIndex.value === -1) {
    console.warn("User ID or selected day is not set.");
    return;
  }

  try {
    const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days[selectedDayIndex.value].day}`);
    const wontDoDocSnapshot = await getDoc(wontDoDocRef);

    if (wontDoDocSnapshot.exists()) {
      const data = wontDoDocSnapshot.data();
      wontDoTasks.value = data.tasks || [];
      console.log("Loaded 'Won't Do' tasks from Firestore:", wontDoTasks.value);
    } else {
      wontDoTasks.value = [];
      console.warn("No 'Won't Do' tasks found for this day.");
    }
  } catch (error) {
    console.error("Error fetching 'Won't Do' tasks:", error);
  }
};

watch(selectedDayIndex, async () => {
  await fetchWontDoTasks();
});
onMounted(async () => {
  const checkAuth = () => new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      userId.value = user ? user.uid : null;
      resolve();
      unsubscribe(); // Stop listening after auth state is detected
    });
  });

  await checkAuth(); // Wait until authentication is confirmed

  if (userId.value) {
    await fetchWontDoTasks(); // Fetch "Won't Do" tasks only if user is authenticated
  }
});

onMounted(fetchWontDoTasks);
watch(wontDoTasks, () => {
  console.log("Updated 'Won't Do' tasks:", wontDoTasks.value);
}, { deep: true });

// Reactive state for streak tracking
const streak = ref(0);
const lastCompletionDate = ref(null);
const unlockedBadges = ref([]);
const motivationalMessage = ref('');
const selectedDayRoutine = ref([]);
const showNotification = ref(false);
const streakIcons = [
  '🌱', '🌞', '🌟', '🔥', '🏆', '🎯', '🚀', '🌈', '💎', '🎵',
  '🌹', '🍀', '🦋', '🌻', '🌙', '✨', '🎉', '🎈', '🎂', '🍔',
  '🍕', '🍩', '🍎', '🍉', '🥇', '🥂', '🌊', '🌌', '🪐', '🧠'
];


// Function to get the icon for the current streak day
const getStreakIcon = (streak) => {
  if (streak >= 30) {
    return '🎖️'; // Special icon for streaks beyond 30 days
  }
  return streakIcons[streak - 1]; // Array is 0-indexed, so subtract 1
};


// Function to get the icon based on the current streak



// Function to check for streak continuation
const checkStreakOnCompletion = async () => {
  if (!userId.value) return;

  const completionPercentage = calculateCompletionPercentage();
  const today = new Date().toISOString().split('T')[0]; // Current date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0]; // Yesterday's date

  try {
    const streakDocRef = doc(db, 'streaks', userId.value);
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      lastCompletionDate.value = data.lastCompletionDate || null;
      streak.value = data.streak || 0;

      if (completionPercentage === 100) {
        // Increment streak if all tasks completed
        if (lastCompletionDate.value === yesterdayStr) {
          streak.value += 1; // Continue streak
        } else if (lastCompletionDate.value !== today) {
          streak.value = 1; // Start a new streak
        }
        lastCompletionDate.value = today; // Update completion date
      } else {
        // Reset streak if no tasks are completed
        if (lastCompletionDate.value !== today && lastCompletionDate.value !== yesterdayStr) {
          streak.value = Math.max(streak.value - 1, 0); // Reduce streak, min 0
          lastCompletionDate.value = yesterdayStr; // Mark last missed day
        }
      }

      await updateStreakInFirestore(); // Save changes
      checkForBadges();
      updateMotivationalMessage();
    }
  } catch (error) {
    console.error('Error updating streak:', error);
  }
};

// Function to check tasks and reduce streak
const checkTasksAndReduceStreak = async () => {
  if (!userId.value) return;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  try {
    const streakDocRef = doc(db, 'streaks', userId.value);
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      lastCompletionDate.value = data.lastCompletionDate || null;
      streak.value = data.streak || 0;

      if (lastCompletionDate.value !== today && lastCompletionDate.value !== yesterdayStr) {
        const todayTasksCompleted = calculateCompletionPercentage() === 100;

        if (!todayTasksCompleted) {
          streak.value = Math.max(streak.value - 1, 0);
          await updateDoc(streakDocRef, {
            streak: streak.value,
            lastCompletionDate: yesterdayStr,
            updatedAt: serverTimestamp(),
          });
          console.log('Streak reduced due to incomplete tasks.');
        }
      }
    }
  } catch (error) {
    console.error('Error reducing streak:', error);
  }
};

// Run the check daily at midnight
const startDailyCheck = () => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0); // Set to midnight

  const timeToMidnight = midnight.getTime() - now.getTime();

  setTimeout(() => {
    checkTasksAndReduceStreak(); // Run immediately at midnight
    setInterval(checkTasksAndReduceStreak, 24 * 60 * 60 * 1000); // Then run every 24 hours
  }, timeToMidnight);
};

// Start the daily check when the component is mounted
onMounted(() => {
  startDailyCheck();
});

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
  if (!userId.value) return;

  const streakDocRef = doc(db, 'streaks', userId.value);

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


const badges = [
  { name: "Seed Starter", days: 1, icon: "🌱" },
  { name: "Sprouting Leaves", days: 3, icon: "🌿" },
  { name: "Small Tree", days: 7, icon: "🌳" },
  { name: "Mature Tree", days: 15, icon: "🌲" },
  { name: "Peak Performer", days: 30, icon: "🏔️" }
];

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

// State for managing goals and popup visibility



const currentDayKey = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
const pointsAccumulated = ref(0);
const totalPoints = computed(() => selectedDayRoutine?.value?.length * 10); // Total points (10 points per task)



// Update points when tasks are completed
watch(
    () => selectedDayRoutine.value,
    (tasks) => {
      pointsAccumulated.value = tasks?.filter((task) => task.completed).length * 10;
    },
    { deep: true }
);




// Call checkStreak when component is mounted
onMounted(() => {

  checkStreakOnCompletion();
});
const formatDate = (date) => {
  if (!date) return "";
  const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
  return new Date(date).toLocaleDateString("en-US", options);
};
const milestones = ref([
  { label: '0%', percent: 0, position: 0, icon: '🌱' },      // Seed planted
  { label: '25%', percent: 25, position: 25, icon: '🌿' },   // Sprouting leaves
  { label: '50%', percent: 50, position: 50, icon: '🌳' },   // Small tree
  { label: '75%', percent: 75, position: 75, icon: '🌲' },   // Mature tree
  { label: '100%', percent: 100, position: 100, icon: '🏔️' } // Fully grown tree at the peak
]);
const getOrdinalSuffix = (number) => {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = number % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
};

const spinningTasks = ref([]);

const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison
  const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  console.log("Today's Date:", formattedDate); // Log the date for debugging
  return formattedDate;
};

// Call the function to see the output
const shouldDisplayTask = (task) => {
  if (!showCompleted && task.completed) return false;
  if (!task.reminder || !task.reminder.date) return true;
  const todayDate = getTodayDate();
  return task.reminder.date === todayDate;
};


watch(modalOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? "hidden" : "";
});

const removeNotification = async (task, index) => {
  if (!task || !task.reminder) return;

  // Remove reminder from UI
  task.reminder = null;
  selectedDayRoutine.value[index] = task;

  // Update Firestore
  try {
    const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];
      tasks[index].reminder = null;

      await updateDoc(selectedDayDocRef, {
        tasks: tasks,
        updatedAt: serverTimestamp(),
      });

      alert("Notification removed successfully.");
    }
  } catch (error) {
    console.error("Error removing notification:", error);
  }
};

// Function to check if a task is spinning
const isSpinning = (index) => {
  return spinningTasks.value[index] || false;
};
const completedTaskCount = computed(() => {
  return selectedDayRoutine.value?.filter(task => task.completed).length;
});
// Function to start spinning for a specific task
const startSpinning = (index) => {
  spinningTasks.value[index] = true;

  // Stop spinning after a set duration (e.g., 5 seconds)
  setTimeout(() => {
    spinningTasks.value[index] = false;
  }, 5000); // Adjust the duration as needed
};
const isLoading = ref(true);
onMounted(async () => {
  try {
    isLoading.value = true; // Start loading
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate data fetching

    // Safeguard to ensure selectedDayRoutine is defined and iterable
    if (!selectedDayRoutine.value || !Array.isArray(selectedDayRoutine.value)) {
      selectedDayRoutine.value = [];
    }

    // Iterate over tasks and update their 'completed' status if the date is in the past
    selectedDayRoutine.value.forEach((task) => {
      if (task.date) {
        const taskDate = new Date(task.date); // Assuming tasks have a `date` property in YYYY-MM-DD format
        const today = new Date();

        // Check if the task date is in the past
        if (taskDate < today) {
          task.completed = false; // Reset completed status
        }
      }
    });
  } catch (error) {
    console.error('Error loading tasks:', error);
  } finally {
    isLoading.value = false; // Stop loading after data is fetched
  }
});
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
.streak-icon {
  animation: pulse 1.5s infinite;
  transition: transform 0.3s ease-in-out;
}

.streak-icon:hover {
  transform: scale(1.1);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}


</style>
