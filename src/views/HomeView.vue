<template>
  <div ref="scrollContainer" class="app-root">

    <!-- Loading Screen -->
    <div v-if="isLoading" class="splash-screen">
      <div class="splash-inner">
        <div class="splash-logo">✦</div>
        <h1 class="splash-title">Welcome back</h1>
        <p class="splash-sub">Preparing your workspace...</p>
        <div class="splash-loader">
          <div class="splash-bar"></div>
        </div>
      </div>
    </div>

    <div v-else class="content-wrap">
      <div v-if="suggestShutdown" class="shutdown-banner" role="status">
        <span>🌙 It's evening — wrap up the day?</span>
        <button type="button" class="btn-primary" @click="openShutdown">Start shutdown</button>
        <button type="button" class="link-btn" @click="shutdownDismissed = true">Not now</button>
      </div>
      <div v-if="shutdownOpen" class="modal-backdrop">
        <div class="modal-box" role="dialog" aria-modal="true" aria-label="Shutdown ritual">
          <div class="modal-header">
            <h2 class="modal-title">🌙 Shutdown</h2>
            <button @click="shutdownOpen = false" class="modal-close" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <p class="shutdown-h">Done ({{ shutdownDone.length }})</p>
            <ul class="shutdown-list"><li v-for="t in shutdownDone" :key="taskKey(t)">✓ {{ t.title }}</li>
              <li v-if="!shutdownDone.length" class="muted">Nothing finished yet.</li></ul>
            <p class="shutdown-h">Unfinished ({{ shutdownOpenTasks.length }}) — carry to tomorrow?</p>
            <ul class="shutdown-list"><li v-for="t in shutdownOpenTasks" :key="taskKey(t)">
              <label><input type="checkbox" v-model="shutdownCarry[taskKey(t)]" /> {{ t.title }}</label></li>
              <li v-if="!shutdownOpenTasks.length" class="muted">All clear. 🎉</li></ul>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" :disabled="shutdownBusy" @click="finishShutdown(false)">Finish day</button>
            <button class="btn-primary" :disabled="shutdownBusy" @click="finishShutdown(true)">Carry selected &amp; finish</button>
          </div>
        </div>
      </div>
      <!-- ─── Calendar & Progress ─── -->
      <section class="calendar-section">
        <div class="calendar-header">
          <span class="current-date-label">{{ currentDate }}</span>
          <span class="days-left-badge">⏳ {{ daysLeftInYear }} days left in year</span>
        </div>

        <!-- Day Tabs -->
        <div class="day-tabs">
          <button
              v-for="(day, index) in days"
              :key="index"
              class="day-tab"
              :class="{
              'day-tab--today': isToday(index),
              'day-tab--selected': isSelected(index)
            }"
              @click="handleDayTabClick(index)"
          >
            <span class="day-tab-name">{{ day.day }}</span>
            <span class="day-tab-date">{{ day.date }}</span>
          </button>
        </div>

        <!-- Progress Journey -->
        <div class="progress-section">
          <div class="progress-info">
            <span class="progress-label">Progress</span>
            <span class="progress-pct">{{ calculateCompletionPercentage() }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: calculateCompletionPercentage() + '%' }"></div>
          </div>
          <div class="milestone-row">
            <div
                v-for="(milestone, index) in milestones"
                :key="index"
                class="milestone-dot"
                :class="{
                'milestone-dot--reached': calculateCompletionPercentage() >= milestone.percent
              }"
                :style="{ left: index === 0 ? '0%' : index === milestones.length - 1 ? 'calc(100% - 28px)' : `calc(${milestone.position}% - 14px)` }"
                :title="milestone.icon + ' ' + milestone.percent + '%'"
            >
              <span class="milestone-icon">{{ milestone.icon }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── Header / Streak Bar ─── -->
      <header class="header-card" :class="{
        'header-cold': streak < 3,
        'header-warm': streak >= 3 && streak < 7,
        'header-hot': streak >= 7
      }">
        <div class="header-left">
          <div class="streak-badge">
            <span class="streak-icon-wrap">{{ getStreakIcon(streak) }}</span>
          </div>
          <div class="streak-info">
            <p class="streak-count">🔥 <span>{{ streak }}</span> day streak</p>
            <p v-if="streak === 0" class="streak-sub streak-none">Start your streak today</p>
            <p v-else class="streak-sub">{{ motivationalMessage }}</p>
          </div>
        </div>

        <div class="header-center">
          <div v-if="pointsAccumulated < totalPoints && !isNaN(pointsAccumulated) && !isNaN(totalPoints)" class="points-pill points-needed">
            💰 {{ totalPoints - pointsAccumulated }} pts to idle time
          </div>
          <div v-else class="points-pill points-ready">
            🎉 Idle time unlocked!
          </div>
        </div>

        <div class="header-right">

          <div class="day-controls">
            <button type="button" class="btn-day btn-shutdown" @click="openShutdown">🌙 Shutdown</button>

            <button
                v-if="daySession.started && !daySession.ended"
                @click="endDay"
                class="btn-day btn-end"
            >
              🌙 End Day
            </button>

          </div>

          <div class="session-times">

    <span
        v-if="daySession.startedAtText"
        class="session-time started"
    >
      ▶ {{ daySession.startedAtText }}
    </span>

            <span
                v-if="daySession.endedAtText"
                class="session-time ended"
            >
      ■ {{ daySession.endedAtText }}
    </span>

          </div>

        </div>
      </header>
      <div class="grid grid-cols-5 gap-1 mb-3">
        <div class="bg-slate-900/80 rounded-xl py-2 text-center">
          <p class="text-[10px] text-slate-400">Total</p>
          <p class="text-sm font-bold text-white">{{ timeStats.totalDayTime }}</p>
        </div>

        <div class="bg-slate-900/80 rounded-xl py-2 text-center">
          <p class="text-[10px] text-emerald-400">Prod</p>
          <p class="text-sm font-bold text-white">{{ timeStats.productiveTime }}</p>
        </div>

        <div class="bg-slate-900/80 rounded-xl py-2 text-center">
          <p class="text-[10px] text-yellow-400">Gap</p>
          <p class="text-sm font-bold text-white">{{ timeStats.gapTime }}</p>
        </div>

        <div class="bg-slate-900/80 rounded-xl py-2 text-center">
          <p class="text-[10px] text-blue-400">Done</p>
          <p class="text-sm font-bold text-white">{{ timeStats.completedTasks }}</p>
        </div>

        <div class="bg-slate-900/80 rounded-xl py-2 text-center">
          <p class="text-[10px] text-red-400">Miss</p>
          <p class="text-sm font-bold text-white">{{ timeStats.missedTasks }}</p>
        </div>
      </div>
      <!-- ─── Workout Modal ─── -->
      <div v-if="showWorkoutModal" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h2 class="modal-title">Customize Workout</h2>
            <button @click="closeWorkoutModal" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="field-group">
              <label class="field-label">Goal</label>
              <select v-model="workoutPreferences.goal" class="field-select">
                <option>Build Muscle</option>
                <option>Lose Fat</option>
                <option>General Fitness</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Equipment</label>
              <select v-model="workoutPreferences.equipment" class="field-select">
                <option>None</option>
                <option>Resistance Bands</option>
                <option>Resistance Bands + Equipment</option>
                <option>Full Gym</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Max per day</label>
              <select v-model="workoutPreferences.maxPerDay" class="field-select">
                <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label">Duration (min)</label>
              <input type="number" v-model="workoutPreferences.duration" class="field-input" />
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeWorkoutModal" class="btn-secondary">Cancel</button>
            <button @click="generateWorkoutRoutine" class="btn-primary">Generate 💪</button>
          </div>
        </div>
      </div>

      <!-- ─── All Tasks Complete Animation ─── -->
      <div v-if="showFullScreenAnimation" class="fullscreen-celebration">
        <div class="celebration-inner">
          <div class="celebration-emoji">🎉</div>
          <h1 class="celebration-title">All done!</h1>
          <p class="celebration-streak">🔥 <span>{{ streak }}</span> day streak</p>
          <p class="celebration-sub">Every task complete. Take a breath — you earned it.</p>
          <button @click="closeFullScreenAnimation" class="btn-primary btn-lg">Continue</button>
        </div>
      </div>


      <!-- ─── Timer Modal ─── -->
      <div v-if="showTimerModal" class="modal-backdrop">
        <div class="timer-modal">
          <div class="timer-header">
            <h2>⏱ Set Timer</h2>
            <button @click="showTimerModal = false" class="timer-close">×</button>
          </div>

          <div class="timer-body">
            <div class="timer-picker">
              <div class="timer-field">
                <label>Hours</label>
                <select v-model="selectedTimerHours">
                  <option
                      v-for="hour in 24"
                      :key="hour - 1"
                      :value="hour - 1"
                  >
                    {{ hour - 1 }}
                  </option>
                </select>
              </div>

              <div class="timer-field">
                <label>Minutes</label>
                <select v-model="selectedTimerMinutes">
                  <option
                      v-for="minute in 60"
                      :key="minute - 1"
                      :value="minute - 1"
                  >
                    {{ minute - 1 }}
                  </option>
                </select>
              </div>
            </div>

            <div class="timer-preview">
              {{ selectedTimerHours }}h {{ selectedTimerMinutes }}m
            </div>
          </div>

          <div class="timer-footer">
            <button @click="showTimerModal = false" class="timer-btn timer-cancel">
              Cancel
            </button>

            <button @click="startTimer" class="timer-btn timer-start">
              Start
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Won't Do Modal ─── -->
      <div v-if="wontDoModalOpen" class="modal-backdrop">
        <div class="modal-box modal-box--sm">
          <div class="modal-header">
            <h2 class="modal-title">🚫 Won't do this?</h2>
          </div>
          <div class="modal-body">
            <div class="field-group">
              <label class="field-label">Reason</label>
              <textarea v-model="wontDoReason" class="field-textarea" placeholder="Why are you skipping this?"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="wontDoModalOpen = false" class="btn-secondary">Cancel</button>
            <button @click="markTaskAsWontDo" class="btn-primary">Confirm</button>
          </div>
        </div>
      </div>

      <!-- ─── Transfer Modal ─── -->
      <div v-if="transferModalOpen" class="modal-backdrop">
        <div class="modal-box modal-box--sm">
          <div class="modal-header">
            <h2 class="modal-title">🔄 Transfer task</h2>
          </div>
          <div class="modal-body">
            <div class="field-group">
              <label class="field-label">Move to</label>
              <select v-model="selectedTransferDay" class="field-select">
                <option v-for="(day, index) in days" :key="index" :value="index" :disabled="index === selectedDayIndex">
                  {{ day.day }} — {{ day.date }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeTransferModal" class="btn-secondary">Cancel</button>
            <button @click="transferTask()" class="btn-primary">Transfer</button>
          </div>
        </div>
      </div>

      <!-- ─── Add Task Modal ─── -->
      <div v-if="modalOpen" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h2 class="modal-title">✦ New task</h2>
            <button @click="closeModal" class="modal-close">✕</button>
          </div>
          <form @submit.prevent="addNewTask">
            <div class="modal-body">
              <div class="field-group">
                <label class="field-label">Task name</label>
                <input type="text" v-model="newTask.title" class="field-input" placeholder="What needs doing?" required />
              </div>

              <div class="field-group">
                <label class="field-label">Reminder</label>
                <input type="datetime-local" v-model="newTask.reminder.datetime" class="field-input" />
              </div>
              <div class="field-group">
                <label class="field-label" for="nt-repeat">Repeat</label>
                <select id="nt-repeat" v-model="repeatMode" class="field-select">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (on selected days)</option>
                  <option value="once">Just once</option>
                </select>
              </div>
              <div class="field-grid">
                <div class="field-group">
                  <label class="field-label" for="nt-priority">Priority</label>
                  <select id="nt-priority" v-model="newTask.priority" class="field-select">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div class="field-group">
                  <label class="field-label" for="nt-due">Due date</label>
                  <input id="nt-due" type="date" v-model="newTask.dueDate" class="field-input" />
                </div>
                <div class="field-group">
                  <label class="field-label" for="nt-start">Start time</label>
                  <input id="nt-start" type="time" v-model="newTask.startTime" class="field-input" />
                </div>
                <div class="field-group">
                  <label class="field-label" for="nt-est">Estimate (min)</label>
                  <input id="nt-est" type="number" min="0" step="5" v-model="newTask.estimateMin" class="field-input" placeholder="30" />
                </div>
              </div>
              <div class="field-group">
                <label class="field-label" for="nt-next">Next action</label>
                <input id="nt-next" type="text" v-model="newTask.nextAction" class="field-input" placeholder="The very next physical step" />
              </div>

              <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
                <span>Advanced options</span>
                <i :class="showAdvanced ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
              </div>

              <transition name="fade">
                <div v-if="showAdvanced" class="advanced-body">
                  <div class="field-group">
                    <label class="field-label">Days</label>
                    <div class="day-checkboxes">
                      <label v-for="(day, index) in days" :key="index" class="day-check-label">
                        <input type="checkbox" :value="day" v-model="newTask.selectedDays" class="day-check-input" />
                        <span>{{ day.day }}</span>
                      </label>
                    </div>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Position</label>
                    <select v-model="newTask.position" class="field-select">
                      <option :value="0">First</option>
                      <option v-for="(task, index) in selectedDayRoutine" :key="index" :value="index + 1">
                        {{ index + 2 }}{{ getOrdinalSuffix(index + 2) }}
                      </option>
                    </select>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Category / labels</label>
                    <input type="text" v-model="newTask.labels" class="field-input" placeholder="Work, Fitness, Health..." />
                  </div>
                  <div class="field-group">
                    <label class="field-label">Note</label>
                    <textarea v-model="newTask.notes" class="field-textarea" placeholder="Extra details..."></textarea>
                  </div>
                </div>
              </transition>

              <div v-if="error" class="error-msg">{{ error }}</div>
              <div v-if="capWarning" class="cap-warning" role="alert">
                <strong>You already have {{ ACTIVE_CAP }} active tasks today.</strong>
                A shorter list gets finished more often. Move something, or add this one anyway.
                <button type="button" class="btn-secondary cap-override" @click="addAnyway">Add anyway</button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
              <button type="submit" class="btn-primary">Add task ✦</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ─── YouTube Modal ─── -->
      <div v-if="youtubeModalOpen" class="modal-backdrop">
        <div class="modal-box modal-box--sm">
          <div class="modal-header">
            <h2 class="modal-title">🎥 Attach video</h2>
            <button @click="closeYouTubeModal" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="field-group">
              <label class="field-label">YouTube URL</label>
              <input type="url" v-model="youtubeInput" class="field-input" placeholder="https://youtube.com/watch?v=..." />
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeYouTubeModal" class="btn-secondary">Cancel</button>
            <button @click="saveYouTubeLink" class="btn-primary">Attach</button>
          </div>
        </div>
      </div>

      <!-- ─── Task Detail Modal ─── -->
      <div v-if="taskDetailModalOpen" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h2 class="modal-title">Task details</h2>
            <button @click="closeTaskDetailModal" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <h3 class="detail-title">{{ taskDetail.title }}</h3>

            <div v-if="taskDetail.youtubeURL" class="detail-media">
              <iframe
                  :src="`https://www.youtube.com/embed/${extractYouTubeID(taskDetail.youtubeURL)}`"
                  class="detail-video"
                  height="220"
                  frameborder="0"
                  allowfullscreen
              ></iframe>
            </div>

            <div v-if="taskDetail.imageURL" class="detail-media detail-image-wrap">
              <img :src="taskDetail.imageURL" class="detail-image" @click="showImagePreview = true" />
              <button @click="removeTaskAttachment('imageURL')" class="detail-remove">✕</button>
            </div>

            <div v-if="taskDetail.fileURL" class="detail-file">
              📄 <a :href="taskDetail.fileURL" target="_blank" class="detail-file-link">{{ taskDetail.fileName || 'Download file' }}</a>
              <button @click="removeTaskAttachment('fileURL')" class="detail-remove">✕</button>
            </div>

            <div v-if="taskDetail.reminder?.date && taskDetail.reminder?.time" class="detail-row">
              <span class="detail-row-icon">📅</span>
              <span>{{ formatShortDate(taskDetail.reminder.date) }} at {{ formatTime(taskDetail.reminder.time) }}</span>
            </div>

            <div v-if="taskDetail.notes" class="detail-row detail-row--block">
              <span class="detail-row-icon">📝</span>
              <div>
                <p class="detail-row-label">Notes</p>
                <p class="detail-row-content">{{ taskDetail.notes }}</p>
              </div>
            </div>

            <div v-if="taskDetail.labels?.length" class="detail-labels">
              <span
                  v-for="(label, index) in taskDetail.labels"
                  :key="index"
                  @click="toggleLabelHighlight(label)"
                  class="label-pill"
                  :class="{ 'label-pill--active': activeLabels.includes(label) }"
              >
                {{ label }}
              </span>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeTaskDetailModal" class="btn-primary">Close</button>
          </div>
        </div>
      </div>

      <!-- ─── Fullscreen Image Preview ─── -->
      <div v-if="showImagePreview" class="image-preview-overlay" @click="showImagePreview = false">
        <img :src="taskDetail.imageURL" class="image-preview-img" />
      </div>

      <!-- ─── Reminder Modal ─── -->
      <div v-if="isModalOpen" class="modal-backdrop">
        <div class="modal-box modal-box--sm">
          <div class="modal-header">
            <h2 class="modal-title">📅 Add reminder</h2>
          </div>
          <div class="modal-body">
            <p class="reminder-task-name">{{ selectedTaskTitle }}</p>
            <form @submit.prevent="handleAddReminder">
              <div class="field-group">
                <label class="field-label">Date</label>
                <input type="date" v-model="reminder.date" class="field-input" required />
              </div>
              <div class="field-group">
                <label class="field-label">Time</label>
                <input type="time" v-model="reminder.time" class="field-input" required />
              </div>
              <div class="field-group">
                <label class="field-label">Repeat</label>
                <select v-model="reminder.repeat" class="field-select">
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div class="modal-footer" style="padding: 0; border: none; margin-top: 1rem;">
                <button @click="closeModal" type="button" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">Save reminder</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- ─── Voice Input Modal ─── -->
      <div v-if="listening" class="modal-backdrop">
        <div class="modal-box modal-box--sm voice-modal">
          <button @click="cancelVoiceInput" class="modal-close voice-cancel">✕</button>
          <div class="voice-waves">
            <span class="wave wave-1"></span>
            <span class="wave wave-2"></span>
            <span class="wave wave-3"></span>
            <span class="wave wave-4"></span>
            <span class="wave wave-5"></span>
          </div>
          <p class="voice-label">Listening...</p>
          <p class="voice-transcript">"<span>{{ liveTranscript }}</span>"</p>
          <p class="voice-hint">Speak your task clearly</p>
        </div>
      </div>

      <!-- ─── Task List ─── -->
      <section v-if="canViewSelectedDayTasks"
               class="task-section">
        <div v-if="selectedDayRoutine?.length === 0" class="empty-state">
          <div class="empty-icon">✦</div>
          <h2 class="empty-title">Nothing here yet</h2>
          <p class="empty-sub">Tap the + button below to add your first task.</p>
        </div>

        <div v-else class="task-list-wrap">
          <div v-if="selectedDayIndex === new Date().getDay()" class="task-list-header">
            <div class="task-count">
              <span class="task-count-label">Today</span>
              <span class="task-count-badge">{{ completedTaskCount }}/{{ selectedDayRoutine?.length }}</span>
            </div>
            <button @click="toggleSound" class="toggle-visibility" :aria-pressed="soundEnabled" :aria-label="soundEnabled ? 'Mute sounds' : 'Enable sounds'" :title="soundEnabled ? 'Sounds on' : 'Sounds off'">
              <i :class="soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute'"></i>
            </button>
            <button @click="showCompleted = !showCompleted" class="toggle-visibility" :title="showCompleted ? 'Hide completed' : 'Show completed'">
              <i :class="showCompleted ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
            </button>
          </div>

          <div v-if="isViewingToday" class="load-summary" :class="'load-summary--' + todayLoad.level">
            <span>⏱ <strong>{{ formatMinutes(todayLoad.minutes) }}</strong> planned · {{ todayLoad.count }} open</span>
            <span class="load-hint">{{ todayLoad.hint }}<template v-if="todayLoad.unestimated"> · {{ todayLoad.unestimated }} without estimate</template></span>
            <button type="button" class="link-btn" @click="showSchedule = !showSchedule" :aria-expanded="showSchedule">🗓 Schedule</button>
          </div>
          <div v-if="showSchedule" class="schedule-panel">
            <p v-if="!schedule.blocks.length" class="schedule-empty">No tasks have a start time yet. Tap a task to set one.</p>
            <ul v-else class="schedule-list">
              <li v-for="b in schedule.blocks" :key="b.task.createdAt + b.task.title" :class="{ 'schedule-conflict': b.conflict, 'schedule-done': b.task.completed }">
                <span class="schedule-time">{{ formatClock(b.start) }}<template v-if="b.end !== null"> – {{ formatClock(b.end) }}</template></span>
                <span>{{ b.task.title }}</span>
                <span v-if="b.conflict" class="schedule-flag">overlaps next</span>
              </li>
            </ul>
            <p v-if="schedule.unscheduled.length" class="schedule-unsched">Unscheduled: {{ schedule.unscheduled.filter(t => !t.completed).length }}</p>
          </div>

          <draggable
              handle=".drag-handle"
              :animation="150"
              v-model="selectedDayRoutine"
              tag="div"
              class="tasks-list space-y-2"
              ghost-class="ghost"
              drag-class="drag"
              @start="playSound('dragStart')"
              @end="playSound('dragEnd'); handleDragEnd()"
          >
            <template #item="{ element: task, index }">
              <div
                  v-if="(!task.completed || (isToday(selectedDayIndex) && showCompleted))"
                  class="task-card"
                  :class="{
                  'task-card--completed': task.completed && isToday(selectedDayIndex),
                  'task-card--important': task.important
                }"
              >
                <!-- Left: drag + avatar -->
                <div class="task-left">
                  <div class="task-avatar drag-handle" :style="{ background: generateRandomColor() }">
                    <i class="fas fa-grip-vertical"></i>
                  </div>
                  <div class="task-index">{{ index + 1 }}</div>
                </div>

                <!-- Center: main content -->
                <div class="task-body" @click="onCardTap(task, $event)">
                  <div class="task-title-row">
                    <!-- Completion toggle -->
                    <button
                        v-if="isToday(selectedDayIndex)"
                        @click="toggleTaskCompletion(index)"
                        class="task-check"
                        :class="{ 'task-check--done': task.completed }"
                    >
                      <i :class="task.completed ? 'fas fa-check-circle' : 'far fa-circle'"></i>
                    </button>

                    <span
                        class="task-title"
                        :class="{ 'task-title--done': task.completed && isToday(selectedDayIndex) }"
                        @click="openTaskDetailModal(task)"
                    >
                      {{ task.title.length > 28 ? task.title.slice(0, 28) + '…' : task.title }}
                    </span>
                    <span v-if="task.timerActive" class="task-timer-left">
                      ⏳  {{ getTaskTimeLeft(task) }}
                    </span>
                    <span v-if="task.youtubeURL" class="task-attachment" title="Video">🎥</span>
                    <span v-if="task.imageURL" class="task-attachment" title="Image">🖼️</span>
                    <span v-if="task.fileURL" class="task-attachment" title="File">📄</span>
                  </div>

                  <div v-if="task.reminder?.date && task.reminder?.time" class="task-reminder">
                    📅 {{ formatShortDate(task.reminder.date) }}· ⏰ {{ formatTime(task.reminder.time) }}
                  </div>

                  <div class="task-meta-row">

                    <span v-if="task.completed && isToday(selectedDayIndex)" class="task-status task-status--done">Complete</span>
                    <button @click="toggleTaskImportance(index)" class="importance-btn" :title="task.important ? 'Important' : 'Mark important'">
                      <i :class="task.important ? 'fas fa-fire task-fire--on' : 'fas fa-fire task-fire--off'"></i>
                    </button>
                  </div>

                  <!-- Planning chips -->
                  <div v-if="estimateOf(task) || task.startTime || task.dueDate || (task.priority && task.priority !== 'low') || (task.status && task.status !== 'todo')" class="task-chips">
                    <span v-if="task.priority && task.priority !== 'low'" class="chip" :class="'chip--' + task.priority">{{ task.priority }}</span>
                    <span v-if="task.status && task.status !== 'todo'" class="chip">{{ task.status }}</span>
                    <span v-if="task.dueDate" class="chip">Due {{ task.dueDate }}</span>
                    <span v-if="estimateOf(task)" class="chip">⏱ {{ formatMinutes(estimateOf(task)) }}</span>
                    <span v-if="task.startTime" class="chip">🕒 {{ formatClock(toMinutes(task.startTime)) }}<template v-if="estimateOf(task)"> – {{ formatClock(toMinutes(task.startTime) + estimateOf(task)) }}</template></span>
                  </div>
                  <div v-if="subtaskProgress(task).total" class="task-chips">
                    <span class="chip chip--subtasks" :class="{ 'chip--subtasks-done': subtaskProgress(task).done === subtaskProgress(task).total }" title="Subtasks done">☑ {{ subtaskProgress(task).done }}/{{ subtaskProgress(task).total }}</span>
                  </div>
                  <div v-if="task.nextAction" class="task-next">→ {{ task.nextAction }}</div>
                  <div v-if="task.notes && expandedKey !== taskKey(task)" class="task-note-preview">📝 {{ task.notes.length > 60 ? task.notes.slice(0, 60) + '…' : task.notes }}</div>

                  <div v-if="expandedKey === taskKey(task)" class="task-expand">
                    <div class="field-grid">
                      <label class="mini-field"><span>Status</span>
                        <select class="field-select" :value="task.status || 'todo'" @change="patchTask(index, task, { status: $event.target.value })">
                          <option v-for="st in STATUSES" :key="st.value" :value="st.value">{{ st.label }}</option>
                        </select></label>
                      <label class="mini-field"><span>Priority</span>
                        <select class="field-select" :value="task.priority || 'low'" @change="patchTask(index, task, { priority: $event.target.value })">
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select></label>
                      <label class="mini-field"><span>Due date</span>
                        <input type="date" class="field-input" :value="task.dueDate || ''" @change="patchTask(index, task, { dueDate: $event.target.value })" /></label>
                      <label class="mini-field"><span>Start time</span>
                        <input type="time" class="field-input" :value="task.startTime || ''" @change="patchTask(index, task, { startTime: $event.target.value })" /></label>
                      <label class="mini-field"><span>Estimate (min)</span>
                        <input type="number" min="0" step="5" class="field-input" :value="task.estimateMin || ''" @change="patchTask(index, task, { estimateMin: Number($event.target.value) || 0 })" /></label>
                      <label class="mini-field"><span>Next action</span>
                        <input type="text" class="field-input" :value="task.nextAction || ''" @change="patchTask(index, task, { nextAction: $event.target.value.trim() })" /></label>
                    </div>
                    <label class="mini-field"><span>Note</span>
                      <textarea class="field-textarea" rows="2" :value="task.notes || ''" placeholder="Quick note…" @change="patchTask(index, task, { notes: $event.target.value })"></textarea></label>
                    <SubtaskList :task="task" @change="onSubtaskPatch(index, task, { subtasks: $event })" @toggle-auto="onSubtaskPatch(index, task, { autoCompleteParent: $event })" />
                  </div>

                  <!-- Labels -->
                  <div v-if="task.labels?.length" class="task-labels">
                    <span
                        v-for="(label, i) in task.labels"
                        :key="i"
                        @click="toggleLabelHighlight(label)"
                        class="label-pill label-pill--sm"
                        :class="{ 'label-pill--active': activeLabels.includes(label) }"
                    >
                      {{ label }}
                    </span>
                  </div>
                </div>

                <!-- Right: coin + actions -->
                <div class="task-right">
                  <div class="coin-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" class="coin-svg" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
                      <circle cx="12" cy="12" r="8" fill="#D97706"/>
                      <text x="12" y="16" font-size="10" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">$</text>
                    </svg>
                    <span class="coin-value">10</span>
                  </div>

                  <div class="task-actions">
                    <button @click="openModal('calendar', index, task.title)" class="action-btn" title="Reminder">📅</button>
                    <button @click="openTransferModal(index)" class="action-btn" title="Transfer">🔄</button>
                    <button @click="openYouTubeModal(index)" class="action-btn" title="Video">🎥</button>
                    <button @click="triggerImageUpload(index)" class="action-btn" title="Attach file">📎</button>
                    <input type="file" :ref="'fileInput_' + index" accept="image/*,.pdf,.doc,.docx,.txt" @change="handleUpload($event, index)" class="hidden-input" />
<!--                    <button @click="showTimerModal = true" class="action-btn" title="Timer">⏱️</button>-->
                    <button @click="openTaskTimerModal(index)" class="action-btn" title="Start Task">▶️</button>
                    <button @click="openWontDoModal(index)" class="action-btn action-btn--warn" title="Won't do">🚫</button>
                    <button @click="deleteTask(index)" class="action-btn action-btn--danger" title="Delete">🗑️</button>
                  </div>
                </div>

                <!-- Notification toast -->
                <div v-if="showNotification" class="task-toast">Saved ✓</div>
                <div v-if="transferNotification" class="task-toast task-toast--info">{{ transferNotification }}</div>
              </div>
            </template>
          </draggable>

          <!-- All done idle state -->
          <div
              v-if="selectedDayRoutine?.length > 0 && selectedDayRoutine?.every(task => task.completed) && !showCompleted"
              class="idle-state"
          >
            <img src="@/assets/free.svg" alt="Idle time" class="idle-img" />
            <h2 class="idle-title">Idle time 🧘</h2>
            <p class="idle-sub">All done. Rest well.</p>
          </div>

          <!-- Won't do list -->
          <div v-if="wontDoTasks.length > 0 && !selectedDayRoutine?.every(task => task.completed)" class="wont-do-list">
            <p class="wont-do-label">🚫 Skipped tasks</p>
            <div v-for="(task, index) in wontDoTasks" :key="index" class="wont-do-item">
              <button @click="undoWontDo(index)" class="wont-do-undo" title="Restore">↩</button>
              <span class="wont-do-title">{{ task.title }}</span>
              <span v-if="task.wontDoReason" class="wont-do-reason">— {{ task.wontDoReason }}</span>
            </div>
          </div>
        </div>
      </section>
      <section
          v-else-if="isToday(selectedDayIndex)"
          class="task-section day-not-started"
      >
        <div class="empty-state">
          <div class="empty-icon">🌅</div>

          <h2 class="empty-title">
            Start Your Day
          </h2>

          <p class="empty-sub">
            Your tasks will appear after you press
            <strong>Start Day</strong>.
          </p>

          <button
              @click="startDay"
              class="btn-primary"
          >
            🌅 Start Day
          </button>
        </div>
      </section>
      <!-- ─── FAB Buttons ─── -->
      <div class="fab-group">
        <router-link
            :to="userId ? '#' : '/login'"
            @click.native.prevent="userId && openModal('task')"
            class="fab fab-add"
            title="Add task"
        >
          <svg class="fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
          </svg>
        </router-link>

        <button @click="startVoiceInput" class="fab fab-voice" :class="{ 'fab-voice--listening': listening }" title="Voice input">
          <span v-if="listening" class="fab-pulse"></span>
          <svg xmlns="http://www.w3.org/2000/svg" class="fab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, reactive } from 'vue';
import { useSounds } from '@/composables/useSounds';
import { patchStoredTask, loadDayTasks, carryTasksToDay } from '@/composables/useDayPersistence';
import { ACTIVE_CAP, STATUSES, taskKey, activeCount, estimateOf, formatClock, formatDuration as formatMinutes, loadSummary, buildSchedule, toMinutes } from '@/utils/taskPlanning';
import { getTodayId, formatSessionTime, getCurrentDate, formatShortDate, formatTime, getOrdinalSuffix, getTodayDate, extractYouTubeID, isToday } from '@/utils/dateTime';
import { getStreakIcon, badges } from '@/utils/gamification';
import { scheduleNotification, sendNotificationToPlayer } from '@/composables/useNotifications';
import { speak } from '@/composables/useSpeech';
import { completionPercentage, computeTimeStats, daysLeftInYearFrom, taskTimeLeft } from '@/utils/dayStats';
import { subtaskProgress, shouldAutoComplete, resetSubtasks } from '@/utils/subtasks';
import SubtaskList from '@/components/home/SubtaskList.vue';
import { auth } from '@/firebaseConfig'; // Assuming you have Firebase authentication configured
import { onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import data from '@/data.json';
import draggable from "vuedraggable";
import {db} from '@/firebaseConfig'; // Assuming you have imported the Firebase setup file and exported the db instance
import { doc, setDoc, serverTimestamp, getDoc, updateDoc,getFirestore} from 'firebase/firestore';
const modalOpen = ref(false);
import axios from 'axios';
import { deleteObject } from "firebase/storage";

import { getCurrentInstance } from 'vue';

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
const selectedTimerHours = ref(0);
const selectedTimerMinutes = ref(5);

const selectedTimerTaskIndex = ref(null);
const nowTick = ref(Date.now());

let timerInterval = null;

const openTaskTimerModal = (index) => {
  selectedTimerTaskIndex.value = index;

  selectedTimerHours.value = 0;
  selectedTimerMinutes.value = 5;

  showTimerModal.value = true;
};

const saveSelectedDayTasks = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;

  const selectedDayDocRef = doc(
      db,
      "weeklyRoutines",
      `${userId.value}_${days[selectedDayIndex.value].day}`
  );

  await updateDoc(selectedDayDocRef, {
    tasks: selectedDayRoutine.value,
    updatedAt: serverTimestamp(),
  });
};


const startCountdownWatcher = () => {
  if (timerInterval) return;

  timerInterval = setInterval(async () => {
    nowTick.value = Date.now();

    for (let i = selectedDayRoutine?.value?.length - 1; i >= 0; i--) {
      const task = selectedDayRoutine.value[i];

      if (
          task.timerActive &&
          task.timerEndTime &&
          new Date(task.timerEndTime).getTime() <= Date.now()
      ) {
        await autoTransferTaskToTomorrow(i);
      }
    }
  }, 1000);
};
onMounted(() => {
  startCountdownWatcher();
});
const autoTransferTaskToTomorrow = async (index) => {
  const task = {
    ...selectedDayRoutine.value[index],
    timerActive: false,
    timerStartedAt: null,
    timerEndTime: null,

    // Increase urgency
    urgency: (selectedDayRoutine.value[index].urgency || 0) + 1,

    // Optional visual flag
    overdue: true,
  };

  // Remove from today's list
  selectedDayRoutine.value.splice(index, 1);
  await saveSelectedDayTasks();

  // Tomorrow's day index
  const tomorrowIndex = (selectedDayIndex.value + 1) % 7;
  const tomorrowDay = days[tomorrowIndex].day;

  const tomorrowDocRef = doc(
      db,
      "weeklyRoutines",
      `${userId.value}_${tomorrowDay}`
  );

  const snap = await getDoc(tomorrowDocRef);

  let tomorrowTasks = [];

  if (snap.exists()) {
    tomorrowTasks = snap.data().tasks || [];
  }

  // Put overdue task at the top
  tomorrowTasks.unshift(task);

  await setDoc(
      tomorrowDocRef,
      {
        tasks: tomorrowTasks,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
  );

  transferNotification.value = `⏰ "${task.title}" moved to tomorrow (+1 urgency)`;

  setTimeout(() => {
    transferNotification.value = null;
  }, 3000);
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

const daySession = ref({
  started: false,
  ended: false,
  startTime: null,
  endTime: null,
  startedAtText: "",
  endedAtText: "",
});



const loadDaySession = async () => {
  if (!userId.value) return;

  const today = getTodayId();
  const userSettingsRef = doc(db, "userSettings", userId.value);

  const snap = await getDoc(userSettingsRef);

  if (!snap.exists()) return;

  const session = snap.data()?.daySessions?.[today];

  if (!session) return;

  const startDate = session.startTime?.toDate ? session.startTime.toDate() : null;
  const endDate = session.endTime?.toDate ? session.endTime.toDate() : null;

  daySession.value = {
    started: session.started || false,
    ended: session.ended || false,
    startTime: session.startTime || null,
    endTime: session.endTime || null,
    startedAtText: startDate ? formatSessionTime(startDate) : "",
    endedAtText: endDate ? formatSessionTime(endDate) : "",
  };
};

const startDay = async () => {
  if (!userId.value) {
    alert("Please log in first.");
    return;
  }

  const today = getTodayId();
  const now = new Date();
  const userSettingsRef = doc(db, "userSettings", userId.value);

  await setDoc(userSettingsRef, {
    daySessions: {
      [today]: {
        started: true,
        ended: false,
        startTime: serverTimestamp(),
        endTime: null,
        updatedAt: serverTimestamp(),
      }
    }
  }, { merge: true });

  daySession.value = {
    started: true,
    ended: false,
    startTime: now,
    endTime: null,
    startedAtText: formatSessionTime(now),
    endedAtText: "",
  };

  alert("Day started!");
};

const endDay = async () => {
  if (!userId.value) {
    alert("Please log in first.");
    return;
  }

  if (!daySession.value.started) {
    alert("Start your day first.");
    return;
  }

  const today = getTodayId();
  const now = new Date();
  const userSettingsRef = doc(db, "userSettings", userId.value);

  await setDoc(userSettingsRef, {
    daySessions: {
      [today]: {
        started: true,
        ended: true,
        endTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    }
  }, { merge: true });

  daySession.value.ended = true;
  daySession.value.endTime = now;
  daySession.value.endedAtText = formatSessionTime(now);

  alert("Day ended!");
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

    const resetTasks = existingTasks.map(task => resetSubtasks({
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
  dueDate: '', startTime: '', estimateMin: '', nextAction: '',
  reminder: { date: '', time: '', repeat: '' }  // Now defined
});


const error = ref('');
const editingTask = ref(null);
const editedTask = ref({title: '', time: '', priority: 'low', labels: [], notes: ''});
const searchQuery = ref('');

const generateRandomColor = () => {
  return 'grey' ;
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
        tasks = tasks.map(task => resetSubtasks({
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
  if (selectedTimerTaskIndex.value === null) return;

  const totalMinutes =
      (Number(selectedTimerHours.value) * 60) +
      Number(selectedTimerMinutes.value);

  if (totalMinutes <= 0) {
    alert("Please select a duration.");
    return;
  }

  const now = Date.now();
  const durationMs = totalMinutes * 60 * 1000;
  const endTime = now + durationMs;

  const task = {
    ...selectedDayRoutine.value[selectedTimerTaskIndex.value],
    timerActive: true,
    timerStartedAt: new Date(now).toISOString(),
    timerEndTime: new Date(endTime).toISOString(),
    timerDurationMinutes: totalMinutes,
  };

  selectedDayRoutine.value[selectedTimerTaskIndex.value] = task;

  await saveSelectedDayTasks();

  showTimerModal.value = false;
  selectedTimerTaskIndex.value = null;

  startCountdownWatcher();
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

// Function to get motivational messages for milestones
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
// Computed property to get the index of the top-most incomplete task
const topIncompleteTaskIndex = computed(() => {
  return selectedDayRoutine.value.findIndex((task) => !task.completed);
});

const { soundEnabled, playSound, toggleSound, markUserCompletion, watchMilestones } = useSounds();

const toggleTaskCompletion = async (index) => {
  const task = { ...selectedDayRoutine.value[index] }; // Create a copy of the task to avoid direct mutation
  task.completed = !task.completed; // Toggle the completed state
  startSpinning(index);
  if (task.completed) {
    markUserCompletion();
    playSound("complete");
    const completedNow = new Date().toISOString();

    task.completedAt = completedNow;
    task.timerActive = false;
    task.timerStoppedAt = completedNow;

    userCredits.value += 10;
    announceNextTask(index);

    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "completed");
    }
  } else {
    task.completedAt = null;
    task.timerStoppedAt = null;
    task.timerActive = false;
    userCredits.value -= 10;
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

    // 🗑 Remove one-time tasks & reset recurring tasks
    selectedDayRoutine.value = selectedDayRoutine.value.filter(task => {
      if (task.type === "one-time") {
        return false; // Remove from array (will also be removed from Firestore)
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
onAuthStateChanged(auth, async(user) => {
  if (user) {
    userId.value = user.uid; // Set user ID when the user logs in
    console.log('User ID:', userId.value);
    await loadDaySession();
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

  if (isCapBlocked()) return;

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
    createdAt: new Date().toISOString(),
    status: 'todo',
    dueDate: newTask.value.dueDate || '',
    startTime: newTask.value.startTime || '',
    estimateMin: Number(newTask.value.estimateMin) || 0,
    nextAction: (newTask.value.nextAction || '').trim()
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
      type: 'recurring',
      dueDate: '', startTime: '', estimateMin: '', nextAction: ''
    };
    capWarning.value = false; capOverride.value = false;
    closeModal();
    error.value = '';

    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "created");
    }
  } catch (error) {
    console.error('Error adding task:', error);
  }
};


const speakDailyReport = async () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const docRef = doc(db, 'dailyReports', `${userId.value}_${yesterdayStr}`);
  const snapshot = await getDoc(docRef);

  let yesterdayCompleted = 0;
  let yesterdayTotal = 0;
  let streakGained = false;

  if (snapshot.exists()) {
    const data = snapshot.data();
    yesterdayCompleted = data.completedTasks;
    yesterdayTotal = data.totalTasks;
    streakGained = data.streakGained;
  }

  const todayTotal = selectedDayRoutine.value.length;

  const message = `Yesterday, you completed ${yesterdayCompleted} of ${yesterdayTotal} tasks.
    Today you have ${todayTotal} task${todayTotal === 1 ? '' : 's'}.
    ${streakGained ? '🔥 Great job on earning a streak!' : '🌱 No streak gained, but today is a new chance!'}`;

  speak(message);
};




const showDailyReportPopup = ref(false);
const lastSpokenDate = ref(localStorage.getItem("lastSpokenDate") || null);
onMounted(() => {
  const todayStr = new Date().toISOString().split("T")[0];

  if (lastSpokenDate.value !== todayStr) {
    showDailyReportPopup.value = true; // show popup
  }
});
watch(selectedDayIndex, () => {
  const todayStr = new Date().toISOString().split("T")[0];

  if (lastSpokenDate.value !== todayStr && isToday(selectedDayIndex.value)) {
    showDailyReportPopup.value = true;
  }
});

const userCredits = ref(0);
const playDailyReport = () => {
  speakDailyReport(); // Call your existing function
  const todayStr = new Date().toISOString().split("T")[0];
  localStorage.setItem("lastSpokenDate", todayStr);
  lastSpokenDate.value = todayStr;
  showDailyReportPopup.value = false;
};
const dismissReportPopup = () => {
  const todayStr = new Date().toISOString().split("T")[0];
  localStorage.setItem("lastSpokenDate", todayStr);
  lastSpokenDate.value = todayStr;
  showDailyReportPopup.value = false;
};

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
const timeStats = computed(() => computeTimeStats(daySession.value, selectedDayRoutine.value, wontDoTasks.value.length));
const calculateCompletionPercentage = () => completionPercentage(selectedDayRoutine.value, wontDoTasks.value.length, selectedDayIndex.value);
const daysLeftInYear = computed(() => daysLeftInYearFrom());
const getTaskTimeLeft = (task) => taskTimeLeft(task, nowTick.value);
const showNotification = ref(false);


// Function to get the icon for the current streak day


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
const milestones = ref([
  { label: '0%', percent: 0, position: 0, icon: '🌱' },      // Seed planted
  { label: '25%', percent: 25, position: 25, icon: '🌿' },   // Sprouting leaves
  { label: '50%', percent: 50, position: 50, icon: '🌳' },   // Small tree
  { label: '75%', percent: 75, position: 75, icon: '🌲' },   // Mature tree
  { label: '100%', percent: 100, position: 100, icon: '🏔️' } // Fully grown tree at the peak
]);

const spinningTasks = ref([]);




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
};

const saveYouTubeLink = async () => {
  const index = selectedYouTubeTaskIndex.value;
  const task = selectedDayRoutine.value[index];
  task.youtubeURL = youtubeInput.value;

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
const showWorkoutModal = ref(false);
const workoutPreferences = reactive({
  goal: 'General Fitness',
  duration: 20,
  equipment: 'None',
  fitnessLevel: 'Beginner',
  focusArea: 'Full Body',
  intensity: 'Moderate',
  daysPerWeek: 6,
  maxPerDay: 3, // default
  style: '',
  targetAudience: '',
  timeOfDay: ''
});


const openWorkoutModal = () => {
  showWorkoutModal.value = true;
};const closeWorkoutModal = () => {
  showWorkoutModal.value = false;
};

const generateWorkoutRoutine = async () => {
  closeWorkoutModal();
  isLoading.value = true;

  let equipmentDetails = '';
  if (workoutPreferences.equipment === 'None') {
    equipmentDetails = 'No equipment at all';
  } else if (workoutPreferences.equipment === 'Resistance Bands') {
    equipmentDetails = 'Only resistance bands';
  } else if (workoutPreferences.equipment === 'Resistance Bands + Equipment') {
    equipmentDetails = 'Resistance bands with dumbbells or kettlebells';
  } else {
    equipmentDetails = 'Full gym equipment';
  }
  const OPENAI_API_KEY = process.env.VUE_APP_OPENAI_API_KEY;

  const prompt = `Create a ${workoutPreferences.daysPerWeek}-day workout routine for someone who wants to train with: ${equipmentDetails}.
Goal: ${workoutPreferences.goal}, Duration: ${workoutPreferences.duration} minutes, Fitness Level: ${workoutPreferences.fitnessLevel}, Focus: ${workoutPreferences.focusArea}, Intensity: ${workoutPreferences.intensity}, Style: ${workoutPreferences.style || 'any'}.
Limit to a maximum of ${workoutPreferences.maxPerDay} workouts per day.
Return in JSON format like:
{
  "Mon": [{ "title": "...", "youtubeURL": "...", "type": "recurring", "completed": false }],
  ...
}`;

  try {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [{role: "user", content: prompt}],
      temperature: 0.7
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);
    applyGeneratedRoutine(result);
  } catch (err) {
    console.error("AI Error:", err);
    alert("Failed to generate workout routine.");
  } finally {
    isLoading.value = false;
  }
};


const applyGeneratedRoutine = async (generatedWeek) => {
  try {
    for (const [day, tasks] of Object.entries(generatedWeek)) {
      const docRef = doc(db, "weeklyRoutines", `${userId.value}_${day}`);
      await setDoc(docRef, {
        tasks: tasks.map(task => ({
          ...task,
          createdAt: new Date().toISOString(),
          userId: userId.value,
          labels: ["Workout"],
          important: false,
          notes: "",
        })),
        updatedAt: serverTimestamp(),
      });
    }

    alert("✅ Your AI workout routine is ready!");
    if (selectedDayIndex.value !== -1) fetchSelectedDayRoutine();
  } catch (err) {
    console.error("Error applying AI routine:", err);
  }
};

const canViewSelectedDayTasks = computed(() => {
  const todayIndex = new Date().getDay();

  // Other days should always be viewable
  if (selectedDayIndex.value !== todayIndex) {
    return true;
  }

  // Today requires Start Day
  return daySession.value.started && !daySession.value.ended;
});

// ─── Task planning (logic lives in @/utils/taskPlanning and @/composables) ───
watchMilestones(() => calculateCompletionPercentage(), milestones, selectedDayIndex);

const todayDayName = () => days[new Date().getDay()].day;
const isViewingToday = computed(() => selectedDayIndex.value === new Date().getDay());

// Repeat: Daily / Weekly / Once, built on the existing Recurring type + Days selection
const repeatMode = computed({
  get: () => newTask.value.type === 'one-time' ? 'once'
      : (newTask.value.selectedDays.length === days.length ? 'daily' : 'weekly'),
  set: (v) => {
    if (v === 'once') { newTask.value.type = 'one-time'; newTask.value.selectedDays = []; }
    else if (v === 'daily') { newTask.value.type = 'recurring'; newTask.value.selectedDays = [...days]; }
    else { newTask.value.type = 'recurring'; newTask.value.selectedDays = []; }
  }
});

// Daily cap of 3 active tasks (override available)
const capWarning = ref(false);
const capOverride = ref(false);
const addsToToday = () => {
  const todayName = todayDayName();
  const sel = newTask.value.selectedDays;
  return sel.length > 0 ? sel.some((d) => d.day === todayName) : isViewingToday.value;
};
const isCapBlocked = () => {
  if (capOverride.value || !addsToToday()) return false;
  if (activeCount(selectedDayRoutine.value) >= ACTIVE_CAP) { capWarning.value = true; return true; }
  return false;
};
const addAnyway = () => { capOverride.value = true; capWarning.value = false; addNewTask(); };
watch(modalOpen, (open) => { if (!open) { capWarning.value = false; capOverride.value = false; } });

// Load summary + schedule
const todayLoad = computed(() => loadSummary(selectedDayRoutine.value));
const schedule = computed(() => buildSchedule(selectedDayRoutine.value));
const showSchedule = ref(false);

// Inline expand (tap card) + inline field editing, saved with the task
const expandedKey = ref(null);
const onCardTap = (task, event) => {
  if (event.target.closest('button, input, textarea, select, .task-title, .label-pill, .task-expand')) return;
  expandedKey.value = expandedKey.value === taskKey(task) ? null : taskKey(task);
};
const patchTask = async (index, task, patch) => {
  try {
    Object.assign(task, patch);
    if (patch.estimateMin !== undefined) task.estimateMin = Number(patch.estimateMin) || 0;
    await patchStoredTask(userId.value, days[selectedDayIndex.value].day, task, index, patch);
  } catch (e) {
    console.error('Error saving task field:', e);
  }
};

// Subtasks: saved through the same patch path; optionally complete the parent when all are done
const onSubtaskPatch = async (index, task, patch) => {
  await patchTask(index, task, patch);
  if (shouldAutoComplete(task)) await toggleTaskCompletion(index);
};

// Shutdown ritual
const clockTick = ref(Date.now());
let clockTimer = setInterval(() => { clockTick.value = Date.now(); }, 60000);
onBeforeUnmount(() => clearInterval(clockTimer));
const suggestShutdown = computed(() =>
  new Date(clockTick.value).getHours() >= 18 && !daySession.value.ended && !shutdownDismissed.value);
const shutdownDismissed = ref(false);
const shutdownOpen = ref(false);
const shutdownDone = ref([]);
const shutdownOpenTasks = ref([]);
const shutdownCarry = ref({});
const shutdownBusy = ref(false);
const openShutdown = async () => {
  shutdownOpen.value = true;
  try {
    const tasks = userId.value ? await loadDayTasks(userId.value, todayDayName()) : [];
    shutdownDone.value = tasks.filter((t) => t.completed);
    shutdownOpenTasks.value = tasks.filter((t) => !t.completed);
    shutdownCarry.value = Object.fromEntries(shutdownOpenTasks.value.map((t) => [taskKey(t), true]));
  } catch (e) { console.error('Shutdown load failed:', e); }
};
const finishShutdown = async (carry) => {
  shutdownBusy.value = true;
  try {
    if (carry) {
      const picked = shutdownOpenTasks.value.filter((t) => shutdownCarry.value[taskKey(t)]);
      if (picked.length) {
        const tomorrow = days[(new Date().getDay() + 1) % days.length].day;
        await carryTasksToDay(userId.value, todayDayName(), tomorrow, picked, getTodayId());
      }
    }
    try { await saveDailyPerformance(); } catch (e) { console.error(e); }
    shutdownOpen.value = false;
    shutdownDismissed.value = true;
    if (daySession.value.started && !daySession.value.ended) await endDay(); // existing End Day logic
    await fetchSelectedDayRoutine();
  } catch (e) {
    console.error('Shutdown failed:', e);
  } finally {
    shutdownBusy.value = false;
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
  padding: 1rem;
  margin: 0; /* remove vertical gaps */
  border-bottom: 1px solid #ccc;
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

@keyframes pulseWave {
  0%, 100% {
    height: 0.5rem;
  }
  50% {
    height: 2rem;
  }
}

.animate-pulse {
  animation: pulseWave 1s ease-in-out infinite;
}

.delay-100 {
  animation-delay: 0.1s;
}

.delay-200 {
  animation-delay: 0.2s;
}

.delay-300 {
  animation-delay: 0.3s;
}

@keyframes conveyorScrollDown {
  0% {
    transform: translateY(-50%);
  }
  100% {
    transform: translateY(0%);
  }
}

.animate-conveyor {
  animation: conveyorScrollDown 30s linear infinite;
  will-change: transform;
}

.animate-conveyor:hover {
  animation: none !important; /* Fully stops the animation */
  transform: translateY(0%) !important; /* Resets to natural position (top) */
}

@keyframes pulseSlow {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.85;
  }
}

.animate-pulse-slow {
  animation: pulseSlow 2s infinite;
}

@keyframes spinSlow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  display: inline-block;
  animation: spinSlow 2s linear infinite;
}
/* ── Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Root ── */
.app-root {
  min-height: 100vh;
  background: #0f0f11;
  color: #e8e6e1;
  font-family: 'Instrument Sans', sans-serif;
  padding-bottom: 120px;
}

.content-wrap {
  max-width: 680px;
  margin: 0 auto;
  padding: 1rem 1rem 2rem;
}

/* ── Splash ── */
.splash-screen {
  position: fixed;
  inset: 0;
  background: #0f0f11;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.splash-inner { text-align: center; }
.splash-logo {
  font-size: 3rem;
  color: #F59E0B;
  margin-bottom: 1rem;
  animation: pulse 1.5s ease infinite;
}
.splash-title { font-size: 1.6rem; font-weight: 600; color: #e8e6e1; margin: 0; }
.splash-sub { color: #6b6a66; font-size: 0.9rem; margin: 0.5rem 0 1.5rem; }
.splash-loader { width: 180px; height: 2px; background: #2a2a2e; border-radius: 2px; margin: 0 auto; overflow: hidden; }
.splash-bar { height: 100%; background: #F59E0B; animation: load 2s ease infinite; }
@keyframes load { 0% { width: 0%; margin-left: 0; } 50% { width: 80%; } 100% { width: 0%; margin-left: 100%; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ── Header ── */
.header-card {
  background: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 16px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.header-cold { border-left: 3px solid #6366f1; }
.header-warm { border-left: 3px solid #F59E0B; }
.header-hot  { border-left: 3px solid #ef4444; }

.header-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 140px; }
.streak-badge {
  width: 40px; height: 40px;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem;
}
.streak-info {}
.streak-count { font-size: 0.9rem; font-weight: 600; margin: 0; }
.streak-count span { color: #F59E0B; }
.streak-sub { font-size: 0.75rem; color: #6b6a66; margin: 0; }
.streak-none { color: #ef4444 !important; }

.header-center { flex: 1; min-width: 140px; }
.points-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
}
.points-needed { background: #1e1e22; color: #F59E0B; border: 1px solid #3a3a1a; }
.points-ready  { background: #0d2217; color: #4ade80; border: 1px solid #14432a; }

.header-right { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end; }
.day-controls { display: flex; gap: 0.5rem; }
.btn-day {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-day:disabled { opacity: 0.35; cursor: default; }
.btn-start { background: #14432a; color: #4ade80; }
.btn-end   { background: #3b0d0d; color: #f87171; }
.session-times { display: flex; gap: 0.75rem; }
.session-time { font-size: 0.72rem; color: #6b6a66; font-family: 'JetBrains Mono', monospace; }

/* ── Calendar ── */
.calendar-section {
  background: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 16px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.current-date-label { font-weight: 600; font-size: 0.95rem; }
.days-left-badge {
  font-size: 0.72rem;
  font-weight: 500;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  border-radius: 8px;
  padding: 3px 8px;
  color: #ef4444;
}
.day-tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 1.25rem; }
.day-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid #2a2a2e;
  background: #1a1a1e;
  cursor: pointer;
  transition: all 0.15s;
  color: #9a9891;
  font-family: inherit;
}
.day-tab:hover { border-color: #3a3a3e; color: #e8e6e1; }
.day-tab--selected { background: #1e2a3a; border-color: #378ADD; color: #7fb8f5; }
.day-tab--today { background: #378ADD; border-color: #378ADD; color: #fff; font-weight: 600; }
.day-tab-name { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.day-tab-date { font-size: 0.8rem; font-weight: 500; margin-top: 2px; }

/* ── Progress ── */
.progress-section { padding-top: 0.75rem; }
.progress-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
.progress-label { font-size: 0.75rem; color: #6b6a66; }
.progress-pct { font-size: 0.75rem; font-weight: 600; color: #378ADD; font-family: 'JetBrains Mono', monospace; }
.progress-track {
  width: 100%; height: 4px;
  background: #2a2a2e;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}
.progress-fill { height: 100%; background: #378ADD; border-radius: 4px; transition: width 0.6s ease; }
.milestone-row { position: relative; height: 36px; }
.milestone-dot {
  position: absolute;
  top: 0;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #2a2a2e;
  border: 2px solid #3a3a3e;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.4s;
  font-size: 0.9rem;
}
.milestone-dot--reached {
  background: #1e2a3a;
  border-color: #378ADD;
  transform: scale(1.15);
}

/* ── Modals ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
  backdrop-filter: blur(4px);
}
.modal-box {
  background: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.modal-box--sm { max-width: 360px; }
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #2a2a2e;
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
.modal-close {
  background: none; border: none; color: #6b6a66; font-size: 1rem;
  cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: color 0.15s;
}
.modal-close:hover { color: #e8e6e1; }
.modal-body { padding: 1.25rem; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #2a2a2e;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* ── Form fields ── */
.field-group { margin-bottom: 1rem; }
.field-group--row { display: flex; align-items: center; justify-content: space-between; }
.field-label { display: block; font-size: 0.78rem; font-weight: 500; color: #9a9891; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.field-input, .field-select, .field-textarea {
  width: 100%;
  background: #0f0f11;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  padding: 10px 12px;
  color: #e8e6e1;
  font-family: inherit;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.field-input:focus, .field-select:focus, .field-textarea:focus {
  outline: none;
  border-color: #378ADD;
}
.field-textarea { min-height: 80px; resize: vertical; }
.field-select { cursor: pointer; }

/* ── Buttons ── */
.btn-primary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: #378ADD;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2a6db0; }
.btn-primary.btn-lg { padding: 12px 28px; font-size: 1rem; border-radius: 12px; }
.btn-secondary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  background: #1e1e22;
  color: #9a9891;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  padding: 9px 18px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { color: #e8e6e1; border-color: #3a3a3e; }

.toggle-btn {
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  border-radius: 8px;
  padding: 6px 12px;
  color: #6b6a66;
  cursor: pointer;
  transition: all 0.2s;
}
.toggle-btn--on { background: #1e2a3a; border-color: #378ADD; color: #7fb8f5; }

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #378ADD;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.5rem 0;
}
.advanced-body { padding-top: 0.5rem; }

.day-checkboxes { display: flex; flex-wrap: wrap; gap: 8px; }
.day-check-label { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer; }
.day-check-input { accent-color: #378ADD; }

/* ── Advanced / fade transition ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Task Detail ── */
.detail-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; }
.detail-media { margin: 0.75rem 0; position: relative; }
.detail-video { width: 100%; border-radius: 10px; }
.detail-image-wrap { display: inline-block; }
.detail-image { max-height: 200px; width: 100%; object-fit: contain; border-radius: 10px; cursor: zoom-in; }
.detail-remove {
  position: absolute; top: 8px; right: 8px;
  background: #ef4444; color: white; border: none;
  border-radius: 50%; width: 22px; height: 22px;
  font-size: 0.7rem; cursor: pointer;
}
.detail-file {
  display: flex; align-items: center; gap: 8px;
  background: #1e1e22; border-radius: 8px; padding: 8px 12px;
  font-size: 0.875rem; position: relative;
}
.detail-file-link { color: #7fb8f5; text-decoration: none; }
.detail-row {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 0.875rem; padding: 8px 0;
  border-top: 1px solid #2a2a2e;
}
.detail-row-icon { font-size: 1rem; flex-shrink: 0; }
.detail-row-label { font-weight: 600; font-size: 0.78rem; color: #6b6a66; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.detail-row-content { color: #9a9891; }
.detail-labels { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; border-top: 1px solid #2a2a2e; }

.reminder-task-name { font-weight: 600; color: #7fb8f5; margin-bottom: 1rem; }
.error-msg { color: #f87171; font-size: 0.85rem; padding: 0.5rem 0; }

/* ── Labels ── */
.label-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 500;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  color: #9a9891;
  cursor: pointer;
  transition: all 0.15s;
}
.label-pill:hover { border-color: #378ADD; color: #7fb8f5; }
.label-pill--active { background: #1e2a3a; border-color: #378ADD; color: #7fb8f5; }
.label-pill--sm { font-size: 0.68rem; padding: 2px 8px; }

/* ── Fullscreen celebration ── */
.fullscreen-celebration {
  position: fixed; inset: 0;
  background: #0f0f11;
  display: flex; align-items: center; justify-content: center;
  z-index: 300;
}
.celebration-inner { text-align: center; }
.celebration-emoji { font-size: 4rem; animation: pop 0.5s ease; }
.celebration-title { font-size: 2.5rem; font-weight: 600; margin: 0.5rem 0; }
.celebration-streak { font-size: 1.2rem; color: #F59E0B; margin-bottom: 0.5rem; }
.celebration-streak span { font-weight: 700; }
.celebration-sub { color: #6b6a66; margin-bottom: 2rem; }
@keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

/* ── Image Preview ── */
.image-preview-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.9);
  z-index: 400;
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out;
}
.image-preview-img { max-width: 90%; max-height: 90vh; border-radius: 12px; }

/* ── Voice ── */
.voice-modal { text-align: center; padding: 2rem 1.5rem; position: relative; }
.voice-cancel { position: absolute; top: 12px; right: 12px; }
.voice-waves { display: flex; gap: 4px; justify-content: center; margin-bottom: 1.5rem; align-items: flex-end; }
.wave {
  width: 4px; border-radius: 4px;
  background: #4ade80;
  animation: waveUp 0.8s ease infinite alternate;
}
.wave-1 { height: 16px; animation-delay: 0.0s; }
.wave-2 { height: 24px; animation-delay: 0.1s; }
.wave-3 { height: 32px; animation-delay: 0.2s; }
.wave-4 { height: 20px; animation-delay: 0.3s; }
.wave-5 { height: 12px; animation-delay: 0.4s; }
@keyframes waveUp { from { transform: scaleY(0.5); } to { transform: scaleY(1); } }
.voice-label { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
.voice-transcript { color: #7fb8f5; font-size: 0.9rem; margin-bottom: 0.5rem; }
.voice-hint { font-size: 0.75rem; color: #6b6a66; }

/* ── Task List ── */
.task-section { }
.empty-state { text-align: center; padding: 4rem 1rem; }
.empty-icon { font-size: 3rem; color: #2a2a2e; margin-bottom: 1rem; }
.empty-title { font-size: 1.1rem; font-weight: 600; color: #6b6a66; margin: 0; }
.empty-sub { color: #4a4a4e; font-size: 0.875rem; margin-top: 0.5rem; }

.task-list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0 0.75rem;
}
.task-count { display: flex; align-items: center; gap: 8px; }
.task-count-label { font-weight: 600; font-size: 0.875rem; color: #6b6a66; }
.task-count-badge {
  font-size: 0.75rem; font-weight: 600; font-family: 'JetBrains Mono', monospace;
  background: #1e2a3a; color: #7fb8f5;
  padding: 2px 8px; border-radius: 20px;
}
.toggle-visibility {
  background: none; border: none; color: #6b6a66;
  cursor: pointer; font-size: 0.875rem; padding: 4px 8px;
  transition: color 0.15s;
}
.toggle-visibility:hover { color: #e8e6e1; }

.tasks-list { display: flex; flex-direction: column; gap: 8px; }
.task-ghost { opacity: 0.3; background: #2a2a2e !important; }
.task-dragging { transform: rotate(1.5deg); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }

/* ── Task Card ── */
.task-card {
  background: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 14px;
  padding: 0.875rem 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  position: relative;
  transition: border-color 0.2s, background 0.2s;
}
.task-card:hover { border-color: #3a3a3e; }
.task-card--completed { background: #111113; opacity: 0.65; }
.task-card--important { border-left: 3px solid #ef4444; }

.task-left { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.task-avatar {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: grab;
  color: rgba(255,255,255,0.7);
  font-size: 0.8rem;
  flex-shrink: 0;
}
.task-avatar:active { cursor: grabbing; }
.task-index { font-size: 0.65rem; color: #4a4a4e; font-family: 'JetBrains Mono', monospace; }

.task-body { flex: 1; min-width: 0; }
.task-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.task-check {
  background: none; border: none; cursor: pointer; padding: 0;
  color: #4a4a4e; font-size: 1.1rem;
  transition: color 0.15s;
  flex-shrink: 0;
}
.task-check:hover { color: #4ade80; }
.task-check--done { color: #4ade80; }
.task-title {
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  color: #e8e6e1;
  transition: color 0.15s;
}
.task-title:hover { color: #7fb8f5; }
.task-title--done { text-decoration: line-through; color: #4a4a4e !important; }
.task-attachment { font-size: 0.75rem; }

.task-reminder { font-size: 0.72rem; color: #6b6a66; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

.task-meta-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.task-status {
  font-size: 0.68rem; font-weight: 500;
  padding: 2px 8px; border-radius: 20px;
  letter-spacing: 0.04em;
}
.task-status--pending { background: #2a2a12; color: #ca8a04; border: 1px solid #3a3a1a; }
.task-status--done    { background: #0d2217; color: #4ade80; border: 1px solid #14432a; }

.importance-btn {
  background: none; border: none; cursor: pointer;
  font-size: 0.875rem; padding: 0;
  transition: transform 0.15s;
}
.importance-btn:hover { transform: scale(1.2); }
.task-fire--on  { color: #ef4444; }
.task-fire--off { color: #3a3a3e; }
.task-labels { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }

.task-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
.coin-badge { display: flex; align-items: center; gap: 4px; }
.coin-svg { width: 18px; height: 18px; }
.coin-value { font-size: 0.75rem; font-weight: 600; color: #F59E0B; font-family: 'JetBrains Mono', monospace; }
.task-actions { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; max-width: 120px; }
.action-btn {
  background: #1e1e22; border: 1px solid #2a2a2e;
  border-radius: 7px; padding: 4px 6px;
  font-size: 0.8rem; cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}
.action-btn:hover { border-color: #3a3a3e; background: #2a2a2e; }
.action-btn--warn:hover  { border-color: #92400e; background: #1c1008; }
.action-btn--danger:hover { border-color: #7f1d1d; background: #1c0808; }
.hidden-input { display: none; }

.task-toast {
  position: absolute; top: 10px; right: 10px;
  background: #14432a; color: #4ade80;
  font-size: 0.72rem; font-weight: 600;
  padding: 4px 10px; border-radius: 8px;
  border: 1px solid #1a6040;
}
.task-toast--info { background: #1e2a3a; color: #7fb8f5; border-color: #2a3a5a; }

/* ── Idle State ── */
.idle-state { text-align: center; padding: 3rem 1rem; }
.idle-img { width: 160px; height: 160px; opacity: 0.5; }
.idle-title { font-size: 1.25rem; font-weight: 600; color: #6b6a66; margin: 0; }
.idle-sub { color: #4a4a4e; font-size: 0.875rem; margin-top: 0.5rem; }

/* ── Won't Do ── */
.wont-do-list {
  margin-top: 1rem;
  background: #18181b;
  border: 1px solid #3b0d0d;
  border-radius: 12px;
  padding: 0.875rem 1rem;
}
.wont-do-label { font-size: 0.75rem; font-weight: 600; color: #f87171; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
.wont-do-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid #2a2a2e; font-size: 0.875rem; }
.wont-do-undo {
  background: #0d2217; color: #4ade80;
  border: 1px solid #14432a; border-radius: 6px;
  padding: 2px 8px; font-size: 0.8rem; cursor: pointer;
}
.wont-do-title { font-weight: 500; }
.wont-do-reason { color: #6b6a66; font-size: 0.8rem; }

/* ── FAB ── */
.fab-group {
  position: fixed;
  bottom: 28px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  z-index: 100;
}
.fab {
  width: 56px; height: 56px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  border: none;
  text-decoration: none;
  position: relative;
}
.fab:hover { transform: scale(1.08); }
.fab:active { transform: scale(0.95); }
.fab-add { background: #378ADD; color: white; box-shadow: 0 4px 20px rgba(55, 138, 221, 0.4); }
.fab-voice { background: #18181b; border: 2px solid #2a2a2e; color: #6b6a66; }
.fab-voice--listening { border-color: #4ade80; color: #4ade80; }
.fab-icon { width: 22px; height: 22px; z-index: 1; position: relative; }
.fab-pulse {
  position: absolute; inset: -2px;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.25);
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes ping { 75%, 100% { transform: scale(1.5); opacity: 0; } }
.task-timer-left {
  margin-top: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #f59e0b;
}
.time-summary-card {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 16px;
  margin: 16px 0;
  border-radius: 20px;
  background: #111827;
  color: white;
}

.time-summary-card div {
  background: rgba(255,255,255,0.08);
  padding: 12px;
  border-radius: 14px;
  text-align: center;
}

.time-summary-card span {
  display: block;
  font-size: 12px;
  color: #9ca3af;
}

.time-summary-card strong {
  font-size: 18px;
}
.timer-picker {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.picker-column {
  flex: 1;
}

.picker-select {
  width: 100%;
  height: 180px;
  overflow-y: auto;
  font-size: 20px;
  text-align: center;
  border-radius: 12px;
  padding: 10px;
}

.timer-modal {
  width: min(92vw, 340px);
  background: #16171d;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.5);
}

.timer-header {
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timer-header h2 {
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  margin: 0;
}

.timer-close {
  background: #24262d;
  color: #aaa;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 20px;
}

.timer-body {
  padding: 18px 20px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.timer-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.timer-field label {
  display: block;
  margin-bottom: 8px;
  color: #9ca3af;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.timer-field select {
  width: 100%;
  height: 54px;
  padding: 0 14px;
  background: #22242b;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  font-size: 18px;
  font-weight: 800;
  outline: none;
}

.timer-preview {
  margin-top: 16px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
}

.timer-footer {
  padding: 14px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.timer-btn {
  border: none;
  border-radius: 14px;
  padding: 11px 18px;
  font-weight: 800;
}

.timer-cancel {
  background: #23242b;
  color: #b8bbc3;
}

.timer-start {
  background: #2f8cff;
  color: white;
}

/* ── Planning / polish additions ── */
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid #7fb8f5; outline-offset: 2px;
}
.btn-shutdown { background: #1e2a3a; color: #9cc7f7; }
.btn-shutdown:hover, .btn-day:hover { opacity: 0.85; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.mini-field { display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem; color: #a3a29d; margin-bottom: 0.5rem; }
.task-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.chip { font-size: 0.7rem; padding: 2px 8px; border-radius: 20px; background: #232328; color: #c9c8c3; }
.chip--high { background: #3b0d0d; color: #fca5a5; }
.chip--medium { background: #3a2d0a; color: #fcd34d; }
.task-next { margin-top: 6px; font-size: 0.8rem; color: #9cc7f7; }
.task-note-preview { margin-top: 4px; font-size: 0.78rem; color: #a3a29d; line-height: 1.4; }
.chip--subtasks { background: #12263a; color: #9cc7f7; }
.chip--subtasks-done { background: #0f2a1c; color: #86efac; }
.task-expand { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a2a2e; cursor: default; }
.task-body { cursor: pointer; min-width: 0; }
.load-summary {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem;
  font-size: 0.8rem; color: #c9c8c3; background: #18181b; border: 1px solid #2a2a2e;
  border-radius: 12px; padding: 0.5rem 0.875rem; margin-bottom: 0.75rem;
}
.load-hint { color: #86efac; }
.load-summary--full .load-hint { color: #fcd34d; }
.load-summary--over { border-color: #7f1d1d; }
.load-summary--over .load-hint { color: #fca5a5; }
.link-btn { background: none; border: none; color: #9cc7f7; cursor: pointer; font: inherit; text-decoration: underline; margin-left: auto; }
.schedule-panel { background: #18181b; border: 1px solid #2a2a2e; border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: #c9c8c3; }
.schedule-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.schedule-list li { display: flex; gap: 0.75rem; align-items: baseline; }
.schedule-time { font-family: 'JetBrains Mono', monospace; color: #7fb8f5; min-width: 9.5rem; }
.schedule-conflict .schedule-flag { color: #fca5a5; font-size: 0.7rem; }
.schedule-done { opacity: 0.5; text-decoration: line-through; }
.schedule-empty, .schedule-unsched { margin: 0; color: #a3a29d; }
.schedule-unsched { margin-top: 6px; }
.cap-warning { background: #3a2d0a; border: 1px solid #92400e; color: #fde68a; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem; line-height: 1.5; margin-top: 0.75rem; }
.cap-override { display: block; margin-top: 0.5rem; }
.shutdown-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; background: #1e2a3a; border: 1px solid #2c4666; color: #cfe3fb; border-radius: 12px; padding: 0.625rem 1rem; margin-bottom: 1rem; font-size: 0.85rem; }
.shutdown-h { font-weight: 600; font-size: 0.85rem; margin: 0.5rem 0 0.25rem; }
.shutdown-list { list-style: none; margin: 0 0 0.5rem; padding: 0; font-size: 0.85rem; line-height: 1.6; }
.muted { color: #a3a29d; }
@media (max-width: 480px) {
  .field-grid { grid-template-columns: 1fr; }
  .schedule-time { min-width: 0; }
}
</style>



