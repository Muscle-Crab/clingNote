<template>
  <div ref="scrollContainer" class="scroll-container bg-gray-100 h-screen overflow-y-auto ">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <h1 class="loading-title">👋 Welcome!</h1>
        <p class="loading-text">Setting up your tasks...</p>
        <div class="loading-spinner"></div>
      </div>
    </div>

    <div v-else>
      <div class="streak-prompt-container max-w-4xl mx-auto p-4 sm:p-6">
        <!-- Streak and Credits Display -->
        <div
            class="streak-card rounded-lg p-4 sm:p-6 shadow-sm"
            :class="{
        'bg-red-50': streak < 3,
        'bg-yellow-50': streak >= 3 && streak < 7,
        'bg-green-50': streak >= 7
      }"
        >
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="text-2xl sm:text-3xl">{{ getStreakIcon(streak) }}</div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="text-sm sm:text-base font-semibold text-gray-600">🔥 Streak</span>
                  <span class="text-sm sm:text-base font-bold text-gray-900">
                {{ streak }} day<span v-if="streak !== 1">s</span>
              </span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-sm sm:text-base font-semibold text-gray-600">💎 Credits</span>
                  <span class="text-sm sm:text-base font-bold text-gray-900">{{ userCredits }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Modal -->
        <div
            v-if="showPaymentModal"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div class="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
            <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Out of Credits</h2>
            <p class="text-sm sm:text-base text-gray-600 mb-4">
              Pay a one-time $2 fee to continue generating AI routines, grocery lists, workouts, and more.
            </p>
            <ul class="text-sm sm:text-base text-gray-600 mb-6 space-y-2">
              <li>💡 Quick access with a small $2 fee</li>
              <li>✅ Works with prompts, voice, and image uploads</li>
              <li>⚡ Instant access after payment</li>
            </ul>
            <button
                @click="redirectToCheckout"
                class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition text-sm sm:text-base"
            >
              Continue – $2 💎
            </button>
            <button
                @click="showPaymentModal = false"
                class="w-full text-gray-600 mt-2 hover:text-gray-800 transition text-sm sm:text-base"
            >
              Maybe later
            </button>
          </div>
        </div>

        <!-- Generate Workout Routine Button -->
        <button
            @click="hasPaid ? generateWeeklyRoutine() : showPaymentModal = true"
            class="mt-4 w-full bg-green-600 text-white py-2 sm:py-3 px-4 rounded-md font-semibold text-sm sm:text-base"
            :class="{ 'hover:bg-green-700': hasPaid }"
        >
          Generate Workout Routine
        </button>


        <!-- Smart Prompt Input -->
<!--        <div class="mt-4">-->
<!--          <div class="flex items-start bg-gray-100 rounded-md p-2 sm:p-3">-->
<!--        <textarea-->
<!--            v-model="smartPrompt"-->
<!--            @keyup.enter="submitSmartPrompt"-->
<!--            placeholder="I need a list of items for..."-->
<!--            rows="1"-->
<!--            @input="$event.target.style.height = 'auto'; $event.target.style.height = $event.target.scrollHeight + 'px';"-->
<!--            class="flex-1 bg-transparent border-none outline-none resize-none text-sm sm:text-base text-gray-900 placeholder-gray-500"-->
<!--        ></textarea>-->
<!--            <div class="flex gap-2 ml-2">-->
<!--              <button-->
<!--                  @click="submitSmartPrompt"-->
<!--                  class="p-2 text-gray-600 hover:text-blue-600 transition"-->
<!--                  title="Send"-->
<!--              >-->
<!--                <svg-->
<!--                    xmlns="http://www.w3.org/2000/svg"-->
<!--                    class="w-5 h-5 sm:w-6 sm:h-6"-->
<!--                    fill="none"-->
<!--                    viewBox="0 0 24 24"-->
<!--                    stroke="currentColor"-->
<!--                >-->
<!--                  <path-->
<!--                      stroke-linecap="round"-->
<!--                      stroke-linejoin="round"-->
<!--                      stroke-width="2"-->
<!--                      d="M5 10l7-7m0 0l7 7m-7-7v18"-->
<!--                  />-->
<!--                </svg>-->
<!--              </button>-->
<!--              <button-->
<!--                  @click="triggerHandwritingUpload"-->
<!--                  class="p-2 text-gray-600 hover:text-green-600 transition"-->
<!--                  title="Upload Image"-->
<!--              >-->
<!--                <svg-->
<!--                    xmlns="http://www.w3.org/2000/svg"-->
<!--                    class="w-5 h-5 sm:w-6 sm:h-6"-->
<!--                    fill="none"-->
<!--                    viewBox="0 0 24 24"-->
<!--                    stroke="currentColor"-->
<!--                >-->
<!--                  <path-->
<!--                      stroke-linecap="round"-->
<!--                      stroke-linejoin="round"-->
<!--                      stroke-width="2"-->
<!--                      d="M3 7h2l2-3h10l2 3h2a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1zm9 3a4 4 0 100 8 4 4 0 000-8z"-->
<!--                  />-->
<!--                </svg>-->
<!--              </button>-->
<!--            </div>-->
<!--          </div>-->
<!--        </div>-->
      </div>

      <div v-if="showFullScreenAnimation" class="completion-overlay">
        <div class="completion-content">
          <h1 class="completion-title">🎉 All Tasks Completed! 🔥<span class="streak-highlight">{{ streak }}</span> days</h1>
          <p class="completion-text">Congratulations on completing all your tasks!</p>
          <button
              @click="closeFullScreenAnimation"
              class="completion-button"
          >
            Close
          </button>
        </div>
      </div>

      <div class="calendar-task-card sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div class="calendar-section">
          <div class="current-date">
            <div class="date-wrapper">
              <span class="date-text">{{ currentDate }}</span>
              <span class="days-left">
                <span class="animate-spin-slow">⏳</span> {{ daysLeftInYear }} days left
              </span>
            </div>
          </div>
          <div class="calendar-grid">
            <div
                v-for="(day, index) in days"
                :key="index"
                class="day-container"
                :class="{
                'day-default': !isToday(index) && !isSelected(index),
                'day-selected': isSelected(index),
                'day-today': isToday(index)
              }"
                @click="handleDayTabClick(index)"
            >
              <div class="day-name">{{ day.day }}</div>
              <div class="day-date">{{ day.date }}</div>
            </div>
          </div>
        </div>

        <div class="milestone-journey">
          <div class="progress-bar">
            <div
                class="progress-fill"
                :style="{ width: calculateCompletionPercentage(task) + '%' }"
            ></div>
          </div>
          <div
              v-for="(milestone, index) in milestones"
              :key="index"
              class="milestone"
              :style="{
              left: index === 0 ? '0%' : index === milestones.length - 1 ? '100%' : `${milestone.position}%`,
              transform: index === 0 ? 'translateX(0)' : index === milestones.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
            }"
          >
            <div
                class="milestone-icon"
                :class="{
                'milestone-active': calculateCompletionPercentage(task) > 0 && calculateCompletionPercentage(task) >= milestone.percent,
                'milestone-inactive': calculateCompletionPercentage(task) <= 0 || calculateCompletionPercentage(task) < milestone.percent
              }"
            >
              <div
                  class="milestone-icon-inner"
                  :class="{ 'animate-bounce': calculateCompletionPercentage(task) > 0 && calculateCompletionPercentage(task) >= milestone.percent }"
              >
                {{ milestone.icon }}
              </div>
            </div>
          </div>
          <div class="progress-text">
            Progress: {{ calculateCompletionPercentage(task) }}%
          </div>
        </div>
      </div>

      <div class="floating-buttons">
        <router-link
            :to="userId ? '#' : '/login'"
            @click.prevent="userId && openModal('task')"
            class="add-task-button"
        >
          <span class="button-overlay"></span>
          <svg class="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M12 4v16m8-8H4" />
          </svg>
        </router-link>
        <input
            ref="handwritingInput"
            type="file"
            accept="image/*"
            @change="handleHandwritingUpload"
            class="hidden"
        />
        <button
            @click="startVoiceInput"
            class="voice-button"
        >
          <span
              v-if="listening"
              class="voice-pulse"
          ></span>
          <svg xmlns="http://www.w3.org/2000/svg" class="button-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
        </button>
      </div>

      <div v-if="showTimerModal" class="modal-overlay">
        <div class="timer-modal">
          <h3 class="modal-title">Set a Timer</h3>
          <label class="modal-label">Select duration:</label>
          <select v-model="selectedTimerDuration" class="modal-select">
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </select>
          <div class="modal-buttons">
            <button @click="showTimerModal = false" class="modal-cancel">Cancel</button>
            <button @click="startTimer" class="modal-action">Start</button>
          </div>
        </div>
      </div>

      <div v-if="wontDoModalOpen" class="modal-overlay">
        <div class="wont-do-modal">
          <h2 class="modal-title">Mark as "Won't Do"</h2>
          <p class="modal-text">Why won't you do this task?</p>
          <textarea v-model="wontDoReason" class="modal-textarea"></textarea>
          <div class="modal-buttons">
            <button @click="wontDoModalOpen = false" class="modal-cancel">
              <i class="fa fa-times"></i>
            </button>
            <button @click="markTaskAsWontDo" class="modal-action">
              <i class="fa fa-check"></i>
            </button>
          </div>
        </div>
      </div>

      <div v-if="transferModalOpen" class="modal-overlay">
        <div class="transfer-modal">
          <h2 class="modal-title">Select a Day to Transfer</h2>
          <label for="transferDay" class="modal-label">Choose a day:</label>
          <select v-model="selectedTransferDay" id="transferDay" class="modal-select">
            <option v-for="(day, index) in days" :key="index" :value="index" :disabled="index === selectedDayIndex">
              {{ day.day }} - {{ day.date }}
            </option>
          </select>
          <div class="modal-buttons">
            <button @click="closeTransferModal" class="modal-cancel">Cancel</button>
            <button @click="transferTask()" class="modal-action">Transfer</button>
          </div>
        </div>
      </div>

      <div v-if="modalOpen" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Add Task</h3>
            <button @click="closeModal" class="modal-close">✕</button>
          </div>
          <form @submit.prevent="addNewTask" class="modal-form">
            <div class="modal-body">
              <div class="form-group">
                <label for="newTask" class="form-label">Task Name</label>
                <input
                    type="text"
                    v-model="newTask.title"
                    id="newTask"
                    class="form-input"
                    placeholder="Enter task name"
                    required
                />
              </div>
              <div class="form-group">
                <label for="reminderDateTime" class="form-label">Reminder</label>
                <input
                    type="datetime-local"
                    v-model="newTask.reminder.datetime"
                    id="reminderDateTime"
                    class="form-input"
                />
              </div>
              <div class="recurring-toggle">
                <span class="recurring-label">
                  {{ newTask.type === 'recurring' ? 'Recurring' : 'One-Time' }}
                </span>
                <button
                    type="button"
                    @click="toggleRecurring"
                    :class="['toggle-button', newTask.type === 'recurring' ? 'toggle-active' : 'toggle-inactive']"
                >
                  <i :class="newTask.type === 'recurring' ? 'fas fa-sync-alt' : 'fas fa-dot-circle'"></i>
                </button>
              </div>
              <div @click="showAdvanced = !showAdvanced" class="advanced-toggle">
                <span>Advanced Options</span>
                <i :class="showAdvanced ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
              </div>
              <transition name="fade">
                <div v-if="showAdvanced" class="advanced-section">
                  <div class="form-group">
                    <label class="form-label">Select Days</label>
                    <div class="days-checkboxes">
                      <label
                          v-for="(day, index) in days"
                          :key="index"
                          class="day-checkbox"
                      >
                        <input type="checkbox" :id="'day-' + index" :value="day" v-model="newTask.selectedDays" class="checkbox-input" />
                        {{ day.day }}
                      </label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="taskPosition" class="form-label">Insert Position</label>
                    <select
                        v-model="newTask.position"
                        id="taskPosition"
                        class="form-select"
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
                  </div>
                  <div class="form-group">
                    <label for="newTaskLabels" class="form-label">Labels</label>
                    <input
                        type="text"
                        v-model="newTask.labels"
                        id="newTaskLabels"
                        class="form-input"
                        placeholder="e.g., Work, Fitness"
                    />
                  </div>
                  <div class="form-group">
                    <label for="newTaskNotes" class="form-label">Notes</label>
                    <textarea
                        v-model="newTask.notes"
                        id="newTaskNotes"
                        class="form-textarea"
                        placeholder="Add more details..."
                    ></textarea>
                  </div>
                </div>
              </transition>
              <div v-if="error" class="error-message">{{ error }}</div>
            </div>
            <div class="modal-footer">
              <button type="submit" class="submit-button">Add Task</button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="youtubeModalOpen" class="modal-overlay">
        <div class="youtube-modal">
          <h2 class="modal-title">Attach YouTube Video</h2>
          <input
              type="url"
              v-model="youtubeInput"
              placeholder="https://www.youtube.com/watch?v=..."
              class="modal-input"
          />
          <div class="modal-buttons">
            <button @click="closeYouTubeModal" class="modal-cancel">Cancel</button>
            <button @click="saveYouTubeLink" class="modal-action">Save</button>
          </div>
        </div>
      </div>

      <div v-if="taskDetailModalOpen" class="modal-overlay">
        <div class="task-detail-modal">
          <div class="modal-header">
            <h3 class="modal-title">Task Details</h3>
            <button @click="closeTaskDetailModal" class="modal-close">
              <svg class="close-icon" fill="none" stroke="currentColor" stroke-width="2"
                   viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round"
                                             d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="task-title">{{ taskDetail.title }}</div>
            <div v-if="taskDetail.youtubeURL" class="youtube-embed">
              <iframe
                  :src="`https://www.youtube.com/embed/${extractYouTubeID(taskDetail.youtubeURL)}`"
                  class="youtube-frame"
                  height="250"
                  frameborder="0"
                  allowfullscreen
              ></iframe>
            </div>
            <div v-if="taskDetail.imageURL" class="task-image-container">
              <img
                  :src="taskDetail.imageURL"
                  class="task-image"
                  alt="Task Image"
                  @click="showImagePreview = true"
              />
              <button
                  @click="removeTaskAttachment('imageURL')"
                  class="remove-attachment"
                  title="Remove image"
              >
                ✕
              </button>
            </div>
            <div v-if="taskDetail.fileURL" class="task-file-container">
              <div class="file-link">
                📄
                <a
                    :href="taskDetail.fileURL"
                    target="_blank"
                    class="file-anchor"
                >
                  {{ taskDetail.fileName || 'Download File' }}
                </a>
              </div>
              <button
                  @click="removeTaskAttachment('fileURL')"
                  class="remove-attachment"
                  title="Remove file"
              >
                ✕
              </button>
            </div>
            <div v-if="taskDetail.reminder?.date && taskDetail.reminder?.time" class="task-detail-item">
              <svg class="detail-icon" fill="none" stroke="currentColor"
                   stroke-width="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>
              <span class="detail-label">Reminder:</span> {{ formatShortDate(taskDetail.reminder.date) }} at {{ formatTime(taskDetail.reminder.time) }}
            </div>
            <div v-if="taskDetail.notes" class="task-detail-item">
              <svg class="detail-icon" fill="none" stroke="currentColor"
                   stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l7 7v9a2 2 0 0 1-2 2z"/></svg>
              <div>
                <div class="detail-label">Notes:</div>
                <div class="detail-text">{{ taskDetail.notes }}</div>
              </div>
            </div>
            <div v-if="taskDetail.labels?.length" class="task-detail-item">
              <svg class="detail-icon" fill="none" stroke="currentColor"
                   stroke-width="2" viewBox="0 0 24 24"><path d="M7 7h10v10H7z"/></svg>
              <div>
                <div class="detail-label">Labels:</div>
                <div class="labels-container">
                  <span
                      v-for="(label, index) in taskDetail.labels"
                      :key="index"
                      @click="toggleLabelHighlight(label)"
                      :class="['label', activeLabels.includes(label) ? 'label-active' : 'label-inactive']"
                  >
                    {{ label }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeTaskDetailModal" class="modal-action">Close</button>
          </div>
        </div>
      </div>

      <div v-if="showImagePreview" class="image-preview" @click="showImagePreview = false">
        <img
            :src="taskDetail.imageURL"
            class="preview-image"
            alt="Full Image Preview"
        />
      </div>

      <div v-if="isModalOpen" class="modal-overlay">
        <div class="reminder-modal">
          <h2 class="modal-title">Add Reminder</h2>
          <p class="modal-text">
            Task: <span class="task-name">{{ selectedTaskTitle }}</span>
          </p>
          <form @submit.prevent="handleAddReminder">
            <label for="reminderDate" class="modal-label">Date:</label>
            <input type="date" v-model="reminder.date" id="reminderDate" class="modal-input" required>
            <label for="reminderTime" class="modal-label">Time:</label>
            <input type="time" v-model="reminder.time" id="reminderTime" class="modal-input" required>
            <label for="reminderRepeat" class="modal-label">Repeat:</label>
            <select v-model="reminder.repeat" id="reminderRepeat" class="modal-select">
              <option value="">No Repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <div class="modal-buttons">
              <button @click="closeModal" type="button" class="modal-cancel">Cancel</button>
              <button type="submit" class="modal-action">Add to Calendar</button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="listening" class="modal-overlay">
        <div class="voice-modal">
          <button
              @click="cancelVoiceInput"
              class="voice-cancel"
              title="Cancel"
          >
            ✕
          </button>
          <div class="voice-waveform">
            <div class="wave-bar"></div>
            <div class="wave-bar delay-100"></div>
            <div class="wave-bar delay-200"></div>
            <div class="wave-bar delay-300"></div>
          </div>
          <p class="voice-transcript">
            Listening: "<span class="transcript-text">{{ liveTranscript }}</span>"
          </p>
          <p class="voice-hint">Speak now, your task is being transcribed...</p>
        </div>
      </div>

      <div class="daily-routine">
        <div v-if="selectedDayRoutine?.length === 0" class="no-tasks">
          <img
              src="https://cdn.pixabay.com/photo/2017/02/01/11/12/bulb-2029707_640.png"
              alt="No tasks illustration"
              class="no-tasks-image"
          />
          <h2 class="no-tasks-title">No list item</h2>
          <p class="no-tasks-text">You don’t have any tasks for this day. Add a new task to get started.</p>
        </div>
        <div v-else>
          <div class="tasks-header">
            <h3 class="tasks-title">
              <span class="completed-label">Completed</span>
              <span class="completion-count">
                {{ completedTaskCount }}/{{ selectedDayRoutine?.length }}
              </span>
            </h3>
            <div class="tasks-actions">
              <button @click="clearTasksForToday" class="clear-button">🗑️</button>
              <button @click="showCompleted = !showCompleted">
                <i :class="showCompleted ? 'fas fa-eye text-gray-500' : 'fas fa-eye-slash text-gray-500'" class="toggle-icon"></i>
              </button>
            </div>
          </div>
          <div class="tasks-container">
            <draggable
                handle=".drag-handle"
                :animation="150"
                v-model="selectedDayRoutine"
                tag="div"
                class="tasks-list"
                ghost-class="ghost"
                drag-class="drag"
                @end="handleDragEnd"
            >
              <template #item="{ element: task, index }">
                <div
                    v-if="(!task.completed || (isToday(selectedDayIndex) && showCompleted))"
                    class="task-card"
                    :class="{ 'task-completed': task.completed && isToday(selectedDayIndex), 'task-important': task.important, 'draggable': taskIsDragging }"
                >
                  <div class="task-content">
                    <div class="drag-icon">
                      <div class="drag-icon-inner">
                        <i class="fas fa-arrows-alt drag-handle"></i>
                      </div>
                    </div>
                    <div class="task-details">
                      <div
                          class="task-title-text"
                          :class="{ 'task-completed-text': task.completed && isToday(selectedDayIndex) }"
                          @click="openTaskDetailModal(task)"
                      >
                        <span class="title-text">
                          {{ task.title.length > 18 ? task.title.slice(0, 18) + '...' : task.title }}
                        </span>
                        <span v-if="task.fileURL" class="file-indicator" title="File attached">📄</span>
                      </div>
                      <div v-if="task.reminder?.date && task.reminder?.time" class="task-reminder">
                        📅 {{ formatShortDate(task.reminder.date) }} • ⏰ {{ formatTime(task.reminder.time) }}
                      </div>
                      <div class="task-status">
                        <div v-if="!task.completed && isToday(selectedDayIndex)" class="status-incomplete">
                          <i class="fas fa-circle"></i> Incomplete
                        </div>
                        <button
                            @click="toggleTaskImportance(index)"
                            class="importance-toggle"
                            :title="task.important ? 'Marked as Important' : 'Mark as Important'"
                        >
                          <i :class="task.important ? 'fas fa-fire text-red-500' : 'fas fa-fire text-gray-400'" />
                        </button>
                        <div v-if="task.completed && isToday(selectedDayIndex)" class="status-completed">
                          <i class="fas fa-check-circle"></i> Completed
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="task.youtubeURL" class="task-youtube">
                    <img
                        :src="`https://img.youtube.com/vi/${extractYouTubeID(task.youtubeURL)}/0.jpg`"
                        alt="YouTube Thumbnail"
                        class="youtube-thumbnail"
                        @click="openTaskDetailModal(task)"
                    />
                  </div>
                  <div
                      @click="openTaskDetailModal(task)"
                      v-if="task.imageURL"
                      class="task-image"
                  >
                    <img
                        :src="task.imageURL"
                        alt="Task Image"
                        class="image-preview"
                    />
                  </div>
                  <div class="task-labels">
                    <span
                        v-for="(label, index) in task.labels"
                        :key="index"
                        @click="toggleLabelHighlight(label)"
                        :class="['task-label', activeLabels.includes(label) ? 'label-active' : 'label-inactive']"
                    >
                      {{ label }}
                    </span>
                  </div>
                  <div class="task-footer">
                    <div class="user-info"></div>
                    <div class="task-actions">
                      <button
                          v-if="isToday(selectedDayIndex)"
                          @click="() => toggleTaskCompletion(getOriginalIndex(task))"
                          class="completion-toggle"
                      >
                        <i
                            :class="task.completed ? 'fas fa-dot-circle text-green-500' : 'far fa-circle text-gray-400'"
                            class="completion-icon"
                        ></i>
                      </button>
                      <div v-if="iconVisibility[index]" class="action-buttons">
                        <button
                            @click="openModal('calendar', index, task.title)"
                            class="action-icon"
                        >
                          📅
                        </button>
                        <button
                            @click="deleteTask(index)"
                            class="action-icon delete-icon"
                        >
                          🗑️
                        </button>
                        <button
                            @click="openTransferModal(index)"
                            class="action-icon transfer-icon"
                        >
                          🔄
                        </button>
                        <button
                            @click="openWontDoModal(index)"
                            class="action-icon wont-do-icon"
                        >
                          🚫
                        </button>
                        <button @click="triggerImageUpload(index)" class="action-icon">📎</button>
                        <input
                            type="file"
                            :ref="'fileInput_' + index"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            @change="handleUpload($event, index)"
                            class="hidden"
                        />
                        <button
                            @click="showTimerModal = true"
                            class="action-icon timer-icon"
                            title="Start Timer"
                        >
                          ⏱️
                        </button>
                        <button
                            @click="openYouTubeModal(index)"
                            class="action-icon youtube-icon"
                            title="Add YouTube Video"
                        >
                          <i class="fab fa-youtube"></i>
                        </button>
                      </div>
                      <button
                          @click="toggleIcons(index)"
                          class="more-options"
                          title="More Options"
                      >
                        <svg class="more-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 3">
                          <path d="M2 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6.041 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="task-index">{{ index + 1 }}</div>
                  <div
                      v-if="showNotification"
                      class="notification-popup"
                  >
                    Create successfully
                  </div>
                  <div v-if="transferNotification" class="transfer-notification">
                    {{ transferNotification }}
                  </div>
                </div>
              </template>
            </draggable>
          </div>
          <div
              v-if="selectedDayRoutine?.length > 0 && selectedDayRoutine?.every(task => task.completed) && !showCompleted"
              class="idle-section"
          >
            <img
                src="@/assets/free.svg"
                alt="Idle Time Illustration"
                class="idle-image"
            />
            <h2 class="idle-title">It's Idle Time 🧘</h2>
            <p class="idle-text">
              You’ve completed all your tasks for today. Take a break and enjoy your free time!
            </p>
          </div>
          <div v-if="wontDoTasks.length != 0 && !selectedDayRoutine?.every(task => task.completed)" class="wont-do-section">
            <h3 class="wont-do-title">Won't Do Tasks</h3>
            <ul>
              <li v-for="(task, index) in wontDoTasks" :key="index" class="wont-do-item">
                <button @click="undoWontDo(index)" class="undo-button">
                  <i class="fas fa-undo"></i>
                </button>
                <span class="wont-do-text">{{ task.title }} - {{ task.wontDoReason }}</span>
              </li>
            </ul>
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
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import data from '@/data.json';
import draggable from "vuedraggable";
import {db} from '@/firebaseConfig'; // Assuming you have imported the Firebase setup file and exported the db instance
import { doc, setDoc, serverTimestamp, getDoc, updateDoc,getFirestore, deleteDoc} from 'firebase/firestore';
const modalOpen = ref(false);
import axios from 'axios';
import { deleteObject } from "firebase/storage";

import { getCurrentInstance } from 'vue';
import { getAuth } from "firebase/auth";
const { proxy } = getCurrentInstance();

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
const resetTasksToIncomplete = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const selectedDay = days[selectedDayIndex.value];
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay.day}`);

  try {
    const docSnap = await getDoc(selectedDayDocRef);
    if (!docSnap.exists()) {
      console.warn("No tasks to reset for this day.");
      return;
    }

    const existingTasks = docSnap.data().tasks || [];

    // Only reset if there are completed tasks to avoid unnecessary updates
    const hasCompletedTasks = existingTasks.some(task => task.completed);
    if (!hasCompletedTasks) {
      console.log(`No completed tasks to reset for ${selectedDay.day}.`);
      return;
    }

    const resetTasks = existingTasks.map(task => ({
      ...task,
      completed: false
    }));

    // Prevent streak logic from triggering on past days
    const todayIndex = new Date().getDay(); // 0 (Sun) - 6 (Sat)
    const isPastDay = selectedDayIndex.value < todayIndex;

    // Update Firestore
    await updateDoc(selectedDayDocRef, {
      tasks: resetTasks,
      updatedAt: serverTimestamp(),
      ...(isPastDay && { skipStreakUpdate: true }) // optional flag if you use it elsewhere
    });

    if (days[selectedDayIndex.value].day === selectedDay.day) {
      selectedDayRoutine.value = resetTasks;
    }

    console.log(`✅ Tasks for ${selectedDay.day} were reset to incomplete.`);
  } catch (error) {
    console.error("❌ Error resetting tasks:", error);
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
    await axios.post('https://onesignal.com/api/v1/notifications', notificationData, { headers });
    console.log('Scheduled notification successfully');

    // Display confirmation alert
    alert(`Task "${task.title}" has been scheduled successfully for ${formattedTime}!`);


  } catch (error) {
    console.error('Error scheduling notification:', error);
    alert("Failed to schedule the task. Please try again.");
  }
};

const sendNotificationToPlayer = async (userName, action) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Do not send notification if the user is excluded
  if (currentUser?.email === 'ds7513635@gmail.com') {
    console.log("⛔ Notification skipped for excluded email:", currentUser.email);
    return;
  }

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy', // OneSignal API Key
    'Content-Type': 'application/json'
  };

  const actionMessages = {
    created: {
      content: `${userName} created a new task!`,
      heading: "New Task Alert"
    },
    completed: {
      content: `${userName} completed a workout`,
      heading: "Workout Completed"
    }
  };

  const data = {
    app_id: "fc206a71-7d65-4cfa-b8b2-0c10548e1476", // OneSignal App ID
    included_segments: ['All'], // ✅ Send to all users
    contents: { en: actionMessages[action]?.content || "An action was performed." },
    headings: { en: actionMessages[action]?.heading || "Notification" }
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('✅ Notification sent to all users');
  } catch (error) {
    console.error('❌ Error sending notification:', error.response?.data || error.message);
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

      const isPastDay = new Date(selectedDay.date) < new Date(getTodayDate());

      // If it's a past day, reset all tasks to incomplete
      if (isPastDay) {
        tasks = tasks.map(task => ({
          ...task,
          completed: false
        }));

        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp()
        });
      }


      selectedDayRoutine.value = tasks;
    } else {
      selectedDayRoutine.value = [];
    }
  } catch (error) {
    console.error('Error fetching tasks for the selected day:', error);
    selectedDayRoutine.value = [];
  }
};

const days = data.days;
const showTimerModal = ref(false);
const selectedTimerDuration = ref(5); // default to 5 minutes

const startTimer = async () => {
  showTimerModal.value = false;
  const now = new Date();
  const endTime = new Date(now.getTime() + selectedTimerDuration.value * 60000); // in ms

  const formattedEndTime = endTime.toISOString();
  const formattedText = `${selectedTimerDuration.value} minute timer completed!`;

  const playerId = window.OneSignal.User.PushSubscription.id;

  if (!playerId) {
    alert("OneSignal not initialized");
    return;
  }

  const headers = {
    'Authorization': 'Bearer ZDZiZDk0NTktMjUwZS00NTQ4LWFhOTItNjBiZDZiMjVhYzYy',
    'Content-Type': 'application/json'
  };

  const notificationData = {
    app_id: "fc206a71-7d65-4cfa-b8b2-0c10548e1476",
    include_player_ids: [playerId],
    contents: { en: formattedText },
    headings: { en: "⏰ Timer Finished" },
    send_after: formattedEndTime
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', notificationData, { headers });
    alert(`Timer set for ${selectedTimerDuration.value} minutes! Notification will appear when done.`);
  } catch (error) {
    console.error('Failed to schedule timer:', error);
    alert("Timer scheduling failed.");
  }
};
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



const deleteTask = async (index) => {
  const confirmed = confirm("Are you sure you want to delete this task?");
  if (!confirmed) return;
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

const toggleTaskCompletion = async (index) => {
  const task = { ...selectedDayRoutine.value[index] }; // Create a copy of the task to avoid direct mutation
  task.completed = !task.completed; // Toggle the completed state
  startSpinning(index);
  if (task.completed) {

    // speak(`Great job! You completed the task: ${task.title}.`);
    announceNextTask(index); // Pass the index of the completed task
    const userName = await fetchUserName(userId.value);
    if (userName) {
      // await sendNotificationToPlayer(userName, "completed");
    }
  } else {

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
  await saveDailyPerformance();
  selectedDayRoutine.value = selectedDayRoutine.value.filter(task => !task.completed || showCompleted);
  showCompleted.value = true;
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
const handleDayTabClick = async (index) => {
  const todayIndex = new Date().getDay();

  // If it's not today and not already selected, reset tasks to incomplete
  if (index !== todayIndex && selectedDayIndex.value !== index) {
    selectedDayIndex.value = index;
    await resetTasksToIncomplete();
  }

  // Continue to load tasks and update date
  selectDate(index);
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
    speak("Congratulations! You are free to do whatever you want");
    updateStreakOnCompletion();
    fetchSelectedDayRoutine()// 🔥 Update streak progression
    await saveDailyPerformance();

    selectedDayRoutine.value = selectedDayRoutine.value.map(task => {
      if (task.type === "recurring") {
        return { ...task, completed: true }; // reset to incomplete
      }
      return null; // mark one-time task for removal
    }).filter(task => task !== null); // keep only recurring


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
  if (!userId.value) {
    console.log("No userId, skipping streak update");
    return;
  }

  const today = new Date().toLocaleDateString('en-CA');
  console.log('today',today)
  const streakDocRef = doc(db, 'streaks', userId.value);

  try {
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      lastCompletionDate.value = data.lastCompletionDate || null;
      streak.value = data.streak || 0;



      if (lastCompletionDate.value === today) {
        console.log("🛑 Streak already updated today. Skipping...");
        return;
      }


      streak.value += 1;
      lastCompletionDate.value = today;



      await updateDoc(streakDocRef, {
        streak: streak.value,
        lastCompletionDate: today,
        updatedAt: serverTimestamp(),
      });

      console.log(`✅ Streak updated to ${streak.value}`);
    } else {
      // No streak document yet
      await setDoc(streakDocRef, {
        streak: 1,
        lastCompletionDate: today,
        updatedAt: serverTimestamp()
      });

      streak.value = 1;
      lastCompletionDate.value = today;

      console.log("🔥 New streak started at 1");
    }

    checkForBadges();
    updateMotivationalMessage();
  } catch (error) {
    console.error("❌ Error in updateStreakOnCompletion:", error);
  }
};



const closeFullScreenAnimation = () => {
  showFullScreenAnimation.value = false;
  fetchSelectedDayRoutine()
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
const hasPaid = ref(false);
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId.value = user.uid;
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      hasPaid.value = userSnap.data().hasPaid === true;
    }

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
    important: false,
    time: '', // fallback in case reminder isn't set
    priority: newTask.value.priority,
    labels: labels,
    notes: newTask.value.notes,
    userId: userId.value,
    type: newTask.value.type,
    createdAt: new Date().toISOString()
  };

  // Parse datetime-local input if provided
  if (newTask.value.reminder?.datetime) {
    const dateObj = new Date(newTask.value.reminder.datetime);
    const date = dateObj.toISOString().split('T')[0];
    const time = dateObj.toTimeString().slice(0, 5); // "HH:MM"

    task.time = time;
    task.reminder = {
      date,
      time,
      repeat: newTask.value.reminder.repeat || ''
    };
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

      const position = parseInt(newTask.value.position, 10);
      existingTasks.splice(position, 0, task);

      await setDoc(selectedDayDocRef, {
        tasks: existingTasks,
        updatedAt: serverTimestamp()
      });

      if (selectedDay.day === days[selectedDayIndex.value].day) {
        selectedDayRoutine.value = [...existingTasks].sort((a, b) => {
          return new Date('1970/01/01T' + a.time) - new Date('1970/01/01T' + b.time);
        });
      }
    }

    if (task.reminder) {
      await scheduleNotification(task, task.reminder);
    }

    newTask.value = {
      title: '',
      time: '',
      priority: 'low',
      labels: [],
      notes: '',
      selectedDays: [],
      position: 0,
      reminder: { datetime: '', repeat: '' },
      type: 'recurring'
    };
    closeModal();
    error.value = '';

    const userName = await fetchUserName(userId.value);
    if (userName) {
      // await sendNotificationToPlayer(userName, "created");
    }
  } catch (error) {
    console.error('Error adding task:', error);
  }
};






const userCredits = ref(0);




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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);


  try {
    const streakDocRef = doc(db, 'streaks', userId.value);
    const streakDocSnapshot = await getDoc(streakDocRef);

    if (streakDocSnapshot.exists()) {
      const data = streakDocSnapshot.data();
      lastCompletionDate.value = data.lastCompletionDate || null;
      streak.value = data.streak || 0
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

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
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

      // Prevent multiple reductions in a single day
      if (lastCompletionDate.value === todayStr) {
        console.log("Streak already updated today, skipping check.");
        return;
      }

      const yesterdayTasksCompleted = await checkIfTasksCompleted(yesterdayStr);

      if (!yesterdayTasksCompleted) {
        streak.value = Math.max(streak.value - 1, 0);
        console.log("Streak reduced due to incomplete tasks on the previous day.");

        await updateDoc(streakDocRef, {
          streak: streak.value,
          lastCompletionDate: todayStr, // Update last checked date to today
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.error("Error reducing streak:", error);
  }
};

// Function to check if tasks were completed for a given date
const checkIfTasksCompleted = async (dateStr) => {
  const selectedDay = days.find(day => day.date === dateStr);
  if (!selectedDay) return false;

  const selectedDayDocRef = doc(db, "weeklyRoutines", `${userId.value}_${selectedDay.day}`);
  const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);

  if (selectedDayDocSnapshot.exists()) {
    const tasks = selectedDayDocSnapshot.data().tasks || [];
    return tasks.every(task => task.completed); // Return true if all tasks were completed
  }

  return false;
};


// watch(currentDate, async () => {
//   const todayStr = new Date().toISOString().split('T')[0];
//
//   const streakDocRef = doc(db, 'streaks', userId.value);
//   const streakDocSnap = await getDoc(streakDocRef);
//
//   if (streakDocSnap.exists()) {
//     const data = streakDocSnap.data();
//     const lastChecked = data.lastCheckedDate;
//
//     if (lastChecked !== todayStr) {
//       await checkTasksAndReduceStreak(); // already defined
//       await updateDoc(streakDocRef, {
//         lastCheckedDate: todayStr,
//         updatedAt: serverTimestamp()
//       });
//     }
//   }
// });

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

// // Start the daily check when the component is mounted
// onMounted(() => {
//   startDailyCheck();
// });

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



watch(modalOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? "hidden" : "";
});


// Function to check if a task is spinning
const isSpinning = (index) => {
  return spinningTasks.value[index] || false;
};

const completedTaskCount = computed(() => {
  return selectedDayRoutine.value?.filter(task => task.completed).length;
});
const listening = ref(false);
let recognition;
const liveTranscript = ref('');
// Initialize SpeechRecognition only if supported
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening.value = true;
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    listening.value = false;
  };

  recognition.onend = () => {
    listening.value = false;
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    liveTranscript.value = transcript;
    newTask.value.title = transcript;
    addNewTask(); // Your existing save function
    recognition.stop();
  };
} else {
  console.warn("Speech recognition not supported in this browser.");
}
recognition.interimResults = true;

recognition.onresult = (event) => {
  let transcript = '';
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    transcript += event.results[i][0].transcript;
  }

  liveTranscript.value = transcript.trim();

  if (event.results[event.results.length - 1].isFinal) {
    newTask.value.title = transcript.trim();
    addNewTask();
    liveTranscript.value = null
    recognition.stop();
  }
};
const cancelVoiceInput = () => {
  if (recognition) recognition.stop();
  listening.value = false;
  liveTranscript.value = '';
};

const startVoiceInput = () => {
  if (recognition) recognition.start();
};

function toggleRecurring() {
  console.log('Clicked! Current type:', newTask.value.type)
  newTask.value.type = newTask.value.type === 'recurring' ? 'one-time' : 'recurring'
  console.log('New type:', newTask.value.type)
}




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
const taskDetailModalOpen = ref(false);
const taskDetail = ref({});
const openTaskDetailModal = (task) => {
  taskDetail.value = task;
  taskDetailModalOpen.value = true;
};

const closeTaskDetailModal = () => {
  taskDetailModalOpen.value = false;
  taskDetail.value = {};
};
const triggerImageUpload = (index) => {
  const inputRef = `fileInput_${index}`;
  const input = proxy.$refs[inputRef];
  if (input) input.click();
};
const handleUpload = async (event, taskIndex) => {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('File size must be under 5MB.');
    return;
  }

  const isImage = file.type.startsWith('image/');
  const isDoc = file.type.includes('pdf') || file.type.includes('msword') || file.type.includes('text');

  if (!isImage && !isDoc) {
    alert('Only images or common documents allowed.');
    return;
  }

  const storage = getStorage();
  const path = isImage ? 'task_images' : 'task_files';
  const fileRef = storageRef(storage, `${path}/${userId.value}_${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);

  // Update task with appropriate URL
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);
  const docSnap = await getDoc(selectedDayDocRef);
  if (!docSnap.exists()) return;

  const tasks = docSnap.data().tasks;
  if (isImage) {
    tasks[taskIndex].imageURL = downloadURL;
  } else {
    tasks[taskIndex].fileURL = downloadURL;
    tasks[taskIndex].fileName = file.name;
  }

  await updateDoc(selectedDayDocRef, { tasks });
  selectedDayRoutine.value[taskIndex] = tasks[taskIndex];
};

const removeTaskAttachment = async (field) => {
  if (!taskDetail.value?.[field]) return;

  const confirmed = confirm(`Are you sure you want to remove this ${field.includes("image") ? "image" : "file"}?`);
  if (!confirmed) return;

  try {
    const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);
    const docSnap = await getDoc(selectedDayDocRef);

    if (docSnap.exists()) {
      const tasks = docSnap.data().tasks;
      const taskIndex = tasks.findIndex(t =>
          t.title === taskDetail.value.title &&
          t.createdAt === taskDetail.value.createdAt
      );

      if (taskIndex !== -1) {
        const url = taskDetail.value[field];

        // Optionally delete from Firebase Storage
        if (url?.includes('firebase')) {
          const fileRef = storageRef(getStorage(), url);
          await deleteObject(fileRef);
        }

        // Remove the file/image fields
        tasks[taskIndex][field] = null;

        // If file, also remove name/type
        if (field === 'fileURL') {
          tasks[taskIndex].fileName = null;
          tasks[taskIndex].fileType = null;
        }

        await updateDoc(selectedDayDocRef, { tasks });

        // Update local state
        selectedDayRoutine.value[taskIndex][field] = null;
        taskDetail.value[field] = null;
        if (field === 'fileURL') {
          taskDetail.value.fileName = null;
          taskDetail.value.fileType = null;
        }

        console.log(`${field} removed.`);
      }
    }
  } catch (error) {
    console.error(`Error removing ${field}:`, error);
  }
};

const showImagePreview = ref(false);
const toggleTaskImportance = async (index) => {
  const task = { ...selectedDayRoutine.value[index] };
  task.important = !task.important;

  // Voice feedback
  const voiceMessage = task.important ? 'Marked as important' : 'No longer marked as important';
  speak(voiceMessage);

  // Update local array
  selectedDayRoutine.value.splice(index, 1, task);

  // Update Firestore
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);
  const docSnap = await getDoc(selectedDayDocRef);
  if (!docSnap.exists()) return;

  const tasks = docSnap.data().tasks;
  tasks[index] = task;
  await updateDoc(selectedDayDocRef, { tasks });
};

const saveDailyPerformance = async () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const docRef = doc(db, 'dailyReports', `${userId.value}_${dateStr}`);

  const completedCount = selectedDayRoutine.value.filter(task => task.completed).length;
  const totalCount = selectedDayRoutine.value.length + wontDoTasks.value.length;

  const streakGained = totalCount > 0 && completedCount === totalCount;

  await setDoc(docRef, {
    userId: userId.value,
    date: dateStr,
    totalTasks: totalCount,
    completedTasks: completedCount,
    streakGained,
    updatedAt: serverTimestamp()
  });

  console.log("✅ Daily performance saved.");
};
const activeLabels = ref([]);

function toggleLabelHighlight(label) {
  const index = activeLabels.value.indexOf(label);
  if (index > -1) {
    activeLabels.value.splice(index, 1); // remove label
  } else {
    activeLabels.value.push(label); // add label
  }
}

const daysLeftInYear = computed(() => {
  const today = new Date();
  const endOfYear = new Date(today.getFullYear(), 11, 31); // December 31
  const diffTime = endOfYear - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});
onMounted(() => {
  setTimeout(() => {
    speak(`Only ${daysLeftInYear.value} days left in the year. Make them count.`);
  }, 3000); // Delay for dramatic effect
});
const youtubeModalOpen = ref(false);
const selectedYouTubeTaskIndex = ref(null);
const youtubeInput = ref('');
const openYouTubeModal = (index) => {
  selectedYouTubeTaskIndex.value = index;
  youtubeInput.value = selectedDayRoutine.value[index].youtubeURL || '';
  youtubeModalOpen.value = true;
};

const closeYouTubeModal = () => {
  youtubeModalOpen.value = false;
  youtubeInput.value = '';
}

const saveYouTubeLink = async () => {
  const index = selectedYouTubeTaskIndex.value;
  const url = youtubeInput.value.trim();

  // Validate URL
  const isValidYouTubeURL = url.match(
      /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );

  if (!isValidYouTubeURL) {
    alert('Please enter a valid YouTube or YouTube Shorts URL.');
    return;
  }

  const task = selectedDayRoutine.value[index];
  task.youtubeURL = url;

  const day = days[selectedDayIndex.value].day;
  const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${day}`);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const tasks = docSnap.data().tasks;
  tasks[index] = task;

  await updateDoc(docRef, { tasks });
  selectedDayRoutine.value[index] = task;

  closeYouTubeModal();
};
const extractYouTubeID = (url) => {
  // Handle regular YouTube URLs (watch?v=) and Shorts URLs (/shorts/)
  const regex = /(?:\?v=|\/embed\/|\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : '';
};
const triggerHandwritingUpload = () => {
  if (!hasPaid.value) {
    showPaymentModal.value = true;
    return;
  }
  proxy.$refs.handwritingInput.click();
};
const showPaymentModal = ref('')
const handleHandwritingUpload = async (event) => {
  const file = event.target.files[0];
  const OPENAI_API_KEY = process.env.VUE_APP_OPENAI_API_KEY;
  if (!file) return;

  if (!hasPaid.value) {
    showPaymentModal.value = true;
    return;
  }

  if (userCredits.value <= 0) {
    showPaymentModal.value = true;
    return;
  }

  isLoading.value = true; // ⏳ Start loading

  const reader = new FileReader();
  reader.onload = async () => {
    const base64Image = reader.result.split(',')[1];

    try {
      const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `You're an AI handwriting interpreter. Extract all handwritten list items from this image. Ignore logos, backgrounds, printed text, or cartoons. Return only this JSON format: { "tasks": ["item1", "item2", "..."] }. The handwriting may be joined, cursive, or angled.`
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                  }
                ]
              }
            ],
            temperature: 0.3,
            max_tokens: 1000
          },
          {
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
      );

      let raw = response.data.choices[0].message.content.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/```json|```/g, "").trim();
      }

      const parsed = JSON.parse(raw);
      await saveHandwrittenTasks(parsed.tasks);
      await deductCredit(); // ✅ Only deduct if successful
    } catch (err) {
      console.error("❌ Image analysis failed:", err);
      alert("Could not extract tasks. Make sure it's a clear list.");
    } finally {
      isLoading.value = false; // ✅ Always stop loading
    }
  };

  reader.readAsDataURL(file);
};

const fetchImageURL = async (query) => {
  const UNSPLASH_ACCESS_KEY = "T2U---vjy9dd98hEz35rP4-Zb8g8LjP-HYnx..."; // Your key

  try {
    const response = await axios.get("https://api.unsplash.com/search/photos", {
      params: { query, per_page: 1 },
      headers: {
        Authorization: `Client-ID T2U--vjy9dd98hEz35rP4-Zb8g8LjP-HYnxtkSf4Gsw`
      }
    });

    const results = response.data.results;
    if (results.length > 0) {
      return results[0].urls.small; // or .regular
    } else {
      console.warn("No image found for:", query);
      return null;
    }
  } catch (error) {
    console.error("Image fetch failed:", error);
    return null;
  }
};


const saveHandwrittenTasks = async (tasks) => {
  const today = days[selectedDayIndex.value].day;
  const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${today}`);
  const snapshot = await getDoc(docRef);
  const existing = snapshot.exists() ? snapshot.data().tasks || [] : [];

  const formatted = await Promise.all(tasks.map(async (t) => {
    const imageURL = await fetchImageURL(t);
    return {
      title: t,
      completed: false,
      type: 'recurring',
      imageURL,
      createdAt: new Date().toISOString()
    };
  }));

  await setDoc(docRef, {
    tasks: [...existing, ...formatted],
    updatedAt: serverTimestamp()
  });

  fetchSelectedDayRoutine(); // Refresh
  alert(`📝 Added ${formatted.length} tasks from list with images.`);
};


const redirectToCheckout = async () => {
  try {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: userId.value }),
    });

    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      console.error('Invalid response from checkout session:', data);
    }
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
  }
};
const getOriginalIndex = (task) => {
  return selectedDayRoutine.value.findIndex(t =>
      t.title === task.title &&
      t.createdAt === task.createdAt
  );
};
const smartPrompt = ref('');
let smartRecognition;
const submitSmartPrompt = async () => {
  if (!smartPrompt.value.trim()) return;

  isLoading.value = true; // 👉 Start loading

  try {
    await convertPromptToTasks(smartPrompt.value.trim()); // 🧠 Generate tasks first
    await deductCredit(); // ✅ Deduct credit only if generation succeeds
    smartPrompt.value = '';
  } catch (error) {
    console.error("❌ Task generation failed:", error);
    alert("Failed to generate tasks.");
  } finally {
    isLoading.value = false; // ✅ Stop loading
  }
};




const convertPromptToTasks = async (promptText) => {
  const OPENAI_API_KEY = process.env.VUE_APP_OPENAI_API_KEY;
  if (!hasPaid.value) {
    showPaymentModal.value = true;
    return;
  }

  if (userCredits.value <= 0) {
    showPaymentModal.value = true;
    return;
  }
  try {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `You are an intelligent assistant that transforms any list-related idea into a clear, structured checklist. The list can be for anything: routines, travel, shopping, recipes, study, cleaning, or goals.

Your job is to extract only the list items from the input and return them in clean JSON format like this:
{
  "tasks": ["item 1", "item 2", "item 3"]
}

Do not include explanations, formatting, or markdown. Only return the JSON object.

Input: "${promptText}"`
            }
          ],

          temperature: 0.3,
          max_tokens: 500
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
    );

    let content = response.data.choices[0].message.content.trim();
    if (content.startsWith("```")) content = content.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(content);
    if (parsed.tasks?.length) {
      saveHandwrittenTasks(parsed.tasks);
    }
  } catch (err) {
    console.error("Failed to convert input to tasks:", err);
    alert("Could not understand your input.");
  }
};
const iconVisibility = ref({});

const toggleIcons = (index) => {
  iconVisibility.value[index] = !iconVisibility.value[index];
};
const deductCredit = async () => {
  if (!userId.value) return;

  const userDocRef = doc(db, 'users', userId.value);
  const snapshot = await getDoc(userDocRef);
  if (!snapshot.exists()) return;

  const currentCredits = snapshot.data().credits || 0;
  const newCredits = Math.max(currentCredits - 1, 0); // Prevent negative
  const stillPaid = newCredits > 0;

  await updateDoc(userDocRef, {
    credits: newCredits,
    hasPaid: stillPaid, // ✅ Set to false if no credits remain
  });

  userCredits.value = newCredits;
  hasPaid.value = stillPaid;

  console.log(`🔻 Deducted 1 credit. New total: ${newCredits}. hasPaid: ${stillPaid}`);
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId.value = user.uid;
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {

      console.log("🆕 New user – default credits set.");
    } else {
      const data = userSnap.data();
      hasPaid.value = data.hasPaid === true;
      userCredits.value = typeof data.credits === "number" ? data.credits : 0;
      console.log("👤 Existing user – credits loaded:", userCredits.value);
    }


    // Proceed with fetching data
    fetchStreakOnLoad();
    selectedDayIndex.value = new Date().getDay();
    fetchSelectedDayRoutine();
  } else {
    userId.value = null;
    selectedDayRoutine.value = [];
  }
});
const clearTasksForToday = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const confirmDelete = confirm("Are you sure you want to delete all tasks for today?");
  if (!confirmDelete) return;

  const selectedDay = days[selectedDayIndex.value].day;
  const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay}`);

  try {
    await deleteDoc(docRef);
    selectedDayRoutine.value = []; // Clear UI
    wontDoTasks.value = [];        // Also clear Won't Do list
    console.log("✅ All tasks deleted for today.");
  } catch (error) {
    console.error("❌ Failed to delete all tasks:", error);
    alert("Something went wrong while deleting tasks.");
  }
};
const generateWeeklyRoutine = async () => {
  const bicepsCurlURL = 'https://youtube.com/shorts/GW33A9LuhEM?si=iq81gm3B-G03f3g9';
  const chestPressURL = 'https://youtube.com/shorts/zcbXxYgb-CU?si=u-R8vhkZyoTx4dhE';
  const tricepsExtensionURL = 'https://youtube.com/shorts/fL26cjEQd_0?si=J8O6lJj9eCLGGIfe';
  const backRowURL = 'https://youtube.com/shorts/-o85-MnlVbg?si=FTFv6diD5ibZI0pr';
  const shoulderPressURL = 'https://www.youtube.com/watch?v=NtaPROZOcmM';
  const squatsURL = 'https://www.youtube.com/watch?v=aclHkVaku9U';
  const gluteBridgeURL = 'https://www.youtube.com/watch?v=wPM8icPu6H8';
  const pushupsURL = 'https://www.youtube.com/watch?v=IODxDxX7oi4';
  const plankURL = 'https://www.youtube.com/watch?v=pSHjTRCQxIw';
  const situpsURL = 'https://www.youtube.com/watch?v=1fbU_MkV7NE';

  // Big 3 every day + 2 resistance extras, Sun = rest
  const routineMap = {
    Mon: [
      { title: '30 Pushups', youtubeURL: pushupsURL },
      { title: '30 Situps', youtubeURL: situpsURL },
      { title: '30 Squats', youtubeURL: squatsURL },
      { title: '20 Chest Presses', youtubeURL: chestPressURL },
      { title: '20 Triceps Extensions', youtubeURL: tricepsExtensionURL }
    ],
    Tue: [
      { title: '30 Pushups', youtubeURL: pushupsURL },
      { title: '30 Situps', youtubeURL: situpsURL },
      { title: '30 Squats', youtubeURL: squatsURL },
      { title: '20 Back Rows', youtubeURL: backRowURL },
      { title: '20 Biceps Curls', youtubeURL: bicepsCurlURL }
    ],
    Wed: [
      { title: '30 Pushups', youtubeURL: pushupsURL },
      { title: '30 Situps', youtubeURL: situpsURL },
      { title: '30 Squats', youtubeURL: squatsURL },
      { title: '20 Shoulder Presses', youtubeURL: shoulderPressURL },
      { title: '20 Chest Presses', youtubeURL: chestPressURL }
    ],
    Thu: [
      { title: '30 Pushups', youtubeURL: pushupsURL },
      { title: '30 Situps', youtubeURL: situpsURL },
      { title: '30 Squats', youtubeURL: squatsURL },
      { title: '20 Triceps Extensions', youtubeURL: tricepsExtensionURL },
      { title: '20 Shoulder Presses', youtubeURL: shoulderPressURL }
    ],
    Fri: [
      { title: '30 Pushups', youtubeURL: pushupsURL },
      { title: '30 Situps', youtubeURL: situpsURL },
      { title: '30 Squats', youtubeURL: squatsURL },
      { title: '20 Back Rows', youtubeURL: backRowURL },
      { title: '20 Biceps Curls', youtubeURL: bicepsCurlURL }
    ],
    Sat: [
      { title: '30 Pushups', youtubeURL: pushupsURL },
      { title: '30 Situps', youtubeURL: situpsURL },
      { title: '30 Squats', youtubeURL: squatsURL },
      { title: '20 Glute Bridges (each leg)', youtubeURL: gluteBridgeURL },
      { title: '60-sec Plank', youtubeURL: plankURL }
    ],
    Sun: [] // Rest day
  };

  const daysToGenerate = days.filter(day => day.day !== 'Sun'); // exclude Sunday

  for (const day of daysToGenerate) {
    const taskList = routineMap[day.day];
    if (!taskList) continue;

    const docRef = doc(db, 'weeklyRoutines', `${userId.value}_${day.day}`);
    const snapshot = await getDoc(docRef);
    const existingTasks = snapshot.exists() ? snapshot.data().tasks || [] : [];

    const newTasks = taskList.map(task => ({
      ...task,
      completed: false,
      important: false,
      type: 'recurring',
      focus: 'resistance',
      createdAt: new Date().toISOString()
    }));

    await setDoc(docRef, {
      tasks: [...existingTasks, ...newTasks],
      updatedAt: serverTimestamp()
    });

    if (days[selectedDayIndex.value].day === day.day) {
      fetchSelectedDayRoutine();
    }
  }

  alert('✅ 6-Day Resistance Plan Created (Sun = Rest)!');
};









</script>

<style scoped>



.scroll-container {
position: relative;
max-width: 100%;
margin: 0 auto;
padding: 0;
overflow-x: hidden;
}

.loading-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.7);
display: flex;
justify-content: center;
align-items: center;
z-index: 50;
}

.loading-content {
text-align: center;
color: white;
}

.loading-title {
font-size: 2rem;
font-weight: bold;
margin-bottom: 1rem;
}

.loading-text {
font-size: 1.2rem;
margin-bottom: 1.5rem;
}

.loading-spinner {
width: 40px;
height: 40px;
border: 4px solid #fff;
border-top-color: #3b82f6;
border-radius: 50%;
animation: spin 1s linear infinite;
}

@keyframes spin {
to {
transform: rotate(360deg);
}
}

.streak-display {
display: flex;
justify-content: space-between;
align-items: center;
padding: 1rem;
margin: 1rem;
border-radius: 0.5rem;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.streak-low {
background-color: #fef2f2;
}

.streak-medium {
background-color: #fefcbf;
}

.streak-high {
background-color: #d1fae5;
}

.streak-info {
display: flex;
align-items: center;
gap: 1rem;
}

.streak-icon-container {
display: flex;
align-items: center;
}

.streak-icon {
font-size: 2rem;
}

.streak-details {
display: flex;
align-items: center;
gap: 1rem;
}

.streak-count, .credits-info {
display: flex;
align-items: center;
gap: 0.5rem;
}

.streak-emoji, .credits-emoji {
font-size: 1.25rem;
}

.streak-label, .credits-label {
font-size: 0.875rem;
color: #6b7280;
}

.streak-value, .credits-value {
font-size: 1rem;
font-weight: 600;
}

.divider {
height: 1.5rem;
width: 1px;
background-color: #d1d5db;
}

.payment-modal-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.5);
display: flex;
justify-content: center;
align-items: center;
z-index: 50;
}

.payment-modal {
background: white;
padding: 1.5rem;
border-radius: 0.5rem;
width: 90%;
max-width: 400px;
text-align: center;
}

.payment-title {
font-size: 1.5rem;
font-weight: bold;
margin-bottom: 1rem;
}

.payment-text {
font-size: 1rem;
color: #4b5563;
margin-bottom: 1rem;
}

.payment-features {
text-align: left;
margin-bottom: 1.5rem;
color: #4b5563;
}

.payment-features li {
margin-bottom: 0.5rem;
}

.payment-button {
background-color: #3b82f6;
color: white;
padding: 0.75rem 1.5rem;
border-radius: 0.375rem;
font-weight: 500;
margin-bottom: 1rem;
width: 100%;
cursor: pointer;
}

.payment-button:hover {
background-color: #2563eb;
}

.payment-cancel {
color: #6b7280;
background: none;
border: none;
cursor: pointer;
}

.payment-cancel:hover {
color: #4b5563;
}

.generate-button {
background-color: #10b981;
color: white;
padding: 0.75rem 1.5rem;
border-radius: 0.375rem;
font-weight: 500;
margin: 1rem;
width: calc(100% - 2rem);
cursor: pointer;
}

.generate-button:hover {
background-color: #059669;
}

.prompt-container {
padding: 1rem;
}

.prompt-input-wrapper {
display: flex;
align-items: center;
background: #f3f4f6;
border-radius: 0.375rem;
padding: 0.5rem;
}

.prompt-textarea {
flex: 1;
background: transparent;
border: none;
outline: none;
resize: none;
font-size: 1rem;
color: #1f2937;
min-height: 2.5rem;
}

.prompt-actions {
display: flex;
gap: 0.5rem;
}

.action-button {
background: none;
border: none;
cursor: pointer;
padding: 0.5rem;
}

.action-icon {
width: 1.5rem;
height: 1.5rem;
}

.send-button:hover .action-icon {
stroke: #3b82f6;
}

.upload-button:hover .action-icon {
stroke: #10b981;
}

.completion-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.7);
display: flex;
justify-content: center;
align-items: center;
z-index: 50;
}

.completion-content {
background: white;
padding: 2rem;
border-radius: 0.5rem;
text-align: center;
}

.completion-title {
font-size: 1.5rem;
font-weight: bold;
margin-bottom: 1rem;
}

.streak-highlight {
color: #ef4444;
}

.completion-text {
font-size: 1rem;
color: #4b5563;
margin-bottom: 1.5rem;
}

.completion-button {
background-color: #3b82f6;
color: white;
padding: 0.75rem 1.5rem;
border-radius: 0.375rem;
font-weight: 500;
cursor: pointer;
}

.completion-button:hover {
background-color: #2563eb;
}

.calendar-task-card {
margin: 1rem;
}

.calendar-section {
background: white;
border-radius: 0.5rem;
padding: 1rem;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.current-date {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 1rem;
}

.date-wrapper {
display: flex;
flex-direction: column;
}

.date-text {
font-size: 1.25rem;
font-weight: 600;
}

.days-left {
font-size: 0.875rem;
color: #6b7280;
}

.animate-spin-slow {
display: inline-block;
animation: spin 3s linear infinite;
}

.calendar-grid {
display: grid;
grid-template-columns: repeat(7, 1fr);
gap: 0.5rem;
}

.day-container {
text-align: center;
padding: 0.5rem;
cursor: pointer;
border-radius: 0.375rem;
}

.day-default {
background: #f3f4f6;
}

.day-selected {
background: #3b82f6;
color: white;
}

.day-today {
border: 2px solid #ef4444;
}

.day-name {
font-size: 0.875rem;
font-weight: 500;
}

.day-date {
font-size: 0.75rem;
}

.milestone-journey {
position: relative;
margin-top: 1rem;
}

.progress-bar {
height: 0.5rem;
background: #e5e7eb;
border-radius: 0.25rem;
overflow: hidden;
}

.progress-fill {
height: 100%;
background: #10b981;
transition: width 0.3s ease;
}

.milestone {
position: absolute;
top: -1.5rem;
text-align: center;
}

.milestone-icon {
font-size: 1.5rem;
}

.milestone-active .milestone-icon-inner {
color: #10b981;
}

.milestone-inactive .milestone-icon-inner {
color: #9ca3af;
}

.animate-bounce {
animation: bounce 1s infinite;
}

@keyframes bounce {
0%, 100% {
transform: translateY(0);
}
50% {
transform: translateY(-5px);
}
}

.progress-text {
text-align: center;
font-size: 0.875rem;
color: #4b5563;
margin-top: 0.5rem;
}

.floating-buttons {
position: fixed;
bottom: 1rem;
right: 1rem;
display: flex;
flex-direction: column;
gap: 0.5rem;
z-index: 40;
}

.add-task-button, .voice-button {
position: relative;
width: 3rem;
height: 3rem;
background: #3b82f6;
color: white;
border-radius: 50%;
display: flex;
justify-content: center;
align-items: center;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
cursor: pointer;
}

.add-task-button:hover, .voice-button:hover {
background: #2563eb;
}

.button-overlay {
position: absolute;
top: 0;
left: 0;
width: 100%;
height: 100%;
border-radius: 50%;
background: rgba(0, 0, 0, 0.1);
opacity: 0;
transition: opacity 0.3s;
}

.add-task-button:hover .button-overlay {
opacity: 1;
}

.button-icon {
width: 1.5rem;
height: 1.5rem;
}

.voice-pulse {
position: absolute;
width: 100%;
height: 100%;
background: rgba(59, 130, 246, 0.3);
border-radius: 50%;
animation: pulse 1.5s infinite;
}

@keyframes pulse {
0% {
transform: scale(1);
opacity: 1;
}
100% {
transform: scale(1.5);
opacity: 0;
}
}

.hidden {
display: none;
}

.modal-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.5);
display: flex;
justify-content: center;
align-items: center;
z-index: 50;
}

.timer-modal, .wont-do-modal, .transfer-modal, .modal-content, .youtube-modal, .task-detail-modal, .reminder-modal {
background: white;
padding: 1.5rem;
border-radius: 0.5rem;
width: 90%;
max-width: 400px;
}

.modal-title {
font-size: 1.25rem;
font-weight: 600;
margin-bottom: 1rem;
}

.modal-label {
font-size: 0.875rem;
color: #4b5563;
margin-bottom: 0.5rem;
display: block;
}

.modal-select, .modal-input {
width: 100%;
padding: 0.5rem;
border: 1px solid #d1d5db;
border-radius: 0.375rem;
margin-bottom: 1rem;
}

.modal-buttons {
display: flex;
justify-content: flex-end;
gap: 0.5rem;
}

.modal-cancel, .modal-action {
padding: 0.5rem 1rem;
border-radius: 0.375rem;
cursor: pointer;
}

.modal-cancel {
background: #e5e7eb;
color: #1f2937;
}

.modal-cancel:hover {
background: #d1d5db;
}

.modal-action {
background: #3b82f6;
color: white;
}

.modal-action:hover {
background: #2563eb;
}

.modal-textarea {
width: 100%;
padding: 0.5rem;
border: 1px solid #d1d5db;
border-radius: 0.375rem;
resize: vertical;
min-height: 100px;
}

.modal-close {
background: none;
border: none;
font-size: 1rem;
cursor: pointer;
color: #6b7280;
}

.modal-close:hover {
color: #4b5563;
}

.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 1rem;
}

.modal-form {
display: flex;
flex-direction: column;
}

.modal-body {
margin-bottom: 1rem;
}

.form-group {
margin-bottom: 1rem;
}

.form-label {
font-size: 0.875rem;
color: #4b5563;
margin-bottom: 0.5rem;
display: block;
}

.form-input, .form-select, .form-textarea {
width: 100%;
padding: 0.5rem;
border: 1px solid #d1d5db;
border-radius: 0.375rem;
}

.form-textarea {
resize: vertical;
min-height: 100px;
}

.recurring-toggle {
display: flex;
align-items: center;
gap: 0.5rem;
margin-bottom: 1rem;
}

.recurring-label {
font-size: 0.875rem;
color: #4b5563;
}

.toggle-button {
padding: 0.5rem;
border-radius: 0.375rem;
cursor: pointer;
}

.toggle-active {
background: #10b981;
color: white;
}

.toggle-inactive {
background: #e5e7eb;
color: #4b5563;
}

.advanced-toggle {
cursor: pointer;
display: flex;
justify-content: space-between;
align-items: center;
padding: 0.5rem;
background: #f3f4f6;
border-radius: 0.375rem;
margin-bottom: 1rem;
}

.advanced-section {
margin-bottom: 1rem;
}

.days-checkboxes {
display: flex;
flex-wrap: wrap;
gap: 0.5rem;
}

.day-checkbox {
display: flex;
align-items: center;
gap: 0.25rem;
}

.checkbox-input {
width: 1rem;
height: 1rem;
}

.error-message {
color: #ef4444;
font-size: 0.875rem;
margin-top: 0.5rem;
}

.fade-enter-active, .fade-leave-active {
transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
opacity: 0;
}

.modal-footer {
display: flex;
justify-content: flex-end;
}

.submit-button {
background: #3b82f6;
color: white;
padding: 0.5rem 1rem;
border-radius: 0.375rem;
cursor: pointer;
}

.submit-button:hover {
background: #2563eb;
}

.youtube-embed {
margin-bottom: 1rem;
}

.youtube-frame {
width: 100%;
border-radius: 0.375rem;
}

.task-image-container {
position: relative;
margin-bottom: 1rem;
}

.task-image {
width: 100%;
border-radius: 0.375rem;
cursor: pointer;
}

.remove-attachment {
position: absolute;
top: 0.5rem;
right: 0.5rem;
background: rgba(0, 0, 0, 0.7);
color: white;
border-radius: 50%;
width: 1.5rem;
height: 1.5rem;
display: flex;
justify-content: center;
align-items: center;
cursor: pointer;
}

.task-file-container {
display: flex;
align-items: center;
gap: 0.5rem;
margin-bottom: 1rem;
}

.file-link {
display: flex;
align-items: center;
gap: 0.5rem;
}

.file-anchor {
color: #3b82f6;
text-decoration: underline;
}

.task-detail-item {
display: flex;
align-items: center;
gap: 0.5rem;
margin-bottom: 0.5rem;
}

.detail-icon {
width: 1.25rem;
height: 1.25rem;
}

.detail-label {
font-weight: 600;
color: #4b5563;
}

.detail-text {
color: #4b5563;
}

.labels-container {
display: flex;
flex-wrap: wrap;
gap: 0.5rem;
}

.label {
padding: 0.25rem 0.5rem;
border-radius: 0.375rem;
font-size: 0.75rem;
}

.label-active {
background: #3b82f6;
color: white;
}

.label-inactive {
background: #e5e7eb;
color: #4b5563;
}

.image-preview {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.8);
display: flex;
justify-content: center;
align-items: center;
z-index: 60;
}

.preview-image {
max-width: 90%;
max-height: 90%;
border-radius: 0.5rem;
}

.voice-modal {
background: white;
padding: 1.5rem;
border-radius: 0.5rem;
text-align: center;
width: 90%;
max-width: 400px;
}

.voice-cancel {
position: absolute;
top: 0.5rem;
right: 0.5rem;
background: none;
border: none;
font-size: 1rem;
cursor: pointer;
color: #6b7280;
}

.voice-cancel:hover {
color: #4b5563;
}

.voice-waveform {
display: flex;
justify-content: center;
gap: 0.25rem;
margin-bottom: 1rem;
}

.wave-bar {
width: 0.5rem;
height: 2rem;
background: #3b82f6;
animation: wave 0.5s infinite alternate;
}

.wave-bar.delay-100 {
animation-delay: 0.1s;
}

.wave-bar.delay-200 {
animation-delay: 0.2s;
}

.wave-bar.delay-300 {
animation-delay: 0.3s;
}

@keyframes wave {
0% {
transform: scaleY(0.5);
}
100% {
transform: scaleY(1);
}
}

.voice-transcript {
font-size: 1rem;
color: #4b5563;
margin-bottom: 0.5rem;
}

.transcript-text {
font-weight: 600;
}

.voice-hint {
font-size: 0.875rem;
color: #6b7280;
}

.daily-routine {
padding: 1rem;
}

.no-tasks {
text-align: center;
padding: 2rem;
}

.no-tasks-image {
width: 150px;
margin: 0 auto;
}

.no-tasks-title {
font-size: 1.5rem;
font-weight: 600;
margin: 1rem 0;
}

.no-tasks-text {
font-size: 1rem;
color: #6b7280;
}

.tasks-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 1rem;
}

.tasks-title {
font-size: 1.25rem;
font-weight: 600;
}

.completed-label {
color: #4b5563;
}

.completion-count {
color: #10b981;
}

.tasks-actions {
display: flex;
gap: 0.5rem;
}

.clear-button, .tasks-actions button {
background: none;
border: none;
cursor: pointer;
font-size: 1rem;
}

.clear-button:hover, .tasks-actions button:hover {
color: #3b82f6;
}

.toggle-icon {
font-size: 1rem;
}

.tasks-container {
margin-bottom: 1rem;
}

.tasks-list {
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.task-card {
background: white;
border: 1px solid #e5e7eb;
border-radius: 0.5rem;
padding: 1rem;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.task-completed {
background: #d1fae5;
}

.task-important {
border-left: 4px solid #ef4444;
}

.draggable {
cursor: move;
}

.task-content {
display: flex;
align-items: center;
gap: 0.5rem;
}

.drag-icon {
display: flex;
align-items: center;
}

.drag-icon-inner {
cursor: move;
}

.drag-handle {
font-size: 1rem;
color: #6b7280;
}

.task-details {
flex: 1;
}

.task-title-text {
font-size: 1rem;
font-weight: 500;
cursor: pointer;
}

.task-completed-text {
text-decoration: line-through;
color: #6b7280;
}

.title-text {
margin-right: 0.5rem;
}

.file-indicator {
font-size: 0.875rem;
color: #4b5563;
}

.task-reminder {
font-size: 0.75rem;
color: #6b7280;
margin-top: 0.25rem;
}

.task-status {
display: flex;
align-items: center;
gap: 0.5rem;
margin-top: 0.25rem;
}

.status-incomplete, .status-completed {
font-size: 0.75rem;
color: #6b7280;
}

.status-completed {
color: #10b981;
}

.importance-toggle, .completion-toggle {
background: none;
border: none;
cursor: pointer;
}

.importance-toggle .fas, .completion-toggle .fas, .completion-toggle .far {
font-size: 1rem;
}

.task-youtube {
margin-top: 0.5rem;
}

.youtube-thumbnail {
width: 100%;
border-radius: 0.375rem;
cursor: pointer;
}

.task-image {
margin-top: 0.5rem;
}

.image-preview {
width: 100%;
border-radius: 0.375rem;
}

.task-labels {
display: flex;
flex-wrap: wrap;
gap: 0.5rem;
margin-top: 0.5rem;
}

.task-label {
padding: 0.25rem 0.5rem;
border-radius: 0.375rem;
font-size: 0.75rem;
}

.task-footer {
display: flex;
justify-content: space-between;
align-items: center;
margin-top: 0.5rem;
}

.task-actions {
display: flex;
gap: 0.5rem;
}

.action-icon {
background: none;
border: none;
font-size: 1rem;
cursor: pointer;
color: #6b7280;
}

.action-icon:hover {
color: #3b82f6;
}

.delete-icon:hover {
color: #ef4444;
}

.transfer-icon:hover {
color: #10b981;
}

.wont-do-icon:hover {
color: #f59e0b;
}

.timer-icon:hover {
color: #8b5cf6;
}

.youtube-icon:hover {
color: #ff0000;
}

.more-options {
background: none;
border: none;
cursor: pointer;
}

.more-icon {
width: 1.25rem;
height: 1.25rem;
color: #6b7280;
}

.notification-popup, .transfer-notification {
position: fixed;
bottom: 1rem;
left: 1rem;
background: #10b981;
color: white;
padding: 0.5rem 1rem;
border-radius: 0.375rem;
z-index: 50;
}

.task-index {
position: absolute;
top: 0.5rem;
left: 0.5rem;
font-size: 0.75rem;
color: #6b7280;
}

.ghost {
opacity: 0.5;
background: #c8ebfb;
}

.drag {
box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.idle-section {
text-align: center;
padding: 2rem;
}

.idle-image {
width: 150px;
margin: 0 auto;
}

.idle-title {
font-size: 1.5rem;
font-weight: 600;
margin: 1rem 0;
}

.idle-text {
font-size: 1rem;
color: #6b7280;
}

.wont-do-section {
margin-top: 1rem;
}

.wont-do-title {
font-size: 1.25rem;
font-weight: 600;
margin-bottom: 0.5rem;
}

.wont-do-item {
display: flex;
align-items: center;
gap: 0.5rem;
margin-bottom: 0.5rem;
}

.undo-button {
background: none;
border: none;
cursor: pointer;
color: #3b82f6;
}

.undo-button:hover {
color: #2563eb;
}

.wont-do-text {
font-size: 0.875rem;
color: #6b7280;
}

@media (min-width: 640px) {
.divider {
display: inline-block;
}
}
.scroll-container {
  height: 100vh;
  overflow-y: auto;
}
.calendar-task-card {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid #e5e7eb; /* gray-200 */
}

</style>



