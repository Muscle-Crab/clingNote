<template>
  <div ref="scrollContainer" class="app-root" :class="[{ 'is-dragging': isDraggingTask }, appTheme ? 'theme-' + appTheme : '']">

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

      <!-- ─── Calendar & Progress ─── -->
      <section class="calendar-section">
        <div class="hero-scene" aria-hidden="true"></div>
        <header class="hero">
          <div class="hero-text">
            <p class="hero-date">{{ currentDate }}</p>
            <h1 class="hero-title">{{ heroTitleParts.lead }}<span class="hero-accent">{{ heroTitleParts.accent }}</span></h1>
            <p class="hero-sub">{{ daysLeftInYear }} days left this year</p>
          </div>
          <div ref="heroMenuEl" class="hero-menu">
            <button type="button" class="hero-menu-btn" :aria-label="noticeCount ? noticeCount + ' updates and day menu' : 'Day menu'" :aria-expanded="menuOpen ? 'true' : 'false'" @click="menuOpen = !menuOpen">
              <i class="fas fa-bell" aria-hidden="true"></i>
              <span v-if="noticeCount" class="hero-badge" :class="{ 'hero-badge--alert': disciplineWarning === '30m' || bossLines.some((l) => l.kind === 'evening' || l.kind === 'watching') }">{{ noticeCount }}</span>
            </button>
            <div v-if="menuOpen" class="hero-menu-pop" role="dialog" aria-label="Updates and day menu">
              <div v-if="noticeCount || isViewingToday" class="hero-notices">
                <div v-if="disciplineWarning && !(strictOn && !bossHidden && (bossLines.length || verdictScreen))" class="disc-warning home-notice" :class="'disc-warning--' + disciplineWarning" role="alert">
        ⚠️ {{ disciplineWarning === '30m' ? '30 minutes' : '2 hours' }} until your {{ disciplineSettings.deadline }} deadline — {{ streakProgress }}/{{ DAILY_STREAK_MIN }} done
      </div>
                <BossPanel v-if="strictOn && !bossHidden && (bossLines.length || verdictScreen)" class="home-notice" :lines="bossLines" :verdict="verdictScreen"
                 @dismiss="bossHidden = true" @dismiss-line="idleNudge = null" @ack-verdict="dismissVerdict" />
                <MorningReport v-if="morningRecap && isViewingToday" class="home-notice" :recap="morningRecap" @close="morningRecap = null" />
                <LoadSummary v-if="isViewingToday" :load="todayLoad" :expanded="showSchedule" @toggle="showSchedule = !showSchedule" />
              </div>
              <div class="hero-menu-items" @click="menuOpen = false">
              <button type="button" class="hero-menu-item" @click="openShutdown">🌙 Shutdown day</button>
              <button v-if="daySession.started && !daySession.ended" type="button" class="hero-menu-item" @click="endDay">■ End day<span v-if="daySession.startedAtText" class="hero-menu-meta"> · started {{ daySession.startedAtText }}</span></button>
              <router-link to="/upcoming" class="hero-menu-item">📅 Upcoming</router-link>
              <router-link to="/rankings" class="hero-menu-item">🏆 Rankings</router-link>
              <router-link to="/discipline" class="hero-menu-item">⚔️ Discipline Mode</router-link>
              <button type="button" class="hero-menu-item" @click="showSchedule = !showSchedule">🗓 {{ showSchedule ? 'Hide' : 'Show' }} schedule</button>
              </div>
            </div>
          </div>
        </header>

        <DayTabs :days="tabDays" :selected-index="selectedDayIndex" :scheduled-counts="scheduledCounts" @select="handleDayTabClick" />

        <ProgressBar :percentage="calculateCompletionPercentage()" :milestones="milestones" :done="completedTaskCount || 0" :total="dayTasks.length"
                     :streak="streak" :streak-status="streakStatus" :streak-progress="streakProgress" :streak-min="DAILY_STREAK_MIN" :points="pointsAccumulated || 0" />

      </section>
      <ShutdownPrompt class="home-notice" :suggest="false" :open="shutdownOpen" :done="shutdownDone" :open-tasks="shutdownOpenTasks"
                      v-model:carry="shutdownCarry" :busy="shutdownBusy"
                      @start="openShutdown" @dismiss="shutdownDismissed = true" @close="shutdownOpen = false" @finish="finishShutdown" />


      <DramaOverlay v-if="lossScreen" variant="lost" title="Streak lost" button="I'll do better"
                    :subtitle="`You missed your deadline. ${lossScreen.lostStreak ? lossScreen.lostStreak + '-day streak gone. ' : ''}${lossScreen.penalty} pts.`" @close="dismissLoss" />

      <DramaOverlay v-if="bossVictory" variant="victory" title="Boss defeated" button="Claim victory"
                    :subtitle="`${bossVictory.title} is down. +${BOSS_BONUS} pts — your day can count now.`" @close="bossVictory = null" />

      <DramaOverlay v-if="levelUp" variant="levelup" :title="`Level ${levelUp.level}`" button="Let's go"
                    :subtitle="`${levelUp.xp} XP · ${levelUp.toNext} XP to level ${levelUp.level + 1}`" @close="levelUp = null" />
      <DramaOverlay v-if="rewardScreen && !levelUp" variant="reward" :title="`${rewardScreen.days}-day streak!`" button="Nice"
                    :subtitle="`Reward unlocked: ${rewardScreen.label}`" @close="rewardScreen = null" />



      <WorkoutModal v-if="showWorkoutModal" :preferences="workoutPreferences" @close="closeWorkoutModal" @generate="generateWorkoutRoutine" />

      <CelebrationOverlay v-if="showFullScreenAnimation" :streak="streak" @close="closeFullScreenAnimation" />


      <TimerModal v-if="showTimerModal" v-model:hours="selectedTimerHours" v-model:minutes="selectedTimerMinutes" @close="showTimerModal = false" @start="startTimer" />


      <WontDoModal v-if="wontDoModalOpen" v-model:reason="wontDoReason" :strict="strictOn" @cancel="wontDoModalOpen = false" @confirm="markTaskAsWontDo" />


      <TransferModal v-if="transferModalOpen" v-model:day="selectedTransferDay" v-model:reason="deferReason" :strict="strictOn" :carry-count="selectedDayRoutine?.[selectedTransferTaskIndex]?.carryCount || 0" :days="tabDays" :selected-day-index="selectedDayIndex" @close="closeTransferModal" @transfer="transferTask()" />


      <AddTaskModal v-if="modalOpen" :new-task="newTask" v-model:repeat-mode="repeatMode" v-model:show-advanced="showAdvanced"
                    :days="days" :selected-day-routine="selectedDayRoutine" :error="error" :cap-warning="capWarning" :limit-hit="limitHit"
                    @close="closeModal" @submit="addNewTask" @add-anyway="addAnyway" @upgrade="goUpgradeForLimit" />


      <YouTubeModal v-if="youtubeModalOpen" v-model:url="youtubeInput" @close="closeYouTubeModal" @save="saveYouTubeLink" />


      <TaskDetailModal v-if="taskDetailModalOpen" :task="taskDetail" :active-labels="activeLabels"
                       @close="closeTaskDetailModal" @preview="showImagePreview = true"
                       @remove-attachment="removeTaskAttachment" @toggle-label="toggleLabelHighlight" />


      <ImagePreview v-if="showImagePreview" :src="taskDetail.imageURL" @close="showImagePreview = false" />


      <ReminderModal v-if="isModalOpen" :reminder="reminder" :task-title="selectedTaskTitle" @close="closeModal" @submit="handleAddReminder" />


      <VoiceModal v-if="voiceOpen" :transcript="liveTranscript" :supported="voiceSupported" :capability="voiceCap" :error="voiceError" :added="voiceAdded" @undo="undoVoiceTask" @cancel="cancelVoiceInput" />
      <div v-if="!voiceOpen && voiceAdded.some((e) => e.undoUntil > nowTick)" class="voice-toasts" role="status">
        <div v-for="e in voiceAdded.filter((x) => x.undoUntil > nowTick)" :key="e.id" class="voice-toast">🎙 Added “{{ e.title }}” <button type="button" @click="undoVoiceTask(e)">Undo</button></div>
      </div>


      <!-- ─── Task List ─── -->
      <section v-if="canViewSelectedDayTasks"
               class="task-section">
        <EmptyState v-if="dayTasks.length === 0" :show-add="true" @add="openModal('task')" />


        <div v-else class="task-list-wrap">
          <TaskListHeader :label="isViewingToday ? 'Today' : FULL_DAY_NAMES[selectedDayIndex]" :is-today="isViewingToday" :completed="completedTaskCount" :total="dayTasks.length"
                          :sound-enabled="soundEnabled" :show-completed="showCompleted" v-model:prefs="viewPrefs" @toggle-sound="toggleSound" @toggle-completed="showCompleted = !showCompleted" />



          <TimeBlockSchedule v-if="showSchedule" :schedule="schedule" />


          <p v-if="viewPrefs.filter !== 'all' && isViewingToday && visibleTaskCount === 0" class="filter-empty">No tasks match this filter.</p>

          <draggable
              handle=".drag-handle"
              :item-key="taskKey"
              :prevent-on-filter="false"
              :fallback-tolerance="5"
              :animation="reducedMotion ? 0 : 150"
              :disabled="!reorderable"
              :model-value="displayTasks"
              @update:model-value="onReorder"
              tag="div"
              class="tasks-list space-y-2"
              ghost-class="ghost"
              drag-class="drag"
              @start="onDragStart()"
              @end="isDraggingTask = false; playSound('dragEnd'); handleDragEnd()"
          >
            <template #item="{ element: task, index }">
              <TaskCard
                  v-if="!task.completed || !isViewingToday"
                  :task="task" :up-next="isViewingToday && !task.completed && taskKey(task) === upNextKey" :drag-disabled="!reorderable" :index="realIndex(task)" :is-today-tab="isViewingToday" :expanded="expandedKey === taskKey(task)"
                  :active-labels="activeLabels" :now="nowTick" :show-notification="showNotification" :transfer-notification="transferNotification"
                  @toggle-expand="toggleExpanded(task)" @toggle-complete="toggleTaskCompletion(realIndex(task))" @open-detail="openTaskDetailModal(task)"
                  @set-boss="setBoss(realIndex(task), task)" @toggle-important="toggleTaskImportance(realIndex(task))" @patch="patchTask(realIndex(task), task, $event)" @subtask-patch="onSubtaskPatch(realIndex(task), task, $event)"
                  @toggle-label="toggleLabelHighlight" @open-reminder="openModal('calendar', realIndex(task), task.title)" @transfer="openTransferModal(realIndex(task))"
                  @video="openYouTubeModal(realIndex(task))" @upload="handleUpload($event, realIndex(task))" @timer="openTaskTimerModal(realIndex(task))"
                  @wont-do="openWontDoModal(realIndex(task))" @delete="deleteTask(realIndex(task))" @schedule="scheduleExistingTask(realIndex(task), task, $event)" @set-repeat="setTaskRepeat(task, $event)"
              />
            </template>
          </draggable>

          <div v-if="isViewingToday && completedTaskCount > 0" class="done-section">
            <button type="button" class="done-toggle" :aria-expanded="showCompleted ? 'true' : 'false'" @click="showCompleted = !showCompleted">
              <i class="fas" :class="showCompleted ? 'fa-chevron-down' : 'fa-chevron-right'" aria-hidden="true"></i>
              <span>Completed ({{ completedTaskCount }})</span>
              <i class="fas done-eye" :class="showCompleted ? 'fa-eye' : 'fa-eye-slash'" aria-hidden="true"></i>
            </button>
            <div v-if="showCompleted" class="tasks-list tasks-list--done">
              <TaskCard v-for="task in displayTasks.filter((t) => t.completed)" :key="taskKey(task)"
                  :task="task" :drag-disabled="true" :index="realIndex(task)" :is-today-tab="true" :expanded="expandedKey === taskKey(task)"
                  :active-labels="activeLabels" :now="nowTick"
                  @toggle-expand="toggleExpanded(task)" @toggle-complete="toggleTaskCompletion(realIndex(task))" @open-detail="openTaskDetailModal(task)"
                  @set-boss="setBoss(realIndex(task), task)" @toggle-important="toggleTaskImportance(realIndex(task))" @patch="patchTask(realIndex(task), task, $event)" @subtask-patch="onSubtaskPatch(realIndex(task), task, $event)"
                  @toggle-label="toggleLabelHighlight" @open-reminder="openModal('calendar', realIndex(task), task.title)" @transfer="openTransferModal(realIndex(task))"
                  @video="openYouTubeModal(realIndex(task))" @upload="handleUpload($event, realIndex(task))" @timer="openTaskTimerModal(realIndex(task))"
                  @wont-do="openWontDoModal(realIndex(task))" @delete="deleteTask(realIndex(task))" @schedule="scheduleExistingTask(realIndex(task), task, $event)" @set-repeat="setTaskRepeat(task, $event)" />
            </div>
          </div>

          <IdleState v-if="dayTasks.length > 0 && dayTasks.every(task => task.completed) && !showCompleted" />


          <WontDoList v-if="wontDoTasks.length > 0 && !selectedDayRoutine?.every(task => task.completed)" :tasks="wontDoTasks" @undo="undoWontDo" />

        </div>
      </section>
      <StartDayPrompt v-else-if="isViewingToday" :done="!!daySession.ended" :ended-at="daySession.endedAtText" @start="startDay" />

      <TimeStatsBar v-if="isViewingToday" :stats="timeStats" :ended="!!daySession.ended" :suggest="suggestShutdown && !shutdownDismissed" @wrap-up="openShutdown" />

      <ScheduledList v-if="userId" :tasks="futureScheduled" :today-str="todayStr" :error="scheduledError"
                     @move-today="moveScheduledToToday" @update="updateScheduledDate" @delete="deleteScheduled" />

      <FabButtons :user-id="userId" :listening="listening" @add="openModal('task')" @voice="startVoiceInput" />


    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, reactive } from 'vue';
import { useSounds } from '@/composables/useSounds';
import { patchStoredTask, loadDayTasks, carryTasksToDay } from '@/composables/useDayPersistence';
import { activeFromForDay, isHiddenOnDate, seriesDays, withoutSeries } from '@/utils/repeat';
import { useTaskViewPrefs } from '@/composables/useTaskViewPrefs';
import { viewTasks, canReorder, normalizePrefs, visibleCount, shouldHandleShortcut } from '@/utils/taskView';
import { ACTIVE_CAP, taskKey, activeCount, loadSummary, buildSchedule } from '@/utils/taskPlanning';
import { getTodayId, formatSessionTime, getCurrentDate, formatTime, getTodayDate, isToday } from '@/utils/dateTime';
import { badges } from '@/utils/gamification';
import { recordMonthlyToggle, awardFinishedMonth } from '@/composables/useMonthlyStats';
import { loadDisciplineSettings, settleDeadlines, clearLossPending, loadDisciplineState, setBossForDay, setBossCleared, tryFreeze, logDiscipline, patchDisciplineState } from '@/composables/useDiscipline';
import { levelFor, rewardsFor } from '@/utils/rewards';
import { defaultSettings as defaultDiscipline, warningFor, isPastDeadline, streakGate, BOSS_BONUS } from '@/utils/discipline';
import DramaOverlay from '@/components/discipline/DramaOverlay.vue';
import BossPanel from '@/components/discipline/BossPanel.vue';
import { bossMessage, validReason, carryTask, canAddTask, watchingBlockers, isIdle, verdict as dayVerdict, line as bossLine, IDLE_MINUTES } from '@/utils/strictBoss';
import MorningReport from '@/components/home/MorningReport.vue';
import { buildRecap, reportDue, prevDay } from '@/utils/dailyReport';
import { monthKey, prevMonthKey } from '@/utils/ranking';
import { applyTaskToggle, evaluateStreak, localDateStr, dayDiff, ALLOWED_GAP_DAYS, DAILY_STREAK_MIN } from '@/utils/streak';
import { askAi } from '@/composables/useAi';
import { useRouter as _useRouter } from 'vue-router';
import { requirePro, loadUserDoc } from '@/composables/usePro';
import { isPro as isProUser } from '@/utils/pro';
import { checkDailyLimit } from '@/utils/taskLimits';
import { canUse } from '@/utils/pro';
const _proRouter = _useRouter();
// Daily task limit (config/pricing.js TASK_LIMITS): free 3/day, Pro 5/day
const limitHit = ref(null); // { limit, count, pro, day } when the last add was blocked
const goUpgradeForLimit = () => { modalOpen.value = false; _proRouter.push({ path: '/paywall', query: { feature: 'taskLimit', from: '/home' } }); };
// Limit data is prefetched when the add modal opens so Save does not wait on 8 Firestore reads.
let gateCache = null; // { at, pro, lists, extra: [] }
const fetchGateData = async () => {
  const [ud, ...snaps] = await Promise.all([loadUserDoc(), ...days.map((d) => getDoc(doc(db, 'weeklyRoutines', `${userId.value}_${d.day}`)))]);
  gateCache = { at: Date.now(), pro: isProUser(ud), lists: snaps.map((x) => (x.exists() ? x.data().tasks || [] : [])), extra: [] };
  return gateCache;
};
let gatePrefetch = null;
const prefetchGate = () => { if (userId.value) gatePrefetch = fetchGateData().catch(() => null); };
const dailyLimitGate = async (dayKey) => {
  let g = gatePrefetch ? await gatePrefetch : null;
  if (!g || Date.now() - g.at > 60000) g = await fetchGateData();
  const res = checkDailyLimit(g.pro, dayKey, [...g.lists, g.extra], scheduledList.value || []);
  limitHit.value = res.ok ? null : { ...res, pro: g.pro, day: dayKey };
  return res.ok;
};
// Read-modify-write of a weeklyRoutines day doc inside a transaction (no lost updates when two writes overlap).
const mutateDay = (dayName, fn) => runTransaction(db, async (tx) => {
  const ref_ = doc(db, 'weeklyRoutines', `${userId.value}_${dayName}`);
  const snap = await tx.get(ref_);
  const next = fn(snap.exists() ? [...(snap.data().tasks || [])] : []);
  tx.set(ref_, { tasks: next, updatedAt: serverTimestamp() }, { merge: true });
  return next;
});
const strictAllowed = ref(true); // false for free users once ENFORCE_PAYWALL is on
loadUserDoc().then((d) => { strictAllowed.value = canUse(d, 'strictBoss'); }).catch(() => {});
import { scheduleNotification, sendNotificationToPlayer, linkPushUser } from '@/composables/useNotifications';
import { speak } from '@/composables/useSpeech';
import { completionPercentage, computeTimeStats, daysLeftInYearFrom, heroTitleFor } from '@/utils/dayStats';
import { shouldAutoComplete, resetSubtasks } from '@/utils/subtasks';
import { buildScheduledEntry, buildRecurringTemplate, isTaskVisibleOn, futureOf, dueOf, countsByDate, withWeekDates, isValidDate, removeScheduled, rescheduleEntry } from '@/utils/scheduling';
import { mutateScheduled, materializeDueForToday } from '@/composables/useScheduledTasks';
import ScheduledList from '@/components/home/ScheduledList.vue';
import EmptyState from '@/components/home/EmptyState.vue';
import StartDayPrompt from '@/components/home/StartDayPrompt.vue';
import TaskListHeader from '@/components/home/TaskListHeader.vue';
import FabButtons from '@/components/home/FabButtons.vue';
import IdleState from '@/components/home/IdleState.vue';
import WontDoList from '@/components/home/WontDoList.vue';
import LoadSummary from '@/components/home/LoadSummary.vue';
import TaskCard from '@/components/home/TaskCard.vue';
import TimeBlockSchedule from '@/components/home/TimeBlockSchedule.vue';
import AddTaskModal from '@/components/home/AddTaskModal.vue';
import CelebrationOverlay from '@/components/home/CelebrationOverlay.vue';
import DayTabs from '@/components/home/DayTabs.vue';
import ImagePreview from '@/components/home/ImagePreview.vue';
import ProgressBar from '@/components/home/ProgressBar.vue';
import ReminderModal from '@/components/home/ReminderModal.vue';
import ShutdownPrompt from '@/components/home/ShutdownPrompt.vue';
import TaskDetailModal from '@/components/home/TaskDetailModal.vue';
import TimeStatsBar from '@/components/home/TimeStatsBar.vue';
import TimerModal from '@/components/home/TimerModal.vue';
import TransferModal from '@/components/home/TransferModal.vue';
import VoiceModal from '@/components/home/VoiceModal.vue';
import { splitSpokenTasks, voiceCapability, UNDO_MS } from '@/utils/voiceSplit';
import WontDoModal from '@/components/home/WontDoModal.vue';
import WorkoutModal from '@/components/home/WorkoutModal.vue';
import YouTubeModal from '@/components/home/YouTubeModal.vue';
import { auth } from '@/firebaseConfig'; // Assuming you have Firebase authentication configured
import { onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import data from '@/data.json';
import draggable from "vuedraggable";
import {db} from '@/firebaseConfig'; // Assuming you have imported the Firebase setup file and exported the db instance
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, deleteDoc, getFirestore, runTransaction} from 'firebase/firestore';
const modalOpen = ref(false);
import { deleteObject } from "firebase/storage";

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
          task.status !== 'pending' && // pending tasks never auto-carry as overdue
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

  if (strictOn.value) Object.assign(task, carryTask(task));

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
const reminder = ref({ date: "", time: "", repeat: "" });

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

  if (strictOn.value && !validReason(deferReason.value)) return;
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
    const [rawTask] = currentTasks.splice(selectedTransferTaskIndex.value, 1);
    if (!rawTask) return;
    const task = strictOn.value ? carryTask(rawTask) : rawTask;
    if (strictOn.value) {
      logStrict('deferred', `${task.title} → ${targetDay}: ${deferReason.value.trim()}`);
      if (task.bossWatching && !rawTask.bossWatching) logStrict('boss-watching', task.title);
      deferReason.value = '';
    }

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
const resetTasksToIncomplete = async (dayIndex = selectedDayIndex.value, isCurrent = () => true) => {
  if (!userId.value || dayIndex === -1) return;

  const selectedDay = days[dayIndex];
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay.day}`);

  try {
    const docSnap = await getDoc(selectedDayDocRef);
    if (!isCurrent()) return; // user already moved to another tab
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
    const isPastDay = dayIndex < todayIndex;

    // Update Firestore
    await updateDoc(selectedDayDocRef, {
      tasks: resetTasks,
      updatedAt: serverTimestamp(),
      ...(isPastDay && { skipStreakUpdate: true }) // optional flag if you use it elsewhere
    });

    if (isCurrent() && days[selectedDayIndex.value].day === selectedDay.day) {
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
    prefetchGate();
  }
};

const showCompleted = ref(false);

// ─── Today sort/filter (prefs in localStorage; logic in @/utils/taskView) ───
const { prefs: viewPrefs } = useTaskViewPrefs();
const effectivePrefs = computed(() => (new Date().getDay() === selectedDayIndex.value ? normalizePrefs(viewPrefs.value) : normalizePrefs(null)));
// Copies not active yet on the viewed date (e.g. a Daily task created today, on earlier days of this week) are hidden, never deleted.
const viewTabDate = computed(() => tabDays.value[selectedDayIndex.value]?.date || '');
const dayTasks = computed(() => selectedDayRoutine.value.filter((t) => !isHiddenOnDate(t, viewTabDate.value)));
const hasHiddenCopies = computed(() => dayTasks.value.length !== selectedDayRoutine.value.length);
const viewItems = computed(() => viewTasks(selectedDayRoutine.value, effectivePrefs.value).filter((i) => !isHiddenOnDate(i.task, viewTabDate.value)));
const displayTasks = computed(() => viewItems.value.map((i) => i.task));
const visibleTaskCount = computed(() => visibleCount(viewItems.value, showCompleted.value));
const reorderable = computed(() => canReorder(effectivePrefs.value) && !hasHiddenCopies.value);
const realIndex = (task) => (selectedDayRoutine.value || []).indexOf(task);
const onReorder = (list) => { if (reorderable.value && Array.isArray(list)) selectedDayRoutine.value = list; };
const reducedMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

// "n" opens Add task (not while typing or when any modal/overlay is open)
const anyModalOpen = computed(() => !!(modalOpen.value || isModalOpen.value || showWorkoutModal.value || showTimerModal.value || wontDoModalOpen.value ||
  transferModalOpen.value || youtubeModalOpen.value || taskDetailModalOpen.value || showImagePreview.value || voiceOpen.value || shutdownOpen.value || showFullScreenAnimation.value));
const onShortcutKey = (e) => {
  if (!shouldHandleShortcut(e, anyModalOpen.value)) return;
  e.preventDefault();
  openModal('task');
};
onMounted(() => document.addEventListener('keydown', onShortcutKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onShortcutKey));



// Close Modal
const closeModal = () => {
  isModalOpen.value = false;
  reminder.value = { date: "", time: "", repeat: "" };
  modalOpen.value = false
};
const selectedDayIndex = ref(-1);
// Fresh Add-task form. Repeat defaults to "Just once" (one-time); Daily/Weekly are opt-in.
const blankTask = () => ({
  title: '', time: '', priority: 'low', labels: [], notes: '', selectedDays: [], position: 0, type: 'one-time',
  dueDate: '', startTime: '', estimateMin: '', nextAction: '', status: 'todo', pendingOn: '',
  scheduleDate: '', scheduleTime: '', scheduleRepeat: '', scheduleDays: [],
  reminder: { datetime: '', repeat: '' },
});
const newTask = ref(blankTask());


const error = ref('');
const editingTask = ref(null);
const editedTask = ref({title: '', time: '', priority: 'low', labels: [], notes: ''});
const searchQuery = ref('');


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

// Header date is derived from the one source of truth (selectedDayIndex) so it can never lag behind the active tab.
const currentDate = computed(() => {
  if (selectedDayIndex.value === -1) return getCurrentDate();
  const d = new Date();
  d.setDate(d.getDate() + (selectedDayIndex.value - d.getDay()));
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
});

let weeklyRoutines = [];

let fetchSeq = 0; // rapid day switching: only the latest fetch may write the routine
const fetchSelectedDayRoutine = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;
  const seq = ++fetchSeq;

  const selectedDay = days[selectedDayIndex.value];
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${selectedDay.day}`);

  try {
    const selectedDayDocSnapshot = await getDoc(selectedDayDocRef);
    if (seq !== fetchSeq) return; // a newer day was selected meanwhile

    if (selectedDayDocSnapshot.exists()) {
      let tasks = selectedDayDocSnapshot.data().tasks || [];

      const isPastDay = new Date(selectedDay.date) < new Date(getTodayDate());

      // If it's a past day, reset all tasks to incomplete
      if (isPastDay) {
        tasks = tasks.map(task => resetSubtasks({
          ...task,
          completed: false
        }));

        if (seq !== fetchSeq) return; // stale: no daily-reset write for a day that is no longer selected
        await updateDoc(selectedDayDocRef, {
          tasks: tasks,
          updatedAt: serverTimestamp()
        });
        if (seq !== fetchSeq) return;
      }

      selectedDayRoutine.value = tasks;
    } else {
      selectedDayRoutine.value = [];
    }
  } catch (error) {
    console.error('Error fetching tasks for the selected day:', error);
    if (seq === fetchSeq) selectedDayRoutine.value = [];
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
const updateCurrentDate = () => {}; // kept for callers: currentDate is now a computed of selectedDayIndex



// Watch for tab (day) changes and update the current date
watch(selectedDayIndex, updateCurrentDate);

// Function to get motivational messages for milestones
// On mounted, set the initial date to today's tab
onMounted(() => {
  const todayIndex = new Date().getDay();
  selectedDayIndex.value = todayIndex; // Initialize to today's tab
  updateCurrentDate(); // Update the displayed current date
});
// Synchronous: selection (and so header date, isSelected, tab highlight) flips immediately; updateRoutine starts the
// single async fetch whose result only applies while it is still the latest (fetchSeq guard).
const selectDate = (index) => {
  selectedDayIndex.value = index;
  updateRoutine(); // clears the old day's list and kicks off the (sequence-guarded) fetch
};

const getSelectedDayRoutine = () => {
  return (selectedDayIndex.value !== -1 && weeklyRoutines?.tasks) || [];
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
  gateCache = null; gatePrefetch = null; // a deleted task frees its slot under the daily limit
  const confirmed = confirm("Are you sure you want to delete this task?");
  if (!confirmed) return;
  const dayName = days[selectedDayIndex.value].day;
  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${dayName}`);
  const target = selectedDayRoutine.value[index];

  try {
    // Tasks created for several weekdays (Daily / ticked days) are separate copies sharing createdAt+title: offer to remove them all.
    let alsoDays = [];
    if (target && target.type === 'recurring' && target.createdAt) {
      const byDay = {};
      await Promise.all(days.map(async (d) => { if (d.day !== dayName) byDay[d.day] = await loadDayTasks(userId.value, d.day); }));
      alsoDays = seriesDays(byDay, target, dayName);
    }
    const removeAll = alsoDays.length > 0 &&
      confirm(`This task repeats on ${alsoDays.length} other day${alsoDays.length > 1 ? 's' : ''} (${alsoDays.join(', ')}).\n\nOK = delete it from all days\nCancel = delete only from this day`);

    selectedDayRoutine.value.splice(index, 1);
    await updateDoc(selectedDayDocRef, {
      tasks: selectedDayRoutine.value,
      updatedAt: serverTimestamp()
    });
    if (removeAll) {
      for (const d of alsoDays) {
        const cur = await loadDayTasks(userId.value, d);
        await updateDoc(doc(db, 'weeklyRoutines', `${userId.value}_${d}`), { tasks: withoutSeries(cur, target), updatedAt: serverTimestamp() });
      }
    }

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

  if (isToday(selectedDayIndex.value)) onBossToggle(task).finally(() => updateStreakOnCompletion(task)); // both directions; pending ignored

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
  if (strictOn.value && !validReason(wontDoReason.value)) return; // "why didn't you?" is mandatory in strict mode
  if (strictOn.value) logStrict('skipped', `${selectedDayRoutine.value[selectedWontDoTaskIndex.value]?.title}: ${wontDoReason.value.trim()}`);

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
    await saveSelectedDayTasks(); // persist removal so it doesn't reappear on reload/transfer

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
  await saveSelectedDayTasks().catch((e) => console.warn('Restore not saved:', e));

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
let tabSeq = 0; // latest tab click wins; older async work must not touch selection or routine
const handleDayTabClick = async (index) => {
  const seq = ++tabSeq;
  const todayIndex = new Date().getDay();
  const needsReset = index !== todayIndex && selectedDayIndex.value !== index;

  selectDate(index); // synchronous selection first (previously the await below let an older click land last)

  if (needsReset) {
    await resetTasksToIncomplete(index, () => seq === tabSeq && selectedDayIndex.value === index);
  }
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
    fetchSelectedDayRoutine();
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


// A day counts once >=1 task is completed (local date). See src/utils/streak.js.
const streakGap = () => Number(userSettingsStreakGap.value) || ALLOWED_GAP_DAYS;

// ---- Discipline Mode ----
const disciplineSettings = ref(defaultDiscipline());
const disciplineWarning = ref(null);
const lossScreen = ref(null);
// Whether today's completions may count toward the streak (Discipline Mode rules).
const discState = ref({});
const bossVictory = ref(null);
const streakGateNow = () => {
  const today = localDateStr();
  return streakGate(disciplineSettings.value, {
    missedToday: isPastDeadline(new Date(), today, disciplineSettings.value.deadline),
    bossSet: discState.value.bossDate === today,
    bossCleared: discState.value.bossClearedDate === today,
  });
};
// One boss per day (today's tab only). Patches the flag on today's tasks.
const setBoss = async (index, task) => {
  if (!isToday(selectedDayIndex.value) || !userId.value) return;
  const makeBoss = !task.boss;
  for (let i = 0; i < selectedDayRoutine.value.length; i++) {
    const t = selectedDayRoutine.value[i];
    if (i === index) await patchTask(i, t, { boss: makeBoss });
    else if (t.boss) await patchTask(i, t, { boss: false });
  }
  const today = localDateStr();
  try {
    if (makeBoss) { await setBossForDay(userId.value, today, task.title); discState.value = { ...discState.value, bossDate: today, bossTitle: task.title, bossClearedDate: null }; }
    else { await setBossForDay(userId.value, null, null); discState.value = { ...discState.value, bossDate: null, bossClearedDate: null }; }
  } catch (e) { console.error('Set boss failed:', e); }
};
// Called before the streak update so the gate sees the boss state.
const onBossToggle = async (task) => {
  if (!task?.boss || !userId.value) return;
  const today = localDateStr();
  discState.value = { ...discState.value, bossDate: today, bossClearedDate: task.completed ? today : null };
  try { await setBossCleared(userId.value, today, !!task.completed); } catch (e) { console.error('Boss update failed:', e); }
  if (task.completed) bossVictory.value = { title: task.title };
};
const runDiscipline = async () => {
  if (!userId.value || !disciplineSettings.value.enabled) { disciplineWarning.value = null; bossMsg.value = null; return; }
  const now = new Date(); const today = localDateStr(now);
  runStrictBoss(now, today);
  const w = warningFor(now, today, disciplineSettings.value.deadline, streakStatus.value === 'done');
  disciplineWarning.value = w;
  if (w) {
    const k = `discWarn_${userId.value}_${today}_${w}`;
    try {
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, '1');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('ClingNot deadline', { body: `${w === '30m' ? '30 min' : '2 hours'} left: ${streakProgress.value}/${DAILY_STREAK_MIN} tasks done` });
      }
    } catch (e) { /* notifications optional */ }
  }
  try {
    const r = await settleDeadlines(userId.value, disciplineSettings.value, now, (sd, missed) => tryFreeze(userId.value, sd, missed, rewardsFor(bestStreak.value).freezes));
    const st = await loadDisciplineState(userId.value);
    discState.value = st;
    if (st?.lossPending) lossScreen.value = st.lossPending;
    checkProgression(st);
    if (r?.missed?.length) await checkStreakOnCompletion();
  } catch (e) { console.error('Discipline settle failed:', e); }
};
// ---- Strict Boss Mode ----
const strictOn = computed(() => !!(strictAllowed.value && disciplineSettings.value.enabled && disciplineSettings.value.strict));
const bossMsg = ref(null);
const idleNudge = ref(null);
const verdictScreen = ref(null);
const bossHidden = ref(false); // user collapsed the boss panel away for this session
const bossLines = computed(() => {
  const out = [];
  if (bossWatchingMsg.value) out.push({ kind: 'watching', text: bossWatchingMsg.value });
  if (idleNudge.value) out.push({ kind: 'idle', text: idleNudge.value, dismissible: true });
  else if (bossMsg.value && bossMsg.value.phase !== 'verdict') out.push({ kind: bossMsg.value.kind, text: bossMsg.value.text });
  return out;
});
// Remember an acknowledged verdict locally too, so a failed Firestore write can't re-open it every tick.
const verdictSeenKey = () => `clingnot-verdict-seen-${userId.value}`;
const verdictSeen = (d) => { try { return localStorage.getItem(verdictSeenKey()) === d; } catch (e) { return false; } };
const deferReason = ref('');
const lastActive = ref(Date.now());
const markActive = () => { lastActive.value = Date.now(); };
const logStrict = (type, detail) => { if (userId.value) logDiscipline(userId.value, type, localDateStr(), detail).catch((e) => console.error('Boss log failed:', e)); };
const bossWatchingMsg = computed(() => {
  if (!strictOn.value || !isToday(selectedDayIndex.value)) return null;
  const b = watchingBlockers(selectedDayRoutine.value);
  return b.length ? bossLine('watching', { title: b[0].title }) : null;
});
const runStrictBoss = (now, today) => {
  if (!strictOn.value) { bossMsg.value = null; idleNudge.value = null; return; }
  const done = streakProgress.value; const min = DAILY_STREAK_MIN; const deadline = disciplineSettings.value.deadline;
  bossMsg.value = bossMessage(now, today, deadline, done, min);
  const open = isToday(selectedDayIndex.value) ? (selectedDayRoutine.value || []).filter((t) => !t.completed && t.status !== 'pending').length : 0;
  if (!idleNudge.value && !anyModalOpen.value && isIdle(lastActive.value, now.getTime(), open)) {
    idleNudge.value = bossLine('idle', { open, idle: IDLE_MINUTES }, String(now.getHours()));
    lastActive.value = now.getTime(); // next nudge after another idle stretch
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification('Boss: focus check', { body: idleNudge.value }); } catch (e) { /* optional */ }
  }
  if (bossMsg.value?.phase === 'verdict' && discState.value.lastVerdictDate !== today && !verdictSeen(today) && !verdictScreen.value) {
    const v = dayVerdict({ done, min, total: (selectedDayRoutine.value || []).filter((t) => t.status !== 'pending').length });
    verdictScreen.value = { v, text: bossMsg.value.text, date: today };
  }
};
const dismissVerdict = async () => {
  const s = verdictScreen.value; verdictScreen.value = null;
  if (!s || !userId.value) return;
  discState.value = { ...discState.value, lastVerdictDate: s.date };
  try { localStorage.setItem(verdictSeenKey(), s.date); } catch (e) { /* private mode */ }
  try {
    await patchDisciplineState(userId.value, { lastVerdictDate: s.date, lastVerdict: { date: s.date, passed: s.v.passed, grade: s.v.grade, done: s.v.done } });
    if (!s.v.passed) await logDiscipline(userId.value, 'verdict-failed', s.date, `${s.v.done}/${s.v.min}, grade ${s.v.grade}`);
  } catch (e) { console.error('Verdict save failed:', e); }
};
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
onMounted(() => ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true })));
onBeforeUnmount(() => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive)));
// ---- Levels / milestone rewards ----
const levelUp = ref(null);
const rewardScreen = ref(null);
const appTheme = ref('');
const checkProgression = (st) => {
  if (!userId.value) return;
  const lv = levelFor(st?.xp || 0);
  playerLevel.value = lv;
  appTheme.value = st?.theme && rewardsFor(bestStreak.value).themes.includes(st.theme) ? st.theme : '';
  try {
    const kL = `lastLevelSeen_${userId.value}`; const seenL = Number(localStorage.getItem(kL) || 0);
    if (seenL && lv.level > seenL) levelUp.value = lv;
    localStorage.setItem(kL, String(Math.max(seenL, lv.level)));
    const kR = `lastRewardSeen_${userId.value}`; const seenR = Number(localStorage.getItem(kR) || 0);
    const newest = rewardsFor(bestStreak.value).unlocked.filter((m) => m.days > seenR);
    if (newest.length) { rewardScreen.value = newest[newest.length - 1]; localStorage.setItem(kR, String(newest[newest.length - 1].days)); }
  } catch (e) { /* storage optional */ }
};
const playerLevel = ref(levelFor(0));
const dismissLoss = async () => { lossScreen.value = null; try { await clearLossPending(userId.value); } catch (e) { /* retry next open */ } };
// ---- Morning report: first open after 8 AM local, once per day ----
const morningRecap = ref(null);
const maybeShowMorningReport = async () => {
  if (!userId.value) return;
  const now = new Date(); const today = localDateStr(now);
  const k = `morningReport_${userId.value}`;
  try { if (!reportDue(today, now.getHours(), localStorage.getItem(k))) return; } catch (e) { return; }
  try {
    const yName = days[new Date(`${prevDay(today)}T12:00:00`).getDay()].day;
    const tName = days[now.getDay()].day;
    const [sd, y, t] = await Promise.all([getDoc(doc(db, 'streaks', userId.value)), loadDayTasks(userId.value, yName), loadDayTasks(userId.value, tName)]);
    morningRecap.value = buildRecap({ today, streakDoc: sd.exists() ? sd.data() : {}, yesterdayTasks: y, todayTasks: t, min: DAILY_STREAK_MIN, now });
    localStorage.setItem(k, today);
  } catch (e) { console.error('Morning report failed:', e); }
};
let disciplineTimer = null;
const startDiscipline = async () => {
  try { disciplineSettings.value = await loadDisciplineSettings(userId.value); } catch (e) { return; }
  await runDiscipline();
  if (!disciplineTimer) disciplineTimer = setInterval(runDiscipline, 60 * 1000);
};
onBeforeUnmount(() => { if (disciplineTimer) clearInterval(disciplineTimer); });
const applyStreakState = (st) => {
  const ev = evaluateStreak(st, localDateStr(), streakGap());
  streak.value = ev.streak; bestStreak.value = ev.bestStreak; lastCompletionDate.value = ev.lastCompletionDate;
  streakStatus.value = ev.status; streakProgress.value = ev.progress;
  try { localStorage.setItem(`streakCache_${userId.value}`, JSON.stringify(st)); } catch (e) { /* cache only */ }
};
// Called when a task on today's tab is (un)completed; counts distinct non-pending tasks toward DAILY_STREAK_MIN.
const updateStreakOnCompletion = async (task) => {
  if (!userId.value || !task) return;
  if (!isTaskVisibleOn(task, localDateStr())) return; // scheduled task before its week: never counts (central visibility check)
  const streakDocRef = doc(db, 'streaks', userId.value);
  try {
    const snap = await getDoc(streakDocRef);
    const prev = snap.exists() ? snap.data() : null;
    const next = applyTaskToggle(prev, localDateStr(), { key: taskKey(task), completed: !!task.completed, pending: task.status === 'pending', gate: streakGateNow() }, streakGap());
    await setDoc(streakDocRef, { ...next, updatedAt: serverTimestamp() }, { merge: true });
    applyStreakState(next);
    recordMonthlyToggle(userId.value, localDateStr(), { key: taskKey(task), completed: !!task.completed, pending: task.status === 'pending' }, next.bestStreak)
      .then(() => loadDisciplineState(userId.value)).then((st) => { discState.value = st; checkProgression(st); })
      .catch((e) => console.error('Monthly stats update failed:', e));
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
    linkPushUser(user.uid); // OneSignal external_id = uid, so server-side 'self' pushes reach only this user
    console.log('User ID:', userId.value);
    await loadDaySession();
    // Fetch tasks and streak after user ID is set
    fetchStreakOnLoad(); // Ensure this runs after userId is set
    startDiscipline();
    maybeShowMorningReport();
    awardFinishedMonth(user.uid, prevMonthKey(monthKey(localDateStr()))).catch(() => {}); // month-end badges for last month

    const todayIndex = new Date().getDay();
    if (todayIndex !== -1) {
      selectedDayIndex.value = todayIndex;
      await runScheduledMaterialization(); // add due scheduled tasks to today before the list is fetched
      fetchSelectedDayRoutine(); // Fetch tasks for the current day
    }
  } else {
    userId.value = null; // Clear user ID when the user logs out
    selectedDayRoutine.value = []; // Clear tasks when no user is logged in
  }
});

const userId = ref(null);

// ─── Scheduled tasks (field scheduledTasks on users/{uid}; see utils/scheduling.js) ───
const scheduledList = ref([]);
const scheduledError = ref('');
const todayStr = ref(getTodayId());
const futureScheduled = computed(() => futureOf(scheduledList.value, todayStr.value));
// Tabs need real dates (data.json days have empty `date`); recomputed when todayStr rolls over.
const tabDays = computed(() => { void todayStr.value; return withWeekDates(days); });
const scheduledCounts = computed(() => countsByDate(scheduledList.value, todayStr.value));

let materializing = false;
const runScheduledMaterialization = async () => {
  if (!userId.value || materializing) return;
  materializing = true;
  try {
    todayStr.value = getTodayId();
    const todayName = days[new Date().getDay()]?.day;
    if (!todayName) return;
    const res = await materializeDueForToday(userId.value, todayName, todayStr.value, (ds) => days[new Date(`${ds}T12:00:00`).getDay()]?.day);
    scheduledList.value = res.scheduled;
    scheduledError.value = '';
    return res.added;
  } catch (e) {
    console.error('Scheduled tasks unavailable (check Firestore rules for users/{uid}):', e);
    scheduledError.value = 'Scheduled tasks could not be loaded.';
  } finally { materializing = false; }
};
const afterMaterialize = async () => {
  const added = await runScheduledMaterialization();
  if (added && selectedDayIndex.value === new Date().getDay()) await fetchSelectedDayRoutine();
};
watch(selectedDayIndex, () => { if (userId.value && dueOf(scheduledList.value, getTodayId()).length) afterMaterialize(); });
const onVisible = () => { if (document.visibilityState === 'visible' && userId.value && getTodayId() !== todayStr.value) afterMaterialize(); };
onMounted(() => document.addEventListener('visibilitychange', onVisible));
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible));

const submitScheduledTask = async () => {
  const nt = newTask.value;
  const repeating = !!nt.scheduleRepeat;
  if (!isValidDate(nt.scheduleDate) || (repeating ? nt.scheduleDate < getTodayId() : nt.scheduleDate <= getTodayId())) { error.value = 'Pick a date after today, or clear “Schedule for later”.'; return; }
  const labels = typeof nt.labels === 'string' ? nt.labels.split(',').map(l => l.trim()).filter(Boolean) : (nt.labels || []);
  const fields = {
    title: nt.title, important: false, time: '', priority: nt.priority, labels, notes: nt.notes, userId: userId.value,
    status: nt.status || 'todo', pendingOn: nt.status === 'pending' ? (nt.pendingOn || '').trim() : '', dueDate: nt.dueDate || '', startTime: nt.startTime || '',
    estimateMin: Number(nt.estimateMin) || 0, nextAction: (nt.nextAction || '').trim(),
  };
  const entry = repeating
    ? buildRecurringTemplate({ ...fields, scheduledTime: nt.scheduleTime }, nt.scheduleDate, { freq: nt.scheduleRepeat, days: nt.scheduleDays })
    : buildScheduledEntry(fields, nt.scheduleDate, nt.scheduleTime);
  if (!entry) { error.value = 'Could not schedule this task.'; return; }
  try {
    scheduledList.value = await mutateScheduled(userId.value, (l) => [...l, entry]);
    afterMaterialize(); // a date in the current week (or a recurring occurrence) shows up right away
    newTask.value = blankTask();
    capWarning.value = false; capOverride.value = false;
    closeModal();
    error.value = '';
  } catch (e) {
    console.error('Error scheduling task:', e);
    error.value = 'Could not save the scheduled task (permissions?). Nothing was changed.';
  }
};

// Editor: move an existing one-time task from today's list to a future date.
const scheduleExistingTask = async (index, task, { date, time }) => {
  if (!userId.value || !isValidDate(date) || date <= getTodayId()) { alert('Pick a date after today.'); return; }
  const entry = buildScheduledEntry({ ...task, userId: userId.value }, date, time);
  if (!entry) return;
  try {
    scheduledList.value = await mutateScheduled(userId.value, (l) => [...l, entry]); // saved first, so a failure never loses the task
    const dayName = days[selectedDayIndex.value].day;
    const ref_ = doc(db, 'weeklyRoutines', `${userId.value}_${dayName}`);
    const key = taskKey(task);
    const cur = (await getDoc(ref_)).data()?.tasks || [];
    await updateDoc(ref_, { tasks: cur.filter((t) => taskKey(t) !== key), updatedAt: serverTimestamp() });
    selectedDayRoutine.value = selectedDayRoutine.value.filter((t) => taskKey(t) !== key);
  } catch (e) {
    console.error('Error scheduling task:', e);
    alert('Could not schedule this task.');
  }
};

const moveScheduledToToday = async (id) => {
  if (!userId.value) return;
  try {
    scheduledList.value = await mutateScheduled(userId.value, (l) => rescheduleEntry(l, id, getTodayId(), ''));
    await afterMaterialize();
  } catch (e) { console.error(e); scheduledError.value = 'Could not move the task.'; }
};
const updateScheduledDate = async ({ id, date, time }) => {
  if (!userId.value || !isValidDate(date) || date < getTodayId()) return;
  try { scheduledList.value = await mutateScheduled(userId.value, (l) => rescheduleEntry(l, id, date, time)); if (date <= getTodayId()) await afterMaterialize(); }
  catch (e) { console.error(e); scheduledError.value = 'Could not update the date.'; }
};
const deleteScheduled = async (id) => {
  if (!userId.value || !confirm('Delete this scheduled task?')) return;
  try { scheduledList.value = await mutateScheduled(userId.value, (l) => removeScheduled(l, id)); }
  catch (e) { console.error(e); scheduledError.value = 'Could not delete the task.'; }
};

const addNewTask = async () => {
  if (!userId.value) {
    error.value = 'You must be logged in to add a task';
    return false;
  }

  if (newTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return false;
  }

  limitHit.value = null;
  try {
    if (!(await dailyLimitGate(newTask.value.scheduleDate || getTodayId()))) {
      const l = limitHit.value;
      error.value = l.pro ? `Daily limit reached: ${l.limit} tasks per day on Pro.` : `Daily limit reached: free accounts can add ${l.limit} tasks per day.`;
      return false;
    }
  } catch (e) { console.error('limit check', e); error.value = 'Could not check your daily task limit, try again.'; return false; }

  // Scheduled-for-later tasks go to their own doc and do not count toward today's cap.
  if (newTask.value.scheduleDate) { await submitScheduledTask(); return true; }

  if (isCapBlocked()) return false;

  if (addsToToday()) {
    const gate = canAddTask(selectedDayRoutine.value, newTask.value, strictOn.value);
    if (!gate.ok) { error.value = `${gate.message} (High-priority tasks are still allowed.)`; return false; }
  }

  if (selectedDayIndex.value < 0 || !days[selectedDayIndex.value]) { error.value = 'Still loading your week, try again in a moment'; return false; }

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
    status: newTask.value.status || 'todo',
    pendingOn: newTask.value.status === 'pending' ? (newTask.value.pendingOn || '').trim() : '',
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

  // Optimistic: show the task and close the modal right away, persist in the background, roll back on failure.
  const position = parseInt(newTask.value.position, 10);
  const copyFor = (selectedDay) => {
    const dayIdx = days.findIndex((d) => d.day === selectedDay.day);
    const activeFrom = newTask.value.selectedDays.length > 0 && task.type === 'recurring' && dayIdx !== selectedDayIndex.value && dayIdx >= 0 ? activeFromForDay(dayIdx) : '';
    return activeFrom ? { ...task, activeFrom } : { ...task };
  };
  const insertAt = (list, copy) => { const l = [...list]; l.splice(Number.isNaN(position) ? l.length : position, 0, copy); return l; };
  const viewDay = days[selectedDayIndex.value].day;
  const key = taskKey(task);
  if (selectedDays.some((d) => d.day === viewDay)) selectedDayRoutine.value = insertAt(selectedDayRoutine.value || [], copyFor({ day: viewDay }));
  if (gateCache) gateCache.extra.push(task);
  const hadReminder = !!task.reminder;
  newTask.value = blankTask();
  capWarning.value = false; capOverride.value = false;
  closeModal();
  error.value = '';
  lastAddPersist = (async () => {
    try {
      await Promise.all(selectedDays.map((d) => mutateDay(d.day, (l) => (l.some((t) => taskKey(t) === key) ? l : insertAt(l, copyFor(d))))));
    } catch (e) {
      console.error('Error adding task:', e);
      selectedDayRoutine.value = (selectedDayRoutine.value || []).filter((t) => taskKey(t) !== key);
      if (gateCache) gateCache.extra = gateCache.extra.filter((t) => taskKey(t) !== key);
      error.value = `Could not save “${task.title}”. Please try again.`;
      alert(error.value);
      return false;
    }
    try { if (hadReminder) await scheduleNotification(task, task.reminder); } catch (e) { console.error(e); }
    fetchUserName(userId.value).then((n) => n && sendNotificationToPlayer(n, 'created')).catch(() => {});
    return true;
  })();
  return true;
};
let lastAddPersist = Promise.resolve(true);

// Repeat control on task cards: keep one copy of the task (same createdAt+title) on every chosen weekday.
// Copies keep the original createdAt, so making a task recurring never counts as a new task toward the daily limit.
const setTaskRepeat = async (task, dayNames) => {
  if (!userId.value || !task) return;
  const viewDay = days[selectedDayIndex.value].day;
  const want = new Set(dayNames && dayNames.length ? dayNames : [viewDay]);
  want.add(viewDay); // the card being edited stays where it is
  const recurring = want.size > 1;
  const key = taskKey(task);
  const prev = { type: task.type, repeatDays: task.repeatDays };
  const patch = { type: recurring ? 'recurring' : (task.type === 'recurring' ? 'one-time' : task.type || 'one-time'), repeatDays: recurring ? [...want] : [] };
  Object.assign(task, patch);
  selectedDayRoutine.value = [...selectedDayRoutine.value];
  try {
    await Promise.all(days.map((d, i) => mutateDay(d.day, (l) => {
      const has = l.some((t) => taskKey(t) === key);
      if (!want.has(d.day)) return has ? l.filter((t) => taskKey(t) !== key) : l;
      if (has) return l.map((t) => (taskKey(t) === key ? { ...t, ...patch } : t));
      const af = i !== selectedDayIndex.value ? activeFromForDay(i) : '';
      const { timerActive, timerEnd, timerStart, boss, ...base } = task;
      return [...l, { ...base, ...patch, completed: false, completedAt: null, status: base.status === 'done' ? 'todo' : base.status, activeFrom: af }];
    })));
  } catch (e) {
    console.error('repeat', e); Object.assign(task, prev); selectedDayRoutine.value = [...selectedDayRoutine.value];
    alert('Could not update the repeat setting. Please try again.');
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

// Credits are paid currency: only the server (Stripe webhook / AI function) changes them now.
// Task-completion +10/-10 stays a local display value and is no longer written to users/{uid}.
const updateCreditsInFirestore = async () => {
  /* intentionally no client write (blocked by firestore.rules.tight) */
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
const bestStreak = ref(0);
const streakProgress = ref(0); // distinct non-pending tasks completed today
const streakStatus = ref('none'); // none | done | at-risk | broken
const userSettingsStreakGap = ref(ALLOWED_GAP_DAYS); // allowed days between counted days (1 = no skips)
const unlockedBadges = ref([]);
const motivationalMessage = ref('');
// Always an array: day switches / failed loads can hand back undefined, and many consumers read .length/.filter.
const selectedDayRoutineRaw = ref([]);
const selectedDayRoutine = computed({
  get: () => (Array.isArray(selectedDayRoutineRaw.value) ? selectedDayRoutineRaw.value : []),
  set: (v) => { selectedDayRoutineRaw.value = Array.isArray(v) ? v : []; },
});
const timeStats = computed(() => computeTimeStats(daySession.value, selectedDayRoutine.value, wontDoTasks.value.length));
// Reactive calendar clock: "today" (index, days left, headings) re-evaluates at midnight, on tab focus and on visibility change.
const calendarNow = ref(Date.now());
const refreshCalendar = () => { calendarNow.value = Date.now(); };
let calendarTimer = null;
onMounted(() => {
  calendarTimer = setInterval(refreshCalendar, 30000);
  document.addEventListener('visibilitychange', refreshCalendar);
  window.addEventListener('focus', refreshCalendar);
});
onBeforeUnmount(() => {
  clearInterval(calendarTimer);
  document.removeEventListener('visibilitychange', refreshCalendar);
  window.removeEventListener('focus', refreshCalendar);
});
const todayIdx = computed(() => new Date(calendarNow.value).getDay());
const calculateCompletionPercentage = () => completionPercentage(selectedDayRoutine.value, wontDoTasks.value.length, selectedDayIndex.value, todayIdx.value);
const daysLeftInYear = computed(() => daysLeftInYearFrom(new Date(calendarNow.value)));
const heroTitle = computed(() => heroTitleFor(selectedDayIndex.value, todayIdx.value));
// "Make today count." -> lead "Make today " + accent "count." (last word in the accent colour)
const heroTitleParts = computed(() => { const t = heroTitle.value || ''; const i = t.lastIndexOf(' '); return i < 0 ? { lead: '', accent: t } : { lead: t.slice(0, i + 1), accent: t.slice(i + 1) }; });
const upNextKey = computed(() => { const t = displayTasks.value.find((x) => !x.completed && x.status !== 'pending'); return t ? taskKey(t) : null; });
const showNotification = ref(false);


// Function to get the icon for the current streak day


// Function to get the icon based on the current streak



// Evaluate streak for today: resets to 0 only after a full calendar day without a completion.
const checkStreakOnCompletion = async () => {
  if (!userId.value) return;
  try {
    const streakDocRef = doc(db, 'streaks', userId.value);
    const snap = await getDoc(streakDocRef);
    if (!snap.exists()) { streakStatus.value = 'none'; return; }
    const data = snap.data();
    unlockedBadges.value = data.unlockedBadges || [];
    let ev = evaluateStreak(data, localDateStr(), streakGap());
    // Earned streak freeze (7-day milestone) covers exactly one missed day.
    if (ev.status === 'broken' && data.streak && data.lastCompletionDate && dayDiff(data.lastCompletionDate, localDateStr()) === streakGap() + 1) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (await tryFreeze(userId.value, data, [localDateStr(y)], rewardsFor(data.bestStreak || 0).freezes)) {
        ev = evaluateStreak({ ...data, lastCompletionDate: localDateStr(y) }, localDateStr(), streakGap());
      }
    }
    const { status, progress, min, ...st } = ev; // eslint-disable-line no-unused-vars
    if (ev.status === 'broken' && data.streak) await setDoc(streakDocRef, { ...st, updatedAt: serverTimestamp() }, { merge: true });
    else if ((data.bestStreak || 0) < ev.bestStreak) await setDoc(streakDocRef, { bestStreak: ev.bestStreak }, { merge: true });
    applyStreakState(st);
    updateMotivationalMessage();
  } catch (error) {
    console.error('Error updating streak:', error);
  }
};

// (legacy, not scheduled) old midnight reducer kept for reference
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
  if (!userId.value) return;
  try { const c = JSON.parse(localStorage.getItem(`streakCache_${userId.value}`) || 'null'); if (c) applyStreakState(c); } catch (e) { /* ignore */ }
  await checkStreakOnCompletion();
};

const updateStreakInFirestore = async () => {
  if (!userId.value) return;

  const streakDocRef = doc(db, 'streaks', userId.value);

  try {
    await setDoc(streakDocRef, {
      unlockedBadges: unlockedBadges.value,
      updatedAt: serverTimestamp()
    }, { merge: true });
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
  } else if (streak.value >= 1) {
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
const menuOpen = ref(false); // closed by default; closes on outside tap / Escape / route change
const heroMenuEl = ref(null);
const noticeCount = computed(() => {
  const boss = strictOn.value && !bossHidden.value && (bossLines.value.length || verdictScreen.value);
  return (boss ? 1 : 0) + (disciplineWarning.value && !boss ? 1 : 0) + (morningRecap.value && isViewingToday.value ? 1 : 0);
});
// Home overlays the shared top bar on the header illustration (see .home-v2 rules)
onMounted(() => document.body.classList.add('home-v2'));
onBeforeUnmount(() => document.body.classList.remove('home-v2'));
// Closing tap is swallowed so it doesn't also trigger whatever sits under the panel (e.g. the Add Task FAB).
const swallowClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
const onMenuOutside = (e) => {
  if (!(menuOpen.value && heroMenuEl.value && !heroMenuEl.value.contains(e.target))) return;
  menuOpen.value = false;
  document.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', swallowClick, true), 400);
};
const onMenuKey = (e) => { if (e.key === 'Escape') menuOpen.value = false; };
onMounted(() => { document.addEventListener('pointerdown', onMenuOutside, true); document.addEventListener('keydown', onMenuKey); });
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onMenuOutside, true); document.removeEventListener('keydown', onMenuKey); });
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
  return dayTasks.value.filter(task => task.completed).length;
});
const listening = ref(false);
const voiceOpen = ref(false); // modal visibility (independent of whether recognition actually started)
const voiceError = ref('');
let recognition = null;
let pendingVoiceText = '';
let voiceSubmitting = false;
const liveTranscript = ref('');
const voiceCap = typeof window !== 'undefined' ? voiceCapability(window, navigator) : 'none';
const voiceSupported = voiceCap !== 'none';
// Initialize SpeechRecognition only if supported (every property access stays inside this guard)
if (voiceSupported) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => { listening.value = true; voiceError.value = ''; };
  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    listening.value = false;
    if (event.error === 'aborted') return; // we stopped it ourselves (cancel / restart): not a failure
    voiceError.value = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
      : event.error === 'no-speech' ? "Didn't catch anything. Try again."
      : 'Voice input failed (' + (event.error || 'unknown') + ').';
  };
  recognition.continuous = voiceCap !== 'partial'; // hands-free: keep listening across pauses (Chrome/Edge)
  recognition.onend = () => {
    listening.value = false;
    // iOS Safari often ends without flagging a result final: use what we heard instead of dropping it.
    if (voiceOpen.value && !voiceError.value && pendingVoiceText.trim()) saveSpoken(pendingVoiceText);
    // Hands-free: restart after each pause until the user taps Stop (iOS ends after every utterance).
    if (voiceOpen.value && !voiceError.value && voiceSupported) setTimeout(() => { if (voiceOpen.value && !listening.value) { try { recognition.start(); } catch (e) { /* still stopping */ } } }, 250);
  };
  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const r = event.results[i];
      if (r.isFinal) saveSpoken(r[0].transcript); // a pause ends a phrase: save it right away
      else interim += r[0].transcript;
    }
    liveTranscript.value = interim.trim();
    pendingVoiceText = interim.trim();
  };
} else {
  console.warn("Speech recognition not supported in this browser.");
}
// Hands-free capture: every finished phrase is split ("and then" / "next") and each part saved immediately, with a 5 s undo.
const voiceAdded = ref([]); // [{ id, title, createdAt, dayName, undoUntil }]
const voiceQueue = [];
const saveSpoken = (text) => {
  pendingVoiceText = '';
  liveTranscript.value = '';
  splitSpokenTasks(text).forEach((t) => voiceQueue.push(t));
  drainVoiceQueue();
};
const drainVoiceQueue = async () => {
  if (voiceSubmitting) return;
  voiceSubmitting = true;
  try {
    while (voiceQueue.length) {
      const title = voiceQueue.shift();
      if (!userId.value) { voiceError.value = 'Sign in to add tasks by voice.'; voiceQueue.length = 0; break; }
      newTask.value = { ...blankTask(), title };
      capOverride.value = true; // hands-free never stops on the active-task cap warning
      const ok = await addNewTask() && (await lastAddPersist);
      capOverride.value = false;
      if (!ok) { voiceError.value = error.value || 'Could not add the task.'; continue; }
      const saved = [...(selectedDayRoutine.value || [])].filter((x) => x.title === title).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))[0];
      const entry = { id: `${Date.now()}-${Math.random()}`, title, createdAt: saved?.createdAt, dayName: days[selectedDayIndex.value]?.day, undoUntil: Date.now() + UNDO_MS };
      voiceAdded.value = [...voiceAdded.value, entry];
      setTimeout(() => { voiceAdded.value = voiceAdded.value.map((e) => (e.id === entry.id ? { ...e, undoUntil: 0 } : e)); }, UNDO_MS);
    }
  } catch (e) {
    console.error('Voice task failed:', e);
    voiceError.value = 'Could not add the task. Please try again.';
  } finally { voiceSubmitting = false; }
};
const undoVoiceTask = async (entry) => {
  if (!entry?.createdAt || !entry.dayName || !userId.value) return;
  const key = `${entry.createdAt}|${entry.title}`;
  await lastAddPersist;
  try {
    const ref_ = doc(db, 'weeklyRoutines', `${userId.value}_${entry.dayName}`);
    const cur = (await getDoc(ref_)).data()?.tasks || [];
    await updateDoc(ref_, { tasks: cur.filter((t) => taskKey(t) !== key), updatedAt: serverTimestamp() });
    selectedDayRoutine.value = (selectedDayRoutine.value || []).filter((t) => taskKey(t) !== key);
    voiceAdded.value = voiceAdded.value.filter((e) => e.id !== entry.id);
  } catch (e) { console.error('Undo failed:', e); }
};
const cancelVoiceInput = () => {
  if (recognition) { try { recognition.stop(); } catch (e) { /* not started */ } }
  listening.value = false;
  voiceOpen.value = false;
  voiceError.value = '';
  liveTranscript.value = '';
  pendingVoiceText = '';
  voiceAdded.value = voiceAdded.value.filter((e) => e.undoUntil > Date.now()); // keep live undo chips as toasts
};

const startVoiceInput = () => {
  voiceAdded.value = [];
  voiceOpen.value = true; // always show the modal, even when recognition is unavailable
  liveTranscript.value = '';
  voiceError.value = '';
  pendingVoiceText = '';
  if (!recognition) return;
  try { recognition.start(); }
  catch (e) {
    if (e && e.name === 'InvalidStateError') {
      // A previous session is still winding down (common on iOS): abort it and retry shortly instead of showing a dead "Listening..."
      try { recognition.abort(); } catch (e2) { /* ignore */ }
      setTimeout(() => {
        if (!voiceOpen.value) return;
        try { recognition.start(); } catch (e3) { voiceError.value = 'Could not start voice input. Close this and try again.'; }
      }, 300);
    } else voiceError.value = 'Could not start voice input.';
  }
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

  const streakGained = streakProgress.value >= DAILY_STREAK_MIN; // distinct non-pending tasks completed today (one-time tasks leave the list once done)

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


const openWorkoutModal = async () => {
  if (!(await requirePro(_proRouter, 'aiCoach'))) return;
  showWorkoutModal.value = true;
};const closeWorkoutModal = () => {
  showWorkoutModal.value = false;
};

const generateWorkoutRoutine = async () => {
  if (!(await requirePro(_proRouter, 'aiCoach'))) { closeWorkoutModal(); return; }
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

  const prompt = `Create a ${workoutPreferences.daysPerWeek}-day workout routine for someone who wants to train with: ${equipmentDetails}.
Goal: ${workoutPreferences.goal}, Duration: ${workoutPreferences.duration} minutes, Fitness Level: ${workoutPreferences.fitnessLevel}, Focus: ${workoutPreferences.focusArea}, Intensity: ${workoutPreferences.intensity}, Style: ${workoutPreferences.style || 'any'}.
Limit to a maximum of ${workoutPreferences.maxPerDay} workouts per day.
Return in JSON format like:
{
  "Mon": [{ "title": "...", "youtubeURL": "...", "type": "recurring", "completed": false }],
  ...
}`;

  try {
    const response = await askAi('workout', { ...workoutPreferences }); // prompt is built server-side
    const result = JSON.parse(response.content);
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

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isDraggingTask = ref(false);
const onDragStart = () => {
  isDraggingTask.value = true;
  const sel = window.getSelection && window.getSelection();
  if (sel && sel.removeAllRanges) sel.removeAllRanges();
  playSound('dragStart');
};
const todayDayName = () => days[new Date().getDay()].day;
const isViewingToday = computed(() => selectedDayIndex.value === todayIdx.value);

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
watch(modalOpen, (open) => { if (!open) { capWarning.value = false; capOverride.value = false; limitHit.value = null; } });

// Load summary + schedule
const todayLoad = computed(() => loadSummary(selectedDayRoutine.value));
const schedule = computed(() => buildSchedule(selectedDayRoutine.value));
const showSchedule = ref(false);

// Inline expand (tap card) + inline field editing, saved with the task
const expandedKey = ref(null);
const toggleExpanded = (task) => {
  expandedKey.value = expandedKey.value === taskKey(task) ? null : taskKey(task);
};
const patchTask = async (index, task, patch) => {
  if (patch.status === 'pending' && !task.pendingSince) patch = { ...patch, pendingSince: new Date().toISOString() }; // wait time for the morning report
  try {
    const before = { createdAt: task.createdAt, title: task.title }; // stored identity before this edit
    const dayName = days[selectedDayIndex.value].day;
    Object.assign(task, patch);
    if (patch.estimateMin !== undefined) task.estimateMin = Number(patch.estimateMin) || 0;
    const saved = patch.estimateMin !== undefined ? { ...patch, estimateMin: task.estimateMin } : patch;
    await patchStoredTask(userId.value, dayName, before, index, saved);
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
    shutdownOpenTasks.value = tasks.filter((t) => !t.completed && t.status !== 'pending'); // pending: no carry/nag
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
        await carryTasksToDay(userId.value, todayDayName(), tomorrow, strictOn.value ? picked.map(carryTask) : picked, getTodayId());
      }
    }
    try { await saveDailyPerformance(); } catch (e) { console.error(e); }
    shutdownOpen.value = false;
    shutdownDismissed.value = true;
    if (daySession.value.started && !daySession.value.ended) await endDay(); // existing End Day logic
    else if (!daySession.value.ended && userId.value) { // wrapped up without pressing Start Day: still mark today done
      const now = new Date();
      await setDoc(doc(db, 'userSettings', userId.value), { daySessions: { [getTodayId()]: { ended: true, endTime: serverTimestamp(), updatedAt: serverTimestamp() } } }, { merge: true });
      daySession.value = { ...daySession.value, ended: true, endTime: now, endedAtText: formatSessionTime(now) };
    }
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
  50% {
    transform: scale(1.2);
  }
}

@keyframes spin {
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
  50% {
    transform: scale(1.1);
  }
}

@keyframes pulseWave {
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
  50% {
    transform: scale(1.05);
    opacity: 0.85;
  }
}

.animate-pulse-slow {
  animation: pulseSlow 2s infinite;
}

@keyframes spinSlow {
}

.animate-spin-slow {
  display: inline-block;
  animation: spinSlow 2s linear infinite;
}
/* ── Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Root ── */
.app-root {
  /* ── Design tokens (dark, Atlassian-style neutrals + blue accent) ── */
  --c-bg: #0B0D12;
  --c-surface: #12151C;
  --c-surface-2: #1A1E28;
  --c-border: #252B38;
  --c-border-strong: #3A4256;
  --c-text: #EEF1F7;
  --c-text-2: #B4BCCB;
  --c-text-3: #8791A5;
  --c-accent: #4F6FF0;
  --c-accent-hover: #3F5DDB;
  --c-accent-text: #8FA8FF;
  --c-accent-soft: #19224A;
  --c-accent-line: #34478F;
  --c-on-accent: #FFFFFF;
  --c-success: #3DDC97;
  --c-success-soft: #10261D;
  --c-success-line: #1E6B4A;
  --c-warn: #F5B83D;
  --c-warn-text: #F5C75F;
  --c-warn-soft: #2B2209;
  --c-warn-line: #7A5A12;
  --c-danger: #F87171;
  --c-danger-text: #FCA5A5;
  --c-danger-soft: #2E1517;
  --c-danger-line: #8F2A2A;
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px;
  --r: 10px; --r-lg: 16px; --r-pill: 999px;
  --shadow-1: 0 1px 0 rgba(255,255,255,.03) inset, 0 1px 2px rgba(0,0,0,.4);
  --shadow-2: 0 1px 0 rgba(255,255,255,.04) inset, 0 2px 4px rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.45);
  --ease-out: cubic-bezier(.22,1,.36,1);
  --fs-xs: 11px; --fs-sm: 12px; --fs-md: 14px; --fs-lg: 16px; --fs-xl: 20px; --fs-2xl: 32px;
  --ring: 0 0 0 2px var(--c-accent-text);
  --font: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  min-height: 100vh;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font);
  font-size: var(--fs-md);
  line-height: 20px;
  padding-bottom: 130px;
}
.app-root button, .app-root input, .app-root select, .app-root textarea { font-family: inherit; }
.app-root * { transition-timing-function: ease; }

.content-wrap {
  max-width: 540px;
  margin: 0 auto;
  padding: 1rem 1rem 2rem;
}

/* ── Splash ── */
.splash-screen {
  position: fixed;
  inset: 0;
  background: var(--c-bg, #0f0f11);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.splash-inner { text-align: center; }
.splash-logo {
  font-size: 3rem;
  color: var(--c-warn, #F59E0B);
  margin-bottom: 1rem;
  animation: pulse 1.5s ease infinite;
}
.splash-title { font-size: 1.6rem; font-weight: 600; color: var(--c-text, #e8e6e1); margin: 0; }
.splash-sub { color: var(--c-text-3, #6b6a66); font-size: 0.9rem; margin: 0.5rem 0 1.5rem; }
.splash-loader { width: 180px; height: 2px; background: var(--c-border, #2a2a2e); border-radius: var(--r, 3px); margin: 0 auto; overflow: hidden; }
.splash-bar { height: 100%; background: var(--c-warn, #F59E0B); animation: load 2s ease infinite; }
@keyframes load { 50% { width: 80%; } }
@keyframes pulse { 50% { opacity: 0.5; } }

/* ── Header ── */
.btn-start { background: var(--c-success-soft, #14432a); color: var(--c-success, #4ade80); }

/* ── Calendar ── */
.calendar-section {
  background: var(--c-surface, #18181b);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
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
  background: var(--c-surface-2, #1e1e22);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 3px 8px;
  color: var(--c-danger, #ef4444);
}

/* ── Progress ── */

/* ── Modals ── */

/* ── Form fields ── */
.field-group--row { display: flex; align-items: center; justify-content: space-between; }

/* ── Buttons ── */

.toggle-btn {
  background: var(--c-surface-2, #1e1e22);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 6px 12px;
  color: var(--c-text-3, #6b6a66);
  cursor: pointer;
  transition: all 0.2s;
}
.toggle-btn--on { background: var(--c-accent-soft, #1e2a3a); border-color: var(--c-accent, #378ADD); color: var(--c-accent-text, #7fb8f5); }

/* ── Advanced / fade transition ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Task Detail ── */

/* ── Labels ── */

/* ── Fullscreen celebration ── */
@keyframes pop { }

/* ── Image Preview ── */

/* ── Voice ── */
@keyframes waveUp { }

/* ── Task List ── */
.task-section { }

.tasks-list { display: flex; flex-direction: column; gap: 8px; }
.task-ghost { opacity: 0.3; background: var(--c-border, #2a2a2e) !important; }
.task-dragging { transform: rotate(1.5deg); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }

/* ── Task Card ── */
.task-title {
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--c-text, #e8e6e1);
  transition: color 0.15s;
}
.task-title:hover { color: var(--c-accent-text, #7fb8f5); }
.task-status--pending { background: var(--c-warn-soft, #2a2a12); color: var(--c-warn-text, #ca8a04); border: 1px solid var(--c-warn-line, #3a3a1a); }

/* ── Idle State ── */

/* ── Won't Do ── */

/* ── FAB ── */
@keyframes ping { }
.time-summary-card {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 16px;
  margin: 16px 0;
  border-radius: var(--r, 3px);
  background: var(--c-surface, #111827);
  color: white;
}

.time-summary-card div {
  background: rgba(255,255,255,0.08);
  padding: 12px;
  border-radius: var(--r, 3px);
  text-align: center;
}

.time-summary-card span {
  display: block;
  font-size: 12px;
  color: var(--c-text-2, #9ca3af);
}

.time-summary-card strong {
  font-size: 18px;
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
  border-radius: var(--r, 3px);
  padding: 10px;
}

/* ── Planning / polish additions ── */
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--c-accent-text); outline-offset: 1px;
}
.cap-warning { background: var(--c-warn-soft, #3a2d0a); border: 1px solid var(--c-warn-line, #92400e); color: var(--c-warn-text, #fde68a); border-radius: var(--r, 3px); padding: 0.75rem; font-size: 0.82rem; line-height: 1.5; margin-top: 0.75rem; }

/* ── Jira-style layout polish ── */
.calendar-section { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); box-shadow: var(--shadow-1); padding: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-4); }
.current-date-label { font-size: var(--fs-lg); font-weight: 600; }
.days-left-badge { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; background: var(--c-danger-soft); border: 1px solid var(--c-danger-line); border-radius: var(--r); padding: 0 6px; line-height: 18px; color: var(--c-danger-text); }
.tasks-list { gap: var(--sp-1); }
.toggle-btn { border-radius: var(--r); font-size: var(--fs-md); }
.btn-start { background: var(--c-success-soft); color: var(--c-success); }
.cap-warning { border-radius: var(--r); font-size: var(--fs-sm); }
.time-summary-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); gap: var(--sp-2); padding: var(--sp-3); margin: var(--sp-3) 0; }
.time-summary-card div { background: var(--c-surface-2); border-radius: var(--r); padding: var(--sp-2); }
.time-summary-card span { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); }
.time-summary-card strong { font-size: var(--fs-lg); }
.splash-logo, .splash-bar { color: var(--c-accent-text); }
.splash-bar { background: var(--c-accent); }
@media (max-width: 600px) { .content-wrap { padding: var(--sp-3) var(--sp-2) var(--sp-5); } .time-summary-card { grid-template-columns: repeat(2, 1fr); } }


/* ── Mobile-first dark redesign ── */
.app-root { -webkit-tap-highlight-color: transparent; }
.content-wrap { padding: var(--sp-5) var(--sp-4) var(--sp-5); }
.calendar-section { background: none; border: none; box-shadow: none; padding: 0; margin-bottom: var(--sp-3); }
.hero { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
.hero-text { min-width: 0; }
.hero-date { margin: 0 0 var(--sp-2); font-family: 'JetBrains Mono', monospace; font-size: var(--fs-xs); letter-spacing: .08em; text-transform: uppercase; color: var(--c-text-3); }
.hero-title { margin: 0; font-size: var(--fs-2xl); line-height: 1.1; font-weight: 800; letter-spacing: -.02em; color: var(--c-text); }
.hero-sub { margin: var(--sp-2) 0 0; font-size: var(--fs-md); color: var(--c-text-2); }
.hero-menu { position: relative; flex-shrink: 0; }
.hero-menu-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--c-surface-2); border: 1px solid var(--c-border-strong); color: var(--c-text); cursor: pointer; font-size: var(--fs-lg); }
.hero-menu-btn:hover { background: var(--c-border); }
.hero-menu-pop { position: absolute; right: 0; top: 52px; z-index: 30; min-width: 190px; padding: var(--sp-1); background: var(--c-surface-2); border: 1px solid var(--c-border-strong); border-radius: var(--r-lg); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.hero-menu-item { display: block; width: 100%; min-height: 40px; text-align: left; padding: 0 var(--sp-3); background: none; border: none; border-radius: var(--r); color: var(--c-text); font-size: var(--fs-md); cursor: pointer; }
.hero-menu-item:hover { background: var(--c-border); }
a.hero-menu-item { display: block; text-decoration: none; color: inherit; }
.tasks-list { gap: var(--sp-2); }
.cap-warning, .load-summary { border-radius: var(--r-lg); }
@media (min-width: 700px) { .content-wrap { padding-top: 40px; } .hero-title { font-size: 40px; } }
</style>




<style>
/* Respect the OS "reduce motion" setting: no transitions or animations anywhere in the app. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; animation-delay: 0s !important; transition-duration: 0.001ms !important; transition-delay: 0s !important; scroll-behavior: auto !important; }
}
.filter-empty { text-align: center; color: var(--c-text-3, #6b6a66); font-size: 0.875rem; padding: 1.5rem 0; margin: 0; }
/* Dark scrollbars for the home view and its modals (unscoped: modal boxes live in child components). */
.app-root, .app-root * { scrollbar-width: thin; scrollbar-color: var(--c-border-strong, #454f59) var(--c-surface, #22272b); }
.app-root *::-webkit-scrollbar { width: 10px; height: 10px; }
.app-root *::-webkit-scrollbar-track { background: var(--c-surface, #22272b); }
.app-root *::-webkit-scrollbar-thumb { background: var(--c-border-strong, #454f59); border-radius: 6px; border: 2px solid var(--c-surface, #22272b); }
.app-root *::-webkit-scrollbar-thumb:hover { background: var(--c-text-3, #8c9bab); }
.app-root *::-webkit-scrollbar-corner { background: var(--c-surface, #22272b); }
.app-root { color-scheme: dark; }

/* Bottom padding so the floating Add bar (~88px + safe area) never covers the last rows */
.app-root .content-wrap { padding-bottom: calc(140px + env(safe-area-inset-bottom)); }
/* No text-selection highlight while dragging a card; inputs/editors stay selectable */
.app-root.is-dragging, .app-root.is-dragging * { user-select: none; -webkit-user-select: none; }
.app-root.is-dragging input, .app-root.is-dragging textarea { user-select: text; -webkit-user-select: text; }

/* ── Premium polish layer (doubled class selectors win over scoped child rules) ── */
.app-root { background: radial-gradient(120% 60% at 50% -10%, rgba(79,111,240,.10), transparent 60%), var(--c-bg); font-feature-settings: 'cv11', 'ss01'; -webkit-font-smoothing: antialiased; }
.app-root .hero-title { background: linear-gradient(180deg, #fff, #C9D2EA); -webkit-background-clip: text; background-clip: text; color: transparent; }
.app-root .hero-date { color: var(--c-text-3); }
.app-root .hero-menu-btn { box-shadow: var(--shadow-1); transition: background .2s var(--ease-out), transform .2s var(--ease-out); }
.app-root .hero-menu-btn:hover { transform: translateY(-1px); }
.app-root .hero-menu-btn:active { transform: scale(.94); }
.app-root .hero-menu-pop { box-shadow: var(--shadow-2); animation: popIn .18s var(--ease-out); transform-origin: top right; }
.app-root .hero-menu-item { min-height: 44px; }
.app-root .hero-menu-item:active { background: var(--c-border-strong); }
@keyframes popIn { from { opacity: 0; transform: translateY(-4px) scale(.97); } }
@keyframes riseIn { from { opacity: 0; transform: translateY(6px); } }
.app-root .tasks-list > * { animation: riseIn .35s var(--ease-out) backwards; }

/* Week strip */
.app-root .day-tabs.day-tabs { gap: 6px; padding: 6px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: calc(var(--r-lg) + 4px); box-shadow: var(--shadow-1); margin: var(--sp-4) 0; }
.app-root .day-tab.day-tab { min-height: 56px; border-radius: 14px; transition: background .2s var(--ease-out), color .2s, transform .15s; }
.app-root .day-tab.day-tab:active { transform: scale(.95); }
.app-root .day-tab--selected.day-tab--selected, .app-root .day-tab--selected.day-tab--selected:hover { background: linear-gradient(180deg, #5F7EF7, #4563E6); box-shadow: 0 6px 16px rgba(79,111,240,.45), 0 1px 0 rgba(255,255,255,.25) inset; }

/* Progress card */
.app-root .progress-section.progress-section { background: linear-gradient(180deg, var(--c-surface-2), var(--c-surface)); border-color: var(--c-border); border-radius: calc(var(--r-lg) + 4px); box-shadow: var(--shadow-2); padding: var(--sp-5) var(--sp-4); }
.app-root .progress-pct.progress-pct { background: linear-gradient(180deg, #A9BBFF, var(--c-accent)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.app-root .ring-fill.ring-fill { filter: drop-shadow(0 0 6px rgba(79,111,240,.6)); }
.app-root .milestone-dot--reached.milestone-dot--reached { box-shadow: 0 0 0 3px rgba(79,111,240,.15); }

/* Streak + stats */
.app-root .home-notice { margin: var(--sp-3) 0 0; }
.app-root .btn-day.btn-day { min-height: 44px; border-radius: 12px; box-shadow: var(--shadow-1); transition: background .2s var(--ease-out), border-color .2s, transform .15s; }
.app-root .btn-day.btn-day:active { transform: scale(.97); }
.app-root .stats-bar.stats-bar { padding: var(--sp-3) 0; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); box-shadow: var(--shadow-1); }
.app-root .stat-label.stat-label { text-transform: uppercase; letter-spacing: .06em; font-size: 10px; font-weight: 600; }
.app-root .stat-val.stat-val { font-size: var(--fs-xl); letter-spacing: -.01em; margin-top: 4px; }

/* Task list + rows */
.app-root .task-count-label.task-count-label { font-size: 26px; line-height: 32px; letter-spacing: -.02em; }
.app-root .task-count-badge.task-count-badge { border: 1px solid var(--c-accent-line); }
.app-root .toggle-visibility.toggle-visibility { min-width: 44px; min-height: 44px; }
.app-root .sort-menu.sort-menu { box-shadow: var(--shadow-2); border-color: var(--c-border-strong); border-radius: var(--r-lg); animation: popIn .18s var(--ease-out); transform-origin: top right; }
.app-root .sort-select.sort-select { min-height: 44px; border-radius: var(--r); }
.app-root .task-card.task-card { padding: 10px var(--sp-3) 10px var(--sp-2); border-radius: 18px; background: linear-gradient(180deg, var(--c-surface-2), var(--c-surface)); box-shadow: var(--shadow-1); transition: transform .2s var(--ease-out), border-color .2s, box-shadow .2s, background .2s; }
.app-root .task-card.task-card:hover { border-color: var(--c-border-strong); box-shadow: var(--shadow-2); transform: translateY(-1px); }
.app-root .task-card.task-card:active { transform: scale(.995); }
.app-root .task-title.task-title { font-size: 15px; line-height: 22px; letter-spacing: -.005em; }
.app-root .task-play.task-play::before { box-shadow: 0 4px 12px rgba(79,111,240,.45); transition: background .2s, transform .2s var(--ease-out); }
.app-root .task-play.task-play:hover::before { transform: scale(1.08); }
.app-root .task-play.task-play:active::before { transform: scale(.92); }
.app-root .task-actions.task-actions { box-shadow: var(--shadow-2); animation: popIn .16s var(--ease-out); }
.app-root .coin-badge.coin-badge { border: 1px solid var(--c-warn-line); }

/* Add task bar */
.app-root .fab-group.fab-group { padding-top: var(--sp-5); }
.app-root .fab.fab { height: 56px; border-radius: 18px; letter-spacing: .005em; transition: transform .2s var(--ease-out), background .2s, box-shadow .2s; }
.app-root .fab-add.fab-add { background: linear-gradient(180deg, #5F7EF7, #4563E6); box-shadow: 0 10px 28px rgba(79,111,240,.45), 0 1px 0 rgba(255,255,255,.25) inset; }
.app-root .fab-add.fab-add:hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(79,111,240,.55), 0 1px 0 rgba(255,255,255,.25) inset; }
.app-root .fab-voice.fab-voice { width: 56px; flex-basis: 56px; box-shadow: var(--shadow-2); }

/* Modals, inputs, buttons */
.app-root .modal-backdrop.modal-backdrop { background: rgba(5,7,11,.7); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.app-root .modal-box.modal-box { border-radius: 22px; border-color: var(--c-border-strong); box-shadow: 0 24px 64px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.05) inset; background: linear-gradient(180deg, var(--c-surface-2), var(--c-surface)); animation: sheetIn .28s var(--ease-out); }
@keyframes sheetIn { from { opacity: 0; transform: translateY(14px) scale(.98); } }
.app-root .modal-title.modal-title { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -.01em; }
.app-root .modal-close.modal-close { min-width: 44px; min-height: 44px; border-radius: 50%; }
.app-root .modal-close.modal-close:hover { background: var(--c-border); }
.app-root .field-input.field-input, .app-root .field-select.field-select, .app-root .field-textarea.field-textarea { min-height: 44px; border-radius: 12px; padding: 8px 12px; background: var(--c-bg); border-color: var(--c-border-strong); transition: border-color .2s, box-shadow .2s, background .2s; }
.app-root .field-input.field-input:focus, .app-root .field-select.field-select:focus, .app-root .field-textarea.field-textarea:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(79,111,240,.28); }
.app-root .field-label.field-label { font-size: var(--fs-sm); font-weight: 600; letter-spacing: .02em; color: var(--c-text-2); }
.app-root .btn-primary.btn-primary, .app-root .btn-secondary.btn-secondary { min-height: 44px; height: auto; padding: 0 var(--sp-4); border-radius: 12px; font-weight: 600; transition: background .2s, transform .15s, box-shadow .2s; }
.app-root .btn-primary.btn-primary { background: linear-gradient(180deg, #5F7EF7, #4563E6); box-shadow: 0 4px 14px rgba(79,111,240,.35); }
.app-root .btn-primary.btn-primary:hover { filter: brightness(1.08); }
.app-root .btn-primary.btn-primary:active, .app-root .btn-secondary.btn-secondary:active { transform: scale(.97); }

/* Empty state */
.app-root .empty-state.empty-state { margin: var(--sp-4) 0; padding: var(--sp-5) var(--sp-4) 40px; border: 1px dashed var(--c-border-strong); border-radius: 22px; background: radial-gradient(80% 100% at 50% 0%, rgba(79,111,240,.08), transparent), var(--c-surface); }
.app-root .empty-icon.empty-icon { color: var(--c-accent-text); opacity: .8; }
.app-root .empty-title.empty-title { color: var(--c-text); font-size: var(--fs-xl); font-weight: 700; }
.app-root .empty-sub.empty-sub { color: var(--c-text-2); }
.app-root .empty-add.empty-add { min-height: 48px; background: linear-gradient(180deg, #5F7EF7, #4563E6); box-shadow: 0 6px 18px rgba(79,111,240,.4); }

@media (max-width: 480px) { .app-root .modal-box.modal-box { border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom); } }
.disc-warning { margin: 8px 0; padding: 10px 14px; border-radius: var(--r-lg, 16px); font-weight: 600; background: var(--c-warn-soft, #2B2209); border: 1px solid var(--c-warn-line, #7A5A12); color: var(--c-warn-text, #F5C75F); }
.disc-warning--30m { background: var(--c-danger-soft, #2E1517); border-color: var(--c-danger-line, #8F2A2A); color: var(--c-danger-text, #FCA5A5); animation: discPulse 1.2s ease-in-out infinite; }
@keyframes discPulse { 50% { opacity: .65; } }
.app-root.theme-ember { --c-primary: #ea580c; --c-primary-soft: #ffedd5; --c-warn: #dc2626; }
.app-root.theme-ocean { --c-primary: #0284c7; --c-primary-soft: #e0f2fe; --c-success: #0d9488; }
.voice-toasts { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 9000; display: flex; flex-direction: column; gap: 6px; }
.voice-toast { background: #111827; color: #fff; padding: 8px 12px; border-radius: 10px; font-size: .9rem; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
.voice-toast button { margin-left: 10px; color: #fbbf24; font-weight: 700; background: none; border: none; }

/* ══ v2 skin: navy night theme matching the target mockup (wins via tripled selectors) ══ */
.app-root.app-root.app-root {
  --c-bg: #070D1C; --c-surface: #0C1630; --c-surface-2: #12203F; --c-border: #1A2846; --c-border-strong: #2A3C66;
  --c-text: #F2F5FC; --c-text-2: #A9B4CC; --c-text-3: #7180A0;
  --c-accent: #2F6FFF; --c-accent-hover: #4A82FF; --c-accent-text: #4F95FF; --c-accent-soft: #10204A; --c-accent-line: #24448F;
  --r-lg: 18px;
  background: var(--c-bg);
}
.app-root .content-wrap.content-wrap { max-width: 560px; padding: 0 16px calc(140px + env(safe-area-inset-bottom)); }
.app-root .calendar-section.calendar-section { position: relative; padding-top: 20px; }
.app-root .hero-scene { position: absolute; z-index: 0; top: 0; left: -16px; right: -16px; height: 330px; pointer-events: none;
  background: linear-gradient(180deg, rgba(7,13,28,.25), rgba(7,13,28,0) 40%, var(--c-bg) 96%), url('~@/assets/hero-forest.jpg') 72% 30% / cover no-repeat; }
.app-root .calendar-section > :not(.hero-scene) { position: relative; z-index: 1; }
@media (min-width: 600px) { .app-root .hero-scene { border-radius: 0 0 28px 28px; } }
.app-root .hero.hero { padding: 4px 0 0; }
.app-root .hero-date.hero-date { color: #6FA2FF; font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; font-family: inherit; }
.app-root .hero-title.hero-title { font-size: 34px; line-height: 40px; font-weight: 800; letter-spacing: -.02em; background: none; color: #fff; -webkit-text-fill-color: #fff; margin: 4px 0 2px; }
.app-root .hero-accent { color: #3D8BFF; -webkit-text-fill-color: #3D8BFF; }
.app-root .hero-sub.hero-sub { color: var(--c-text-2); font-size: 15px; }
.app-root .hero-menu-btn.hero-menu-btn { background: rgba(12,22,48,.6); border: 1px solid var(--c-border-strong); backdrop-filter: blur(6px); }
.app-root .hero-menu-meta { color: var(--c-text-3); font-size: 12px; }
/* week strip */
.app-root .day-tabs.day-tabs.day-tabs { gap: 0; padding: 6px; background: rgba(12,22,48,.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--c-border-strong); border-radius: 18px; margin: 18px 0 14px; }
.app-root .day-tab.day-tab.day-tab { min-height: 60px; border-radius: 12px; position: relative; }
.app-root .day-tab.day-tab.day-tab + .day-tab::before { content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; border-left: 1px solid var(--c-border); }
.app-root .day-tab--selected.day-tab--selected.day-tab--selected { background: linear-gradient(180deg, #2F7BFF, #1C5BE8); box-shadow: 0 8px 22px rgba(47,111,255,.45), inset 0 0 0 1px rgba(255,255,255,.18); }
.app-root .day-tab--selected.day-tab--selected.day-tab--selected::before, .app-root .day-tab--selected + .day-tab::before { display: none; }
.app-root .day-tab-name { text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
.app-root .day-tab-date { font-size: 18px; font-weight: 700; }
/* progress card */
.app-root .progress-section.progress-section.progress-section { padding: 0; background: linear-gradient(135deg, rgba(18,32,63,.95), rgba(10,20,44,.95)); border: 1px solid var(--c-border-strong); border-radius: 18px; box-shadow: 0 12px 32px rgba(0,0,0,.35); }
.app-root .progress-pct.progress-pct.progress-pct { background: none; -webkit-text-fill-color: #fff; color: #fff; }
.app-root .ring-fill.ring-fill { filter: none; }
.app-root .stat-val.stat-val.stat-val { white-space: nowrap; }
@media (max-width: 430px) { .app-root .stats-bar .stat-icon { display: none; } .app-root .stats-bar .stat { padding: 4px 6px; } }
/* notices + boss */
.app-root .home-notice.home-notice { margin: 12px 0 0; }
/* Today header */
.app-root .task-list-header.task-list-header { padding: 18px 0 10px; }
.app-root .task-count-label.task-count-label { font-size: 28px; font-weight: 800; }
.app-root .task-count-badge.task-count-badge { background: var(--c-accent-soft); color: #7FB0FF; border: 1px solid var(--c-accent-line); font-family: inherit; padding: 3px 12px; }
.app-root .toggle-visibility.toggle-visibility { width: 44px; min-width: 44px; height: 44px; border-radius: 50%; background: var(--c-surface); border: 1px solid var(--c-border-strong); color: var(--c-text); margin-left: 8px; padding: 0; }
.app-root .toggle-visibility.toggle-visibility:hover { background: var(--c-surface-2); }
/* task rows */
.app-root .tasks-list.tasks-list > * + * { margin-top: 10px; }
.app-root .task-card.task-card.task-card { align-items: center; gap: 10px; padding: 12px 8px 12px 6px; border-radius: 16px; background: linear-gradient(180deg, #0F1B38, #0B1530); border: 1px solid var(--c-border); box-shadow: none; transform: none; }
.app-root .task-card.task-card.task-card:hover { border-color: var(--c-border-strong); }
.app-root .task-card--next.task-card--next.task-card--next { border-color: #2A5BD6; border-left: 3px solid #3D8BFF; background: linear-gradient(90deg, rgba(47,111,255,.18), rgba(15,27,56,.9) 60%); box-shadow: 0 8px 28px rgba(47,111,255,.18); }
.app-root .task-card--important.task-card--important.task-card--important:not(.task-card--next) { border-left: 3px solid var(--c-danger); }
.app-root .task-left.task-left.task-left { gap: 6px; align-items: center; }
.app-root .task-avatar.task-avatar.task-avatar { width: 18px; height: 44px; opacity: .55; font-size: 13px; }
.app-root .task-check.task-check.task-check { width: 36px; height: 36px; margin: 0; font-size: 24px; color: #3A4D78; }
.app-root .task-check--done.task-check--done.task-check--done { color: var(--c-success); }
.app-root .task-cat { width: 40px; height: 40px; flex-shrink: 0; border-radius: 11px; display: grid; place-items: center; font-size: 17px; color: #fff; }
.app-root .task-cat--blue { background: linear-gradient(180deg, #2F7BFF, #1C55D8); }
.app-root .task-cat--purple { background: linear-gradient(180deg, #7B5BE6, #5A3BC2); color: #E4DAFF; }
.app-root .task-cat--teal { background: linear-gradient(180deg, #16A79A, #0D7C74); }
.app-root .task-cat--red { background: linear-gradient(180deg, #A9364A, #7E2335); color: #FFC9D2; }
.app-root .task-cat--green { background: linear-gradient(180deg, #2DB36F, #1C8650); }
.app-root .task-cat--amber { background: linear-gradient(180deg, #E3A12B, #B97A12); }
.app-root .task-upnext { order: 0 !important; margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #5B9BFF; }
.app-root .task-title.task-title.task-title { font-size: 16px; font-weight: 600; color: var(--c-text); }
.app-root .task-sub { order: 2 !important; margin: 0; font-size: 13px; color: var(--c-text-2); }
.app-root .task-body > .task-reminder { order: 3; }
.app-root .task-body > .task-meta-row { order: 4; }
.app-root .task-meta-row:not(:has(.task-status)) .importance-btn:not([aria-pressed="true"]) { display: none; }
.app-root .task-chevron.task-chevron.task-chevron { display: none; }
.app-root .task-play-wrap { display: flex; flex-direction: column; align-items: center; gap: 0; }
.app-root .task-play.task-play.task-play { width: 44px; height: 40px; color: var(--c-text); }
.app-root .task-play.task-play.task-play::before { width: 36px; height: 36px; background: transparent; border: 1.5px solid #3A4D78; box-shadow: none; }
.app-root .task-play--primary.task-play--primary.task-play--primary::before { width: 44px; height: 44px; border: 0; background: linear-gradient(180deg, #3D8BFF, #1F5FEA); box-shadow: 0 6px 18px rgba(47,111,255,.55); }
.app-root .task-pts { font-size: 11px; font-weight: 700; color: #F5C542; line-height: 12px; }
.app-root .task-more.task-more.task-more { width: 36px; color: var(--c-text-2); }
.app-root .task-card--completed.task-card--completed .task-cat { filter: grayscale(.7); opacity: .7; }
/* completed section */
.app-root .done-section { margin-top: 12px; }
.app-root .done-toggle { width: 100%; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 8px; background: none; border: 0; color: var(--c-text-2); font-size: 15px; cursor: pointer; }
.app-root .done-toggle .done-eye { margin-left: auto; color: var(--c-text); }
.app-root .done-toggle:hover { color: var(--c-text); }
/* stats + fab */
.app-root .stats-bar.stats-bar.stats-bar { display: flex; padding: 8px; background: linear-gradient(180deg, #0F1B38, #0B1530); border: 1px solid var(--c-border); border-radius: 16px; }
.app-root .stat-label.stat-label.stat-label { text-transform: none; letter-spacing: 0; font-size: 12px; font-weight: 400; margin: 0; }
.app-root .stat-val.stat-val.stat-val { font-size: 16px; margin: 0; }
.app-root .fab.fab.fab, .app-root .fab.fab.fab span { font-family: var(--font); }
.app-root .fab-add.fab-add.fab-add { background: linear-gradient(90deg, #1E5BFF, #2F7BFF 60%, #3C8CFF); border-radius: 16px; font-size: 18px; font-weight: 700; text-transform: none; box-shadow: 0 10px 30px rgba(47,111,255,.45); }
.app-root .fab-voice.fab-voice.fab-voice { background: #0F1B38; border: 1px solid var(--c-border-strong); border-radius: 16px; color: #fff; }
.app-root .fab-group.fab-group { background: linear-gradient(to top, var(--c-bg) 60%, transparent); }
@media (min-width: 768px) { .app-root .hero-title.hero-title { font-size: 40px; line-height: 46px; } }

/* v2 rows: right controls pinned top-right so details (chips, notes, labels) use the full card width */
.app-root .task-card.task-card.task-card { position: relative; align-items: flex-start; padding: 12px 8px 12px 4px; }
.app-root .task-left.task-left.task-left { align-self: flex-start; gap: 4px; }
.app-root .task-avatar.task-avatar.task-avatar { width: 14px; height: 40px; }
.app-root .task-right.task-right.task-right { position: absolute; top: 10px; right: 6px; margin: 0; }
.app-root .task-body.task-body.task-body { padding-top: 0; }
.app-root .task-body > .task-upnext, .app-root .task-body > .task-title-row, .app-root .task-body > .task-sub { padding-right: 84px; }
.app-root .task-title.task-title.task-title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; line-height: 21px; }
.app-root .task-title-row.task-title-row { flex-wrap: wrap; row-gap: 2px; }
.app-root .task-body > .task-chips.task-chips { flex: 1 1 100%; flex-wrap: wrap; justify-content: flex-start; }
.app-root .task-body > .task-meta-row { flex: 0 0 auto; }
.app-root .task-note-preview, .app-root .task-next, .app-root .task-reminder { font-size: 12px; color: var(--c-text-2); }
.app-root .task-labels.task-labels { display: flex; flex-wrap: wrap; gap: 4px; }
@media (max-width: 400px) {
  .app-root .task-cat { width: 34px; height: 34px; font-size: 15px; border-radius: 10px; }
  .app-root .task-check.task-check.task-check { width: 30px; height: 34px; font-size: 22px; }
  .app-root .task-more.task-more.task-more { width: 28px; }
  .app-root .task-body > .task-upnext, .app-root .task-body > .task-title-row, .app-root .task-body > .task-sub { padding-right: 76px; }
}

/* Header menu must sit above the week strip / cards (they create their own stacking contexts) */
.app-root .calendar-section > .hero.hero { z-index: 50; }
.app-root .hero-menu-pop.hero-menu-pop { z-index: 1000; background: #13203F; border: 1px solid var(--c-border-strong); box-shadow: 0 16px 40px rgba(0,0,0,.65); backdrop-filter: none; }
.app-root .hero-menu-item.hero-menu-item { color: var(--c-text); background: transparent; }
.app-root .hero-menu-item.hero-menu-item:hover { background: #1A2A52; }
/* Room for the fixed Add Task bar + iOS home indicator so the last rows / empty state stay visible */
.app-root .content-wrap.content-wrap { padding-bottom: calc(170px + env(safe-area-inset-bottom)); }
.app-root .fab-group.fab-group { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }

/* ══ v3: pixel-close mockup layout ══ */
body.home-v2 .app-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 60; background: transparent; border-bottom: 0; pointer-events: none; }
.app-shell .app-topbar-inner > *, .app-shell .app-topbar aside { pointer-events: auto; }
@media (min-width: 768px) { body.home-v2.sidebar-open .app-topbar { left: 16rem; } }
.app-root .calendar-section.calendar-section { padding-top: calc(60px + env(safe-area-inset-top)); }
.app-root .hero-scene.hero-scene { top: 0; height: calc(360px + env(safe-area-inset-top)); left: -16px; right: -16px;
  background: linear-gradient(180deg, rgba(7,13,28,.15), rgba(7,13,28,0) 35%, rgba(7,13,28,.55) 75%, var(--c-bg) 98%), url('~@/assets/hero-forest.jpg') 72% 30% / cover no-repeat; }
.app-root .hero.hero { display: flex; align-items: flex-start; justify-content: space-between; padding: 0; }
.app-root .hero-date.hero-date { margin: 0; font-size: 13px; letter-spacing: .16em; color: #5E9BFF; }
.app-root .hero-title.hero-title { font-size: 36px; line-height: 42px; margin: 4px 0 2px; }
.app-root .hero-sub.hero-sub { margin: 0; font-size: 16px; color: #B7C2DA; }
.app-root .hero.hero { position: relative; }
.app-root .hero-text { flex: 1 1 100%; min-width: 0; }
.app-root .hero-menu.hero-menu { position: absolute; right: 0; top: 22px; }
.app-root .hero-menu-btn.hero-menu-btn { width: 36px; height: 36px; border-radius: 50%; font-size: 14px; color: #C9D5F0; background: rgba(12,22,48,.55); border: 1px solid rgba(90,120,190,.35); box-shadow: none; position: relative; }
.app-root .hero-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #2F6FFF; color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; border: 2px solid #070D1C; }
.app-root .hero-badge--alert { background: #EF4444; }
.app-root .hero-menu-pop.hero-menu-pop { position: fixed; top: calc(64px + env(safe-area-inset-top)); left: 12px; right: 12px; max-width: 420px; margin-left: auto; max-height: 72vh; overflow-y: auto; padding: 10px; border-radius: 18px; }
@media (min-width: 768px) { .app-root .hero-menu-pop.hero-menu-pop { position: absolute; top: 44px; left: auto; right: 0; width: 380px; } }
.app-root .hero-notices { display: flex; flex-direction: column; gap: 8px; padding-bottom: 8px; margin-bottom: 6px; border-bottom: 1px solid var(--c-border); }
.app-root .hero-notices:empty { display: none; }
.app-root .hero-notices .home-notice.home-notice { margin: 0; }
.app-root .hero-menu-items { display: flex; flex-direction: column; }
/* week strip proportions */
.app-root .day-tabs.day-tabs.day-tabs { margin: 18px 0 12px; padding: 5px; border-radius: 16px; }
.app-root .day-tab.day-tab.day-tab { min-height: 62px; }
.app-root .day-tab-name.day-tab-name { font-size: 12px; font-weight: 500; color: #A9B4CC; }
.app-root .day-tab--selected .day-tab-name { color: #fff; }
.app-root .day-tab-date.day-tab-date { font-size: 20px; font-weight: 700; color: #F2F5FC; margin-top: 2px; }
/* progress card */
.app-root .progress-section.progress-section.progress-section { border-radius: 16px; }
.app-root .progress-top.progress-top { min-height: 118px; padding: 14px 14px 12px; }
.app-root .progress-copy.progress-copy { align-self: stretch; display: flex; flex-direction: column; }
.app-root .milestone-row.milestone-row { margin-top: auto; padding-top: 10px; }
/* rows */
.app-root .task-list-header.task-list-header { padding: 16px 0 10px; }
.app-root .task-count-label.task-count-label { font-size: 30px; line-height: 34px; }
.app-root .tasks-list.tasks-list > * + * { margin-top: 8px; }
.app-root .task-card.task-card.task-card { min-height: 64px; padding: 10px 8px 10px 4px; border-radius: 14px; }
.app-root .task-card--next.task-card--next.task-card--next { min-height: 84px; }
.app-root .task-title.task-title.task-title { font-size: 16px; font-weight: 600; }
.app-root .task-sub.task-sub { font-size: 14px; color: #A9B4CC; }

/* v3 tightening to mockup proportions */
.app-root .calendar-section.calendar-section { padding-top: calc(52px + env(safe-area-inset-top)); }
.app-root .hero-title.hero-title { font-size: 34px; line-height: 38px; margin: 2px 0 2px; }
.app-root .hero-sub.hero-sub { font-size: 15px; }
.app-root .day-tabs.day-tabs.day-tabs { margin: 14px 0 10px; }
.app-root .day-tab.day-tab.day-tab { min-height: 56px; }
.app-root .day-tab-date.day-tab-date { font-size: 19px; }
.app-root .progress-top.progress-top { min-height: 104px; padding: 12px 12px 10px; }
.app-root .progress-ring.progress-ring { width: 84px; height: 84px; }
.app-root .foot-item { padding: 10px 14px; }
.app-root .task-list-header.task-list-header { padding: 12px 0 8px; }
.app-root .task-count-label.task-count-label { font-size: 28px; line-height: 32px; }
.app-root .toggle-visibility.toggle-visibility { width: 40px; min-width: 40px; height: 40px; min-height: 40px; }
.app-root .task-card.task-card.task-card { min-height: 58px; padding: 8px 8px 8px 4px; }
.app-root .task-card--next.task-card--next.task-card--next { min-height: 72px; }
.app-root .tasks-list.tasks-list > * + * { margin-top: 7px; }
.app-root .task-cat { width: 36px; height: 36px; font-size: 16px; border-radius: 10px; }
.app-root .task-title.task-title.task-title { font-size: 15px; line-height: 20px; }
.app-root .task-sub.task-sub { font-size: 13px; }
.app-root .task-upnext { font-size: 10px; }
</style>
