<template>
  <div ref="scrollContainer" class="app-root" :class="[{ 'has-bg-anim': bgPrefs.anim !== 'none', 'is-dragging': isDraggingTask, 'reorder-active': isDraggingTask || reorderSettling }, appTheme ? 'theme-' + appTheme : '']">
    <BackgroundLayer :anim="bgPrefs.anim" :force-motion="bgPrefs.forceMotion" />
    <div class="safe-top-scrim" aria-hidden="true"></div>
    <BackgroundPanel :open="showBackground" @close="showBackground = false" />

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
            <button type="button" class="bg-pill" data-test="open-background-pill" aria-label="Background: animation and music" @click="showBackground = true">🎧 Background<span class="bg-pill-sub">picture · snow · rain · music</span></button>
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
              <router-link v-if="!hideUgc" to="/rankings" class="hero-menu-item">🏆 Rankings</router-link>
              <router-link to="/discipline" class="hero-menu-item">⚔️ Discipline Mode</router-link>
              <button type="button" class="hero-menu-item" data-test="open-background" @click="showBackground = true">🎧 Background</button>
              <button type="button" class="hero-menu-item" @click="showSchedule = !showSchedule">🗓 {{ showSchedule ? 'Hide' : 'Show' }} schedule</button>
              </div>
            </div>
          </div>
        </header>

        <DayTabs :days="tabDays" :selected-index="selectedDayIndex" :scheduled-counts="scheduledCounts" @select="handleDayTabClick" />

        <EightHourCard v-if="lockInToday || eh.lock.value" :tasks="ehTasks" :start-error="ehStartError" @retry="syncAfterAuth" @start="openDayPrompt" />
        <DayStartPrompt v-if="dayPromptOpen" :initial-hours="eh.hoursPref.value" :now-ms="eh.nowMs" :tz="eh.plan.value?.tz || ''" :busy="ehBusy" :error="ehStartError" :tasks="todayTasksForTarget" :stats="eh.stats.value" :earned="pointsAccumulated || 0" @confirm="confirmDayStart" @skip="skipLockIn" />

        <ProgressBar :percentage="calculateCompletionPercentage()" :milestones="milestones" :done="completedTaskCount || 0" :total="dayTasks.length"
                     :streak="streak" :streak-status="streakStatus" :streak-progress="streakProgress" :streak-min="DAILY_STREAK_MIN" :points="pointsAccumulated || 0" :target="isViewingToday ? dayRequiredPts : 0" />

      </section>
      <ShutdownPrompt class="home-notice" :suggest="false" :open="shutdownOpen" :done="shutdownDone" :open-tasks="shutdownOpenTasks"
                      v-model:carry="shutdownCarry" :busy="shutdownBusy"
                      @start="openShutdown" @dismiss="shutdownDismissed = true" @close="shutdownOpen = false" @finish="finishShutdown" />


      <DramaOverlay v-if="lossScreen" variant="lost" title="Streak lost" button="I'll do better"
                    :subtitle="lossScreen.reason ? `${lossScreen.lostStreak ? lossScreen.lostStreak + '/5 streak gone. ' : ''}${lossScreen.reason} Complete 5 tasks a day to keep it.` : `You missed your deadline. ${lossScreen.lostStreak ? lossScreen.lostStreak + '-day streak gone. ' : ''}${lossScreen.penalty} pts.`" @close="dismissLoss" />

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
                       @remove-attachment="removeTaskAttachment" @toggle-label="toggleLabelHighlight"
                       :schedule="detailSchedule" :day-date="selectedDayDate" :sched-error="schedEditError" @save-schedule="saveTaskSchedule" />


      <ImagePreview v-if="showImagePreview" :src="taskDetail.imageURL" @close="showImagePreview = false" />


      <ReminderModal v-if="isModalOpen" :reminder="reminder" :task-title="selectedTaskTitle" @close="closeModal" @submit="handleAddReminder" />


      <AssistantSheet v-if="askOpen" :executor="assistantExecutor" :listen-on-open="assistantListen" @close="askOpen = false" />
      <VoiceModal v-if="voiceOpen" :transcript="liveTranscript" :supported="voiceSupported" :capability="voiceCap" :error="voiceError" :hint="voiceHint" :added="voiceAdded" :items="voiceItems" :busy="voiceBusy" :source="voiceSource" @undo="undoVoiceTask" @cancel="cancelVoiceInput" @finish="finishVoiceInput" @confirm="confirmVoiceItems" @relisten="relistenVoice" />
      <div v-if="!voiceOpen && voiceAdded.some((e) => e.undoUntil > nowTick)" class="voice-toasts" role="status">
        <div v-for="e in voiceAdded.filter((x) => x.undoUntil > nowTick)" :key="e.id" class="voice-toast">🎙 Added “{{ e.title }}” <button type="button" @click="undoVoiceTask(e)">Undo</button></div>
      </div>


      <!-- ─── Task List ─── -->
      <section v-if="canViewSelectedDayTasks"
               class="task-section">
        <EmptyState v-if="dayTasks.length === 0" :show-add="true" @add="onAddClick" />


        <div v-else class="task-list-wrap">
          <TaskListHeader :label="isViewingToday ? 'Today' : FULL_DAY_NAMES[selectedDayIndex]" :is-today="isViewingToday" :completed="completedTaskCount" :total="dayTasks.length"
                          :sound-enabled="soundEnabled" :boss-voice-on="!voMuted" :assistant-live="askOpen" :show-completed="showCompleted" v-model:prefs="viewPrefs" @toggle-sound="toggleSound" @toggle-boss-voice="setVoMuted(!voMuted)" @open-assistant="openAssistant" @toggle-completed="showCompleted = !showCompleted" />



          <TimeBlockSchedule v-if="showSchedule" :schedule="schedule" />


          <p v-if="viewPrefs.filter !== 'all' && isViewingToday && visibleTaskCount === 0" class="filter-empty">No tasks match this filter.</p>

          <div v-if="rollover && isViewingToday" class="rollover-banner" data-test="rollover-banner" role="status">
            <button type="button" class="rollover-banner__body" @click="highlightRollover">🌅 {{ rollover.message }}</button>
            <button type="button" class="rollover-banner__x" aria-label="Dismiss" data-test="rollover-dismiss" @click="dismissRollover">×</button>
          </div>
          <div ref="taskListEl" class="tasks-list space-y-2" :class="{ 'reorder-off': !reorderable }" @pointerdown="onListPointerDown">
            <template v-for="task in displayTasks" :key="taskKey(task)">
              <TaskCard
                  v-if="!task.completed || !isViewingToday" :data-reorder-key="taskKey(task)"
                  :task="task" :up-next="isViewingToday && !task.completed && taskKey(task) === upNextKey" :drag-disabled="!reorderable" :index="realIndex(task)" :is-today-tab="isViewingToday" :expanded="expandedKey === taskKey(task)"
                  :active-labels="activeLabels" :now="nowTick" :show-notification="showNotification" :transfer-notification="transferNotification"
                  @toggle-expand="toggleExpanded(task)" @toggle-complete="toggleTaskCompletion(realIndex(task))" @open-detail="openTaskDetailModal(task)"
                  @set-boss="setBoss(realIndex(task), task)" @toggle-important="toggleTaskImportance(realIndex(task))" :day-locked="selectedDayLocked" :highlight="rolledKeys.includes(taskKey(task))" :all-occurrences="seriesKey === taskKey(task)"
                  @edit="toggleExpanded(task)" @series="seriesKey = $event ? taskKey(task) : null"
                  @patch="editTask(realIndex(task), task, $event)" @subtask-patch="onSubtaskPatch(realIndex(task), task, $event)"
                  @toggle-label="toggleLabelHighlight" @open-reminder="openModal('calendar', realIndex(task), task.title)" @transfer="openTransferModal(realIndex(task))"
                  @video="openYouTubeModal(realIndex(task))" @upload="handleUpload($event, realIndex(task))" @timer="openTaskTimerModal(realIndex(task))"
                  @wont-do="openWontDoModal(realIndex(task))" @delete="deleteTask(realIndex(task))" @schedule="scheduleExistingTask(realIndex(task), task, $event)" @set-repeat="setTaskRepeat(task, $event)"
              />
            </template>
          </div>

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
                  @set-boss="setBoss(realIndex(task), task)" @toggle-important="toggleTaskImportance(realIndex(task))" :day-locked="selectedDayLocked" :highlight="rolledKeys.includes(taskKey(task))" :all-occurrences="seriesKey === taskKey(task)"
                  @edit="toggleExpanded(task)" @series="seriesKey = $event ? taskKey(task) : null"
                  @patch="editTask(realIndex(task), task, $event)" @subtask-patch="onSubtaskPatch(realIndex(task), task, $event)"
                  @toggle-label="toggleLabelHighlight" @open-reminder="openModal('calendar', realIndex(task), task.title)" @transfer="openTransferModal(realIndex(task))"
                  @video="openYouTubeModal(realIndex(task))" @upload="handleUpload($event, realIndex(task))" @timer="openTaskTimerModal(realIndex(task))"
                  @wont-do="openWontDoModal(realIndex(task))" @delete="deleteTask(realIndex(task))" @schedule="scheduleExistingTask(realIndex(task), task, $event)" @set-repeat="setTaskRepeat(task, $event)" />
            </div>
          </div>

          <IdleState v-if="dayTasks.length > 0 && dayTasks.every(task => task.completed) && !showCompleted" :wrapped="!!daySession.ended" :count="dayTasks.length" />


          <WontDoList v-if="wontDoTasks.length > 0 && !selectedDayRoutine?.every(task => task.completed)" :tasks="wontDoTasks" @undo="undoWontDo" />

        </div>
      </section>
      <StartDayPrompt v-else-if="isViewingToday" :done="!!daySession.ended" :ended-at="daySession.endedAtText" @start="startDay" />

      <TimeStatsBar v-if="isViewingToday" :stats="timeStats" :ended="!!daySession.ended" :suggest="suggestShutdown && !shutdownDismissed" @wrap-up="openShutdown" />

      <ScheduledList v-if="userId" :tasks="futureScheduled" :today-str="todayStr" :error="scheduledError" :series="templatesOf(scheduledList)" @edit="editScheduledEntry"
                     @move-today="moveScheduledToToday" @update="updateScheduledDate" @delete="deleteScheduled" />

      <FabButtons :show-add="false" :user-id="userId" :assistant-live="askOpen" @add="onAddClick" @assistant="openAssistant" />


    </div>
  </div>
</template>

<script setup>
import { addSubtask, subtasksOf } from '@/utils/subtasks';
import { parseAsk } from '@/utils/assistantFab';
import { weekStats, searchTasks, suggestNext, snoozeTo } from '@/utils/assistantExtras';
import { ref, onMounted, onBeforeUnmount, computed, watch, reactive, nextTick } from 'vue';
import { useSounds } from '@/composables/useSounds';
import { patchStoredTask, loadDayTasks, carryTasksToDay } from '@/composables/useDayPersistence';
import { activeFromForDay, isHiddenOnDate, seriesDays, withoutSeries } from '@/utils/repeat';
import { useTaskViewPrefs } from '@/composables/useTaskViewPrefs';
import { viewTasks, canReorder, applyManualOrder, normalizePrefs, visibleCount, shouldHandleShortcut } from '@/utils/taskView';
import { ACTIVE_CAP, taskKey, activeCount, loadSummary, buildSchedule } from '@/utils/taskPlanning';
import { localYMD, isStaleCompletion } from '@/utils/localDate';
import { getTodayId, formatSessionTime, getCurrentDate, formatTime, isToday } from '@/utils/dateTime';
import { badges } from '@/utils/gamification';
import { recordMonthlyToggle, awardFinishedMonth } from '@/composables/useMonthlyStats';
import { loadDisciplineSettings, settleDeadlines, clearLossPending, loadDisciplineState, setBossForDay, setBossCleared, tryFreeze, logDiscipline, patchDisciplineState } from '@/composables/useDiscipline';
import { levelFor, rewardsFor } from '@/utils/rewards';
import { defaultSettings as defaultDiscipline, warningFor, isPastDeadline, streakGate, BOSS_BONUS } from '@/utils/discipline';
import DramaOverlay from '@/components/discipline/DramaOverlay.vue';
import BossPanel from '@/components/discipline/BossPanel.vue';
import { bossMessage, validReason, carryTask, canAddTask, watchingBlockers, isIdle, verdict as dayVerdict, line as bossLine, IDLE_MINUTES } from '@/utils/strictBoss';
import MorningReport from '@/components/home/MorningReport.vue';
import BackgroundLayer from '@/components/background/BackgroundLayer.vue';
import BackgroundPanel from '@/components/background/BackgroundPanel.vue';
import { useBackground } from '@/composables/useBackground';
import { buildRecap, reportDue, prevDay } from '@/utils/dailyReport';
import { monthKey, prevMonthKey } from '@/utils/ranking';
import { applyTaskToggle, evaluateStreak, localDateStr, dayDiff, ALLOWED_GAP_DAYS, DAILY_STREAK_MIN, capStreak, lostReason } from '@/utils/streak';
import { askAi } from '@/composables/useAi';
import { ensureAiConsent, hasAiConsent } from '@/composables/useAiConsent';
import { useRouter as _useRouter } from 'vue-router';
import { requirePro, loadUserDoc, rcProActive } from '@/composables/usePro';
import { isPro as isProUser } from '@/utils/pro';
import { checkDailyLimit } from '@/utils/taskLimits';
import { defaultTransferDay, transferFits, MAX_TASKS_PER_DAY } from '@/utils/transfer';
import { canUse } from '@/utils/pro';
const _proRouter = _useRouter();
// Daily task limit (config/pricing.js TASK_LIMITS): safety max 50/day, free and Pro alike
const limitHit = ref(null); // { limit, count, pro, day } when the last add was blocked
const goUpgradeForLimit = () => { if (rcProActive(auth.currentUser?.uid)) return; modalOpen.value = false; _proRouter.push({ path: '/paywall', query: { feature: 'taskLimit', from: '/home' } }); };
// Limit data is prefetched when the add modal opens so Save does not wait on 8 Firestore reads.
let gateCache = null; // { at, pro, lists, extra: [] }
const pendingAdds = new Map(); // taskKey -> task added in this session (a refetch started before the write landed would miss it; counting dedupes by key)
const fetchGateData = async () => {
  const [ud, ...snaps] = await Promise.all([loadUserDoc(), ...days.map((d) => getDoc(doc(db, 'weeklyRoutines', `${userId.value}_${d.day}`)))]);
  gateCache = { at: Date.now(), pro: isProUser(ud), lists: snaps.map((x) => (x.exists() ? x.data().tasks || [] : [])), extra: [] };
  return gateCache;
};
let gatePrefetch = null;
// Optimistic writes still in flight: warn before a reload/close would drop them.
let pendingWrites = 0;
const trackWrite = (pr) => { pendingWrites++; return Promise.resolve(pr).finally(() => { pendingWrites--; }); };
const beforeUnloadGuard = (e) => { if (pendingWrites > 0) { e.preventDefault(); e.returnValue = ''; } };
window.addEventListener('beforeunload', beforeUnloadGuard);
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadGuard));
const prefetchGate = () => { if (userId.value) gatePrefetch = fetchGateData().catch(() => null); };
const dailyLimitGate = async (dayKey) => {
  let g = gatePrefetch ? await gatePrefetch : null;
  if (!g || Date.now() - g.at > 60000) g = await fetchGateData();
  const res = checkDailyLimit(g.pro, dayKey, [...g.lists, g.extra, [...pendingAdds.values()]], scheduledList.value || []);
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
import { scheduleLocal, scheduleTimerDone, cancelLocal, timerKey, cancelTaskNotifications, taskKeyOf } from '@/utils/localNotify';
import { scheduleNotification, sendNotificationToPlayer, linkPushUser } from '@/composables/useNotifications';
import { speak } from '@/composables/useSpeech';
import { completionPercentage, computeTimeStats, daysLeftInYearFrom, heroTitleFor } from '@/utils/dayStats';
import { shouldAutoComplete, resetSubtasks } from '@/utils/subtasks';
import { deferredDateFor, buildScheduledEntry, buildRecurringTemplate, isTaskVisibleOn, futureOf, dueOf, countsByDate, withWeekDates, isValidDate, rescheduleEntry, templatesOf } from '@/utils/scheduling';
import { mutateScheduled, materializeDueForToday } from '@/composables/useScheduledTasks';
import { blankSchedule, validateSchedule, scheduleOfTask, applyTaskSchedule, deleteTaskScope, deleteEntry, editEntry } from '@/utils/schedEdit';
import { syncScheduledNotifications } from '@/composables/useSchedNotifications';
import ScheduledList from '@/components/home/ScheduledList.vue';
import EmptyState from '@/components/home/EmptyState.vue';
import StartDayPrompt from '@/components/home/StartDayPrompt.vue';
import TaskListHeader from '@/components/home/TaskListHeader.vue';
import FabButtons from '@/components/home/FabButtons.vue';
import IdleState from '@/components/home/IdleState.vue';
import WontDoList from '@/components/home/WontDoList.vue';
import LoadSummary from '@/components/home/LoadSummary.vue';
import TaskCard from '@/components/home/TaskCard.vue';
import { safeEditPatch, cleanEstimate, timerStarted, retimePatch, seriesPatch } from '@/utils/taskEdit';
import { pendingRollover, loadSeen, markSeen, rolloverNotifBody } from '@/utils/rollover';
import TimeBlockSchedule from '@/components/home/TimeBlockSchedule.vue';
import AddTaskModal from '@/components/home/AddTaskModal.vue';
import CelebrationOverlay from '@/components/home/CelebrationOverlay.vue';
import DayTabs from '@/components/home/DayTabs.vue';
import ImagePreview from '@/components/home/ImagePreview.vue';
import ProgressBar from '@/components/home/ProgressBar.vue';
import EightHourCard from '@/components/home/EightHourCard.vue';
import { lockIn, loadLockIn, skipLockInToday } from '@/utils/lockIn';
import { homeDay } from '@/utils/homeDay';
import DayStartPrompt from '@/components/eighthour/DayStartPrompt.vue';
import { useEightHour, syncAfterAuth, setDayLengthHours, loadDayLengthHours, promptSeenFor, markPromptSeen } from '@/composables/useEightHour';
import { countableIndexes } from '@/utils/eightHour';
import { estimateFor, chipValues } from '@/utils/taskEstimate';
import { patchTouchesLocked } from '@/utils/eightHourLock';
import { isDayLocked, isLockError, assertTasksChangeAllowed, lockedMessage, isShutdown, shutMessage } from '@/utils/eightHourLock';
import ReminderModal from '@/components/home/ReminderModal.vue';
import ShutdownPrompt from '@/components/home/ShutdownPrompt.vue';
import TaskDetailModal from '@/components/home/TaskDetailModal.vue';
import TimeStatsBar from '@/components/home/TimeStatsBar.vue';
import TimerModal from '@/components/home/TimerModal.vue';
import TransferModal from '@/components/home/TransferModal.vue';
import VoiceModal from '@/components/home/VoiceModal.vue';
import AssistantSheet from '@/components/home/AssistantSheet.vue';
import { createAssistantExecutor } from '@/utils/assistantExecutor';
import { validateCall } from '@/utils/assistantTools';
import { clampPoints as _clampPts, clampComplexity as _clampCx } from '@/utils/assistantTools';
import { loadAssistant, assistantSession, saveAssistant } from '@/utils/assistantSession';
import { voMuted, setVoMuted, speakLive } from '@/composables/useVoiceover';
import { reactionLine, shouldRoast, checkinMarks, checkinLine, dueMark, overbooked, rollCandidates, tomorrowStr } from '@/utils/bossCoach';
import { loadHabits, saveHabits, addHabit, logHabit, habitSummary } from '@/utils/habits';
import { autoSchedule } from '@/utils/autoSchedule';
import { clingLock, clingNative, lockAvailable, nativeAvailable } from '@/native/clingNative';
import { LOCK_PREF, PENALTY_KEY, EMERGENCY_PENALTY, shouldShield, busyToDay } from '@/utils/appLock';
import { previewDayTarget, requiredPoints } from '@/utils/dayTarget';
const askOpen = ref(false); // Assistant sheet (✨ next to the bell, and the bubble in the task list header)
const assistantListen = ref(false);
const agentAdd = ref(false); // true while the assistant adds tasks: over-limit returns an error to the model instead of opening the paywall
import { ugcHidden, voiceInputBlocked, isNativeIOS } from '@/utils/platform';
import { splitSpokenTasks, voiceCapability, UNDO_MS } from '@/utils/voiceSplit';
import { interpretSpeech } from '@/utils/voiceInterpret';
import { raisedPlan } from '@/utils/planRaise';
import { saveReminder } from '@/utils/reminders';
import { startNativeSpeech, nativeSpeechAvailable } from '@/composables/useNativeSpeech';
import WontDoModal from '@/components/home/WontDoModal.vue';
import WorkoutModal from '@/components/home/WorkoutModal.vue';
import YouTubeModal from '@/components/home/YouTubeModal.vue';
import { auth } from '@/firebaseConfig'; // Assuming you have Firebase authentication configured
import { onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import data from '@/data.json';
import { useSmoothReorder } from "@/composables/useSmoothReorder";
import {db} from '@/firebaseConfig'; // Assuming you have imported the Firebase setup file and exported the db instance
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, getFirestore, runTransaction} from 'firebase/firestore';
const modalOpen = ref(false);
import { deleteObject } from "firebase/storage";
import { widgetTaskId } from '@/utils/widgetSnapshot';

const currentTime = ref([]);
const showAdvanced = ref(false)

// Define function to format time

const transferModalOpen = ref(false);
const selectedTransferTaskIndex = ref(null);
const selectedTransferDay = ref(null);

const openTransferModal = (index) => {
  selectedTransferTaskIndex.value = index;
  // preselect a real target (the <select> otherwise looks like it shows Monday while its value is null, so Transfer did nothing)
  selectedTransferDay.value = defaultTransferDay(selectedDayIndex.value, days.length);
  transferModalOpen.value = true;
};
const selectedTimerHours = ref(0);
const selectedTimerMinutes = ref(5);

const selectedTimerTaskIndex = ref(null);
const nowTick = ref(Date.now());

let timerInterval = null;

// Play = start the countdown immediately from the task's estimate (typed override > stored/auto estimate). No picker step.
const openTaskTimerModal = async (index) => {
  const t = selectedDayRoutine.value[index]; if (!t) return;
  const mins = chipValues(t).minutes || 25;
  selectedTimerTaskIndex.value = index;
  selectedTimerHours.value = Math.floor(mins / 60);
  selectedTimerMinutes.value = mins % 60;
  await startTimer();
};

// ── 8-hour day: strict lock (UI guards; the data layer and Firestore rules enforce the same) ──
const eh = useEightHour();
const lockedDayName = computed(() => (eh.running.value && eh.lock.value ? eh.lock.value.dayName : ''));
const selectedDayLocked = computed(() => !!lockedDayName.value && days[selectedDayIndex.value]?.day === lockedDayName.value);
// true (after telling the user) when the given weekday tab is the locked day; every list-changing action calls this first
const blockIfLocked = (dayIdx = selectedDayIndex.value) => {
  if (dayIdx === -1 || !days[dayIdx] || !isDayLocked(days[dayIdx].day)) return false;
  alert(lockedMessage());
  return true;
};
// 8-hour hard stop: once today's started day has ended, every task action is refused until the next wake time (data layer also guards).
const blockIfShut = () => { if (!isShutdown()) return false; alert(shutMessage()); return true; };
const lockMessage = (e) => { if (isLockError(e)) { alert(e.message); return true; } return false; };
// the planned task count (set before the countdown) limits what today's list may hold until the countdown starts
const planFull = () => {
  const plan = eh.plan.value; const ph = eh.phase.value;
  if (!plan || (ph !== 'before' && ph !== 'ready')) return false;
  return countableIndexes(selectedDayRoutine.value || [], eh.phaseInfo.value.dayKey || '').length >= plan.taskCount;
};

const saveSelectedDayTasks = async () => {
  if (!userId.value || selectedDayIndex.value === -1) return;
  if (selectedDayLocked.value) { // whole-array write on a locked day: only allowed if every locked field of every slot is unchanged
    const old = await loadDayTasks(userId.value, days[selectedDayIndex.value].day);
    assertTasksChangeAllowed(days[selectedDayIndex.value].day, old, selectedDayRoutine.value);
  }

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
        // 8-hour lock: a locked day can never lose a task, so an expired timer only stops in place (no carry to tomorrow).
        // Before: the carry spliced the task and saveSelectedDayTasks threw a LockError inside this interval -> "Unhandled:" overlay.
        if (selectedDayLocked.value || isShutdown()) {
          selectedDayRoutine.value[i] = { ...task, timerActive: false, timerStartedAt: null, timerEndTime: null };
          await saveSelectedDayTasks().catch((e) => console.warn('timer stop not saved:', e));
        } else {
          await autoTransferTaskToTomorrow(i).catch((e) => { console.warn('auto-carry failed:', e); fetchSelectedDayRoutine(); });
        }
      }
    }
  }, 1000);
};
onMounted(() => {
  startCountdownWatcher();
});
const autoTransferTaskToTomorrow = async (index) => {
  const task = {
    rolledOverFor: getTodayId(), // rollover stamp: tomorrow shows a one-time "moved from yesterday" notice
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
  notifyRollover([task.title]);

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
  if (blockIfShut()) return false;
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

  if (blockIfLocked(currentDayIndex) || blockIfLocked(targetDayIndex)) { closeTransferModal(); return; }
  const currentDay = days[currentDayIndex].day;
  const targetDay = days[targetDayIndex].day;
  const picked = (selectedDayRoutine.value || [])[selectedTransferTaskIndex.value];
  if (!picked) { closeTransferModal(); return; }
  const key = taskKey(picked);

  try {
    // daily cap on the target day (same 50/day limit as adding a task)
    const tSnap = await getDoc(doc(db, 'weeklyRoutines', `${userId.value}_${targetDay}`));
    const targetLen = tSnap.exists() ? (tSnap.data().tasks || []).length : 0;
    if (!transferFits(targetLen)) { alert(`${targetDay} already has ${targetLen} tasks (limit ${MAX_TASKS_PER_DAY}).`); return; }

    // remove by identity (not by a list index that may have shifted), then append to the target day; both in transactions
    let rawTask = null;
    const currentTasks = await trackWrite(mutateDay(currentDay, (cur) => {
      const i = cur.findIndex((t) => taskKey(t) === key);
      rawTask = i === -1 ? null : cur[i];
      return i === -1 ? cur : [...cur.slice(0, i), ...cur.slice(i + 1)];
    }));
    if (!rawTask) { closeTransferModal(); return; }
    const task = strictOn.value ? carryTask(rawTask) : rawTask;
    if (strictOn.value) {
      logStrict('deferred', `${task.title} → ${targetDay}: ${deferReason.value.trim()}`);
      if (task.bossWatching && !rawTask.bossWatching) logStrict('boss-watching', task.title);
      deferReason.value = '';
    }
    await trackWrite(mutateDay(targetDay, (cur) => [...cur, task]));

    if (selectedDayIndex.value === currentDayIndex) selectedDayRoutine.value = currentTasks;
    transferNotification.value = `Task "${task.title}" moved to ${targetDay}`;
    setTimeout(() => { transferNotification.value = null; }, 3000);
    closeTransferModal();
  } catch (error) {
    console.error('Error transferring task:', error);
    if (!lockMessage(error)) alert("Couldn't move the task. Check your connection and try again.");
  }
};
const resetTasksToIncomplete = async (dayIndex = selectedDayIndex.value, isCurrent = () => true) => {
  if (!userId.value || dayIndex === -1) return;

  if (isDayLocked(days[dayIndex]?.day)) return; // 8-hour lock: never wipe the locked day's progress
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




// Add Task button: a free user already at today's limit goes straight to the paywall instead of opening the form.
const onAddClick = async () => {
  try {
    if (userId.value) {
      const g = gateCache && Date.now() - gateCache.at < 60000 ? gateCache : await fetchGateData();
      const res = checkDailyLimit(g.pro, getTodayId(), [...g.lists, g.extra, [...pendingAdds.values()]], scheduledList.value || []);
      if (!res.ok && !g.pro) { goUpgradeForLimit(); return; }
    }
  } catch (e) { console.error('limit pre-check', e); }
  openModal('task');
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
const reorderable = computed(() => canReorder(effectivePrefs.value) && !hasHiddenCopies.value); // locked day too: a drag only writes sortOrder (slot positions never move)
const realIndex = (task) => (selectedDayRoutine.value || []).indexOf(task);
const onReorder = (list) => { if (reorderable.value && Array.isArray(list)) selectedDayRoutine.value = applyManualOrder(selectedDayRoutine.value, list.map(taskKey), taskKey); };
const reducedMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

// "n" opens Add task (not while typing or when any modal/overlay is open)
const anyModalOpen = computed(() => !!(modalOpen.value || isModalOpen.value || showWorkoutModal.value || showTimerModal.value || wontDoModalOpen.value ||
  transferModalOpen.value || youtubeModalOpen.value || taskDetailModalOpen.value || showImagePreview.value || voiceOpen.value || askOpen.value || shutdownOpen.value || showFullScreenAnimation.value));
const onShortcutKey = (e) => {
  if (!shouldHandleShortcut(e, anyModalOpen.value)) return;
  e.preventDefault();
  openModal('task');
};
onMounted(() => document.addEventListener('keydown', onShortcutKey));
// Global "Create task" FAB (App.vue): same flow as the old Add Task bar, incl. free/Pro limits.
const onCreateTaskEvt = () => onAddClick();
onMounted(() => { window.addEventListener('cn:create-task', onCreateTaskEvt);
  { const ask = parseAsk(_proRouter.currentRoute.value.query); if (ask.open) { const q = { ..._proRouter.currentRoute.value.query }; delete q.ask; _proRouter.replace({ query: q }); setTimeout(() => openAssistant(ask.listen), 400); } }
  if (_proRouter.currentRoute.value.query.new === '1') { const q = { ..._proRouter.currentRoute.value.query }; delete q.new; _proRouter.replace({ query: q }); setTimeout(onAddClick, 600); } });
onBeforeUnmount(() => window.removeEventListener('cn:create-task', onCreateTaskEvt));
// Drill-sergeant report buttons (components/voiceover/BossBriefing.vue) -> real Home actions on today's list.
const onSergeantAction = async (e) => {
  const { id, taskKey } = (e && e.detail) || {};
  if (!isViewingToday.value) { selectedDayIndex.value = todayIdx.value; await fetchSelectedDayRoutine(); }
  const task = taskKey ? (selectedDayRoutine.value || []).find((t) => taskKeyOf(t) === taskKey) : null;
  if (id === 'start-day') openDayPrompt();
  else if (id === 'set-reminder' && task) openModal('calendar', realIndex(task), task.title);
  else if (id === 'open-task' && task) openTaskDetailModal(task);
};
onMounted(() => window.addEventListener('cn:sergeant', onSergeantAction));
onBeforeUnmount(() => window.removeEventListener('cn:sergeant', onSergeantAction));
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
  title: '', anonymous: false, time: '', priority: 'low', labels: [], notes: '', selectedDays: [], position: 0, type: 'one-time',
  dueDate: '', startTime: '', estimateMin: '', nextAction: '', status: 'todo', pendingOn: '',
  sched: blankSchedule(),
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

      // Old-week reset: a task completed before this weekday's most recent (local) occurrence is left over from a
      // previous week -> incomplete again. Completions from the current occurrence (e.g. today) are never touched.
      // (The old check compared data.json's empty `date` with a UTC getTodayDate(), so it never ran.)
      const dayIdx = selectedDayIndex.value;
      if (!isDayLocked(selectedDay.day) && tasks.some((t) => isStaleCompletion(t, dayIdx))) { // (8-hour locked day is never reset)
        if (seq !== fetchSeq) return; // stale: no reset write for a day that is no longer selected
        const now = new Date();
        const resetStale = (list) => list.map((t) => (isStaleCompletion(t, dayIdx, now)
          ? resetSubtasks({ ...t, completed: false, completedAt: null, timerActive: false, timerStartedAt: null, timerEndTime: null, timerStoppedAt: null })
          : t));
        // A rejected write (e.g. shut 8-hour window, offline) must never hide the day's tasks: show the server copy as-is.
        try { tasks = await mutateDay(selectedDay.day, resetStale); } catch (e) { console.warn('old-week reset skipped:', e && (e.code || e.message)); }
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
  if (blockIfShut()) return false;
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
  scheduleTimerDone(task); // iOS: on-device notification at end time (JS timers stop when backgrounded)

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

const deleteTask = async (index, { skipConfirm = false } = {}) => { // skipConfirm: the assistant already showed its own confirm card
  if (blockIfShut()) return false;
  if (blockIfLocked()) return false;
  gateCache = null; gatePrefetch = null; pendingAdds.clear(); // a deleted task frees its slot under the daily limit (next check refetches)
  const confirmed = skipConfirm || confirm("Are you sure you want to delete this task?");
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
    const removeAll = !skipConfirm && alsoDays.length > 0 &&
      confirm(`This task repeats on ${alsoDays.length} other day${alsoDays.length > 1 ? 's' : ''} (${alsoDays.join(', ')}).\n\nOK = delete it from all days\nCancel = delete only from this day`);

    let seriesScope = 'this';
    if (target?.templateId && !skipConfirm) seriesScope = confirm('This task repeats.\n\nOK = delete this and all future occurrences\nCancel = delete only this one') ? 'future' : 'this';
    if (target?.scheduledId) scheduledList.value = await mutateScheduled(userId.value, (l) => deleteTaskScope(l, target, seriesScope, tabDays.value[selectedDayIndex.value]?.date || getTodayId()));
    if (target) cancelTaskNotifications(target);
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

// Stable task identity for transactional updates (id when both have one, else createdAt|title).
const sameTask = (a, b) => !!a && !!b && ((a.id && b.id) ? a.id === b.id : taskKey(a) === taskKey(b));
const toggleTaskCompletion = async (index) => {
  if (blockIfShut()) return false;
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
    cancelTaskNotifications(task);

    userCredits.value += 10;
    if (isToday(selectedDayIndex.value)) { const left = (selectedDayRoutine.value || []).filter((t, i) => i !== index && !t.completed).length;
      window.dispatchEvent(new window.CustomEvent('cn:sergeant-ack', { detail: { left } })); }

    const userName = await fetchUserName(userId.value);
    if (userName) {
      await sendNotificationToPlayer(userName, "completed");
    }
  } else {
    task.completedAt = null;
    task.timerStoppedAt = null;
    task.timerActive = false;
    cancelLocal(timerKey(task));
    userCredits.value -= 10;
  }

  if (isToday(selectedDayIndex.value)) onBossToggle(task).finally(() => updateStreakOnCompletion(task)); // both directions; pending ignored

  // Remove one-time tasks from the UI immediately (a locked day keeps every task: completed ones stay in place)
  const lockedToggle = selectedDayLocked.value;
  if (task.type === "one-time" && !lockedToggle) {
    selectedDayRoutine.value.splice(index, 1);
  } else {
    selectedDayRoutine.value.splice(index, 1, task); // Update recurring tasks
  }

  const selectedDayDocRef = doc(db, 'weeklyRoutines', `${userId.value}_${days[selectedDayIndex.value].day}`);

  try {
    // Transaction + match by task identity (id, else createdAt|title) — never by array index, which shifts under concurrent edits.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(selectedDayDocRef);
      if (!snap.exists()) return;
      let tasks = [...(snap.data().tasks || [])];
      const at = tasks.findIndex((t) => sameTask(t, task));
      if (at < 0) return; // deleted/moved meanwhile: nothing to update

      if (lockedToggle) {
        // 8-hour lock: update in place; the array never shrinks and no locked field changes
        tasks[at] = { ...tasks[at], completed: task.completed, completedAt: task.completedAt, timerActive: false, timerStoppedAt: task.timerStoppedAt };
      } else if (task.type === "one-time" && task.completed) {
        tasks.splice(at, 1); // Remove the one-time task completely
      } else {
        tasks[at] = { ...tasks[at], ...task };
      }

      if (tasks.length > 0 || lockedToggle) {
        tx.update(selectedDayDocRef, { tasks, updatedAt: serverTimestamp() });
      } else {
        tx.delete(selectedDayDocRef); // the only task was this one-time task
      }
    });
    console.log("Task completion updated successfully");
  } catch (error) {
    console.error("Error updating task completion:", error);
  }

  if (lockedToggle) eh.reportProgress(); // server recounts earned points from the day doc (server clock)
  checkAllTasksCompleted();
  await saveDailyPerformance();
  // Completed tasks stay in the routine (the Done section renders them); the Done section keeps whatever state the user chose.
  // (Previously `filter(... || showCompleted)` was missing .value and then forced showCompleted=false, collapsing Done on every tap.)
};

// iOS widget "complete" taps: drained through the SAME toggleTaskCompletion path (points, streak, boss, report, one-time removal).
// mode 'effects': the widget-complete function already stored completed=true; flip the local copy back once so the app's path runs exactly once.
const widgetComplete = async (taskId, mode) => {
  if (!userId.value || !isToday(selectedDayIndex.value)) return false; // only today's tab; retried on next open/foreground
  const i = selectedDayRoutine.value.findIndex((t) => t && widgetTaskId(t) === taskId);
  if (i < 0) return false;
  const t = selectedDayRoutine.value[i];
  if (t.completed && mode !== 'effects') return true; // idempotent
  if (mode === 'effects') { const { widgetEffectsPending, ...rest } = t; selectedDayRoutine.value.splice(i, 1, { ...rest, completed: false }); }
  return (await toggleTaskCompletion(i)) !== false;
};
// Widget tap made before midnight, drained after: mark the task done on the day it was made (that day's doc), instead of dropping it.
// Points/streak for that past day are not re-run (the streak day has already closed). Locked day / missing task: acked as no-op.
widgetComplete.prior = async (taskId, dayName) => {
  if (!userId.value || !dayName || isDayLocked(dayName)) return !!userId.value;
  const at = new Date().toISOString();
  await mutateDay(dayName, (tasks) => tasks.map((t) => (t && !t.completed && widgetTaskId(t) === taskId ? { ...t, completed: true, completedAt: at, timerActive: false, widgetEffectsPending: false } : t)));
  return true;
};
widgetComplete.tasks = () => (isToday(selectedDayIndex.value) ? selectedDayRoutine.value : []);
let offWidget = null;
// One-time App Store rating prompt, ~2s after landing here right after onboarding + sign-up (armed by OnboardingView.finish). No-op on web.
onMounted(() => { const u = auth.currentUser; if (u) import('@/utils/appReview').then((m) => m.maybeRequestReview(u.uid, { stillOnHome: () => _proRouter.currentRoute.value.path === '/home' })).catch(() => {}); });
onMounted(() => { if (isNativeIOS()) import('@/utils/widgetSync').then((m) => { offWidget = m.registerWidgetCompleter(widgetComplete); }).catch(() => {}); });
onBeforeUnmount(() => { if (offWidget) offWidget(); });

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
  if (blockIfShut()) return false;
  if (selectedWontDoTaskIndex.value === null) return;
  if (blockIfLocked()) { wontDoModalOpen.value = false; return; } // no skipping on a locked day
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
  if (blockIfShut()) return false;
  if (blockIfLocked()) return;
  const task = wontDoTasks.value.splice(index, 1)[0];
  selectedDayRoutine.value.push(task);

  // Update Firestore
  const wontDoDocRef = doc(db, "wontDoTasks", `${userId.value}_${days[selectedDayIndex.value].day}`);
  await setDoc(wontDoDocRef, { tasks: wontDoTasks.value, updatedAt: serverTimestamp() });
  await saveSelectedDayTasks().catch((e) => console.warn('Restore not saved:', e));

  console.log("Task restored from 'Won't Do'");
};





const handleDragEnd = async () => {
  // no lock guard: a drag only changes task.sortOrder, positions (locked slot identity) are untouched, so the lock rules allow it
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


const showFullScreenAnimation = ref(false);

const checkAllTasksCompleted = async () => {

  const allCompleted = selectedDayRoutine.value.every(task => task.completed);

  if (allCompleted) {
    // 🎉 Show completion animation
    showFullScreenAnimation.value = true;
    speak("Congratulations! You are free to do whatever you want");
    fetchSelectedDayRoutine();
    await saveDailyPerformance();

    // 🗑 Remove completed one-time tasks only; recurring/routine tasks are always kept.
    // (The old filter callback returned undefined for every non-one-time task, so the whole routine was dropped and the doc deleted.)
    if (selectedDayLocked.value) return; // 8-hour lock: the day's array never shrinks
    const isDoneOneTime = (t) => t && t.type === 'one-time' && t.completed;
    selectedDayRoutine.value = selectedDayRoutine.value.filter((t) => !isDoneOneTime(t));

    // 🔄 Update Firestore (transaction on the server copy: never overwrite with a stale local list, never delete the doc)
    try {
      const dayName = days[selectedDayIndex.value].day;
      await mutateDay(dayName, (tasks) => tasks.filter((t) => !isDoneOneTime(t)));
      console.log("✅ Completed one-time tasks removed; recurring tasks kept.");

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
const setBoss = async (index, task) => { // (boss is not a locked field: allowed on a locked day)
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
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { const wn = new Notification('ClingNote deadline', { body: `${w === '30m' ? '30 min' : '2 hours'} left: ${streakProgress.value}/${DAILY_STREAK_MIN} tasks done` }); wn.onclick = () => { try { window.focus(); } catch (e) { /* */ } wn.close(); }; }
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
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) { const bn = new Notification('Boss: focus check', { body: idleNudge.value }); bn.onclick = () => { try { window.focus(); } catch (e) { /* */ } bn.close(); }; } } catch (e) { /* optional */ }
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
const dismissLoss = async () => { const noticeOnly = lossScreen.value && lossScreen.value.noticeOnly; lossScreen.value = null; if (noticeOnly) { try { localStorage.setItem(`streakLostSeen_${userId.value}_${localDateStr()}`, '1'); } catch (e) { /* ignore */ } return; } try { await clearLossPending(userId.value); } catch (e) { /* retry next open */ } };
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
    // Transaction: two quick toggles (or two devices) can no longer read the same doc and overwrite each other's update.
    const toggle = { key: taskKey(task), completed: !!task.completed, pending: task.status === 'pending', gate: streakGateNow() && !!daySession.value.started };
    const today = localDateStr(), gap = streakGap();
    const next = await runTransaction(db, async (tx) => {
      const snap = await tx.get(streakDocRef);
      const n = applyTaskToggle(snap.exists() ? snap.data() : null, today, toggle, gap);
      tx.set(streakDocRef, { ...n, updatedAt: serverTimestamp() }, { merge: true });
      return n;
    });
    const prevStreak = streak.value, prevProg = streakProgress.value;
    applyStreakState(next);
    // streak music (respects the Sounds toggle inside playSound): fanfare when the streak is hit / goes up, else a rising step 1→5
    if (task.completed) {
      if (streak.value > prevStreak || (prevProg < DAILY_STREAK_MIN && streakProgress.value >= DAILY_STREAK_MIN)) playSound('streakHit');
      else if (streakProgress.value > prevProg && streakProgress.value <= DAILY_STREAK_MIN) playSound('streakStep', { step: streakProgress.value, of: DAILY_STREAK_MIN });
    }
    if (task.completed) bossReact(streak.value > prevStreak || (prevProg < DAILY_STREAK_MIN && streakProgress.value >= DAILY_STREAK_MIN) ? 'streak' : 'done', task.title);
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
const onVisible = () => { if (document.visibilityState === 'visible' && userId.value && getTodayId() !== todayStr.value) { afterMaterialize(); checkStreakOnCompletion(); } };
onMounted(() => document.addEventListener('visibilitychange', onVisible));
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible));

const submitScheduledTask = async () => {
  if (blockIfShut()) return false;
  const nt = newTask.value; const sc = nt.sched;
  const bad = validateSchedule(sc, getTodayId());
  if (bad) { error.value = bad; return false; }
  const labels = typeof nt.labels === 'string' ? nt.labels.split(',').map(l => l.trim()).filter(Boolean) : (nt.labels || []);
  const fields = {
    title: nt.title, important: false, visibility: 'public', anonymous: !!nt.anonymous, time: '', priority: nt.priority, labels, notes: nt.notes, userId: userId.value,
    status: nt.status || 'todo', pendingOn: nt.status === 'pending' ? (nt.pendingOn || '').trim() : '', dueDate: nt.dueDate || '', startTime: nt.startTime || '',
    estimateMin: Number(nt.estimateMin) || 0, nextAction: (nt.nextAction || '').trim(),
  };
  Object.assign(fields, estimateFor(fields)); // scheduled / recurring copies carry the estimate too
  const entry = sc.repeat !== 'never'
    ? buildRecurringTemplate({ ...fields, scheduledTime: sc.time }, sc.date, { freq: sc.repeat, days: sc.days, dayOfMonth: sc.dayOfMonth, until: sc.until })
    : buildScheduledEntry(fields, sc.date, sc.time);
  if (!entry) { error.value = 'Could not schedule this task.'; return false; }
  try {
    scheduledList.value = await mutateScheduled(userId.value, (l) => [...l, entry]);
    await afterMaterialize(); // today's date (or today's occurrence) shows up right away
    newTask.value = blankTask();
    capWarning.value = false; capOverride.value = false;
    closeModal();
    error.value = '';
    return true;
  } catch (e) {
    console.error('Error scheduling task:', e);
    error.value = 'Could not save the scheduled task (permissions?). Nothing was changed.';
    return false;
  }
};

// Task details: Schedule switch / Repeat for an existing task (scope 'this' | 'future' for occurrences of a series).
const schedEditError = ref('');
const selectedDayDate = computed(() => tabDays.value[selectedDayIndex.value]?.date || getTodayId());
const detailSchedule = computed(() => scheduleOfTask(taskDetail.value, scheduledList.value, selectedDayDate.value));
const saveTaskSchedule = async ({ sched, scope }) => {
  schedEditError.value = '';
  if (blockIfLocked() || !userId.value) return;
  const task = taskDetail.value; const key = taskKey(task);
  const dayName = days[selectedDayIndex.value].day;
  let res = null;
  try {
    scheduledList.value = await mutateScheduled(userId.value, (l) => { res = applyTaskSchedule({ list: l, task, sched, scope, dayDate: selectedDayDate.value }); return res.error ? l : res.list; });
    if (res.error) { schedEditError.value = res.error; return; }
    const ref_ = doc(db, 'weeklyRoutines', `${userId.value}_${dayName}`);
    const cur = (await getDoc(ref_)).data()?.tasks || [];
    const next = res.task ? cur.map((t) => (taskKey(t) === key ? res.task : t)) : cur.filter((t) => taskKey(t) !== key);
    await updateDoc(ref_, { tasks: next, updatedAt: serverTimestamp() });
    selectedDayRoutine.value = next;
    cancelTaskNotifications(task);
    if (res.task) taskDetail.value = res.task; else closeTaskDetailModal();
    await afterMaterialize();
    resyncNotifications();
  } catch (e) { console.error('schedule edit', e); schedEditError.value = 'Could not save the schedule.'; }
};
const editScheduledEntry = async ({ id, fields, sched, scope }) => {
  if (!userId.value) return;
  const bad = validateSchedule(sched, sched.repeat === 'never' ? getTodayId() : null); if (bad) { scheduledError.value = bad; return; }
  try { scheduledList.value = await mutateScheduled(userId.value, (l) => editEntry(l, id, fields || {}, sched, scope, getTodayId())); await afterMaterialize(); resyncNotifications(); }
  catch (e) { console.error(e); scheduledError.value = 'Could not update the scheduled task.'; }
};

// Reminders for scheduled/recurring tasks: rebuilt from scratch after any change (capped, see utils/schedNotify.js).
let notifTimer = null;
const resyncNotifications = () => {
  clearTimeout(notifTimer);
  notifTimer = setTimeout(async () => {
    if (!userId.value) return;
    const todayName = days[new Date().getDay()]?.day;
    const todayTasks = selectedDayIndex.value === new Date().getDay() ? selectedDayRoutine.value : await loadDayTasks(userId.value, todayName).catch(() => []);
    await syncScheduledNotifications({ list: scheduledList.value, todayTasks, todayStr: getTodayId() });
  }, 600);
};

// Editor: move an existing one-time task from today's list to a future date.
const scheduleExistingTask = async (index, task, { date, time }) => {
  if (blockIfLocked()) return;
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
  if (!userId.value) return;
  const e = scheduledList.value.find((x) => x.id === id);
  let scope = 'this';
  if (e?.templateId) { if (!confirm('Delete this repeating task?')) return; scope = confirm('OK = this and all future occurrences\nCancel = only this one') ? 'future' : 'this'; }
  else if (!confirm(e?.recurrence ? 'Delete this whole repeating series?' : 'Delete this scheduled task?')) return;
  try { scheduledList.value = await mutateScheduled(userId.value, (l) => deleteEntry(l, id, scope)); }
  catch (e) { console.error(e); scheduledError.value = 'Could not delete the task.'; }
};

const addNewTask = async () => {
  if (blockIfShut()) return false;
  if (!userId.value) {
    error.value = 'You must be logged in to add a task';
    return false;
  }

  if (newTask.value.title.trim() === '') {
    error.value = 'Task name cannot be empty';
    return false;
  }

  // A one-time task with a future due date belongs to that date, not to today's day doc (route it through the scheduler).
  { const fut = !newTask.value.sched?.on && newTask.value.type !== 'recurring' && !(newTask.value.selectedDays || []).length ? deferredDateFor(newTask.value.dueDate, getTodayId()) : '';
    if (fut) newTask.value = { ...newTask.value, sched: { ...blankSchedule(fut), on: true, date: fut, time: newTask.value.startTime || '' } }; }
  limitHit.value = null;
  try {
    if (!(await dailyLimitGate((newTask.value.sched?.on && newTask.value.sched.repeat === 'never' && newTask.value.sched.date) || getTodayId()))) {
      const l = limitHit.value;
      if (!l.pro && !agentAdd.value) { goUpgradeForLimit(); return false; } // free user over the daily limit: open the paywall instead of an error
      error.value = l.pro ? `Daily limit reached: ${l.limit} tasks per day on Pro.` : `Daily limit reached: free accounts can add ${l.limit} tasks per day.`;
      return false;
    }
  } catch (e) { console.error('limit check', e); error.value = 'Could not check your daily task limit, try again.'; return false; }

  // Scheduled-for-later tasks go to their own doc and do not count toward today's cap.
  if (newTask.value.sched?.on) { return await submitScheduledTask(); }

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

  // 8-hour lock: nothing can be added to the locked day (including repeating copies); before the countdown the plan count is the cap
  // (adds ARE allowed during the locked window; they are appended so the locked slots never move. Deletes stay blocked.)
  // Locked-in plan full (before the countdown): adding just works and raises the required count by one (no prompt, no block).
  // Previously this refused the add with "Raise the task count in the 8-hour card first", the reported bug.
  let planBump = null;
  if (selectedDays.some((d) => d.day === days[selectedDayIndex.value].day) && isToday(selectedDayIndex.value) && !isDayLocked(days[selectedDayIndex.value].day) && planFull()) {
    planBump = raisedPlan(eh.plan.value, countableIndexes(selectedDayRoutine.value || [], eh.phaseInfo.value.dayKey || '').length, 1);
  }

  const labels =
      typeof newTask.value.labels === 'string'
          ? newTask.value.labels.split(',').map(label => label.trim())
          : [];

  const task = {
    title: newTask.value.title.trim(),
    completed: false,
    important: false,
    anonymous: !!newTask.value.anonymous, // Anonymous for boss: managers/pals see it as 'Anonymous task' (name + notes hidden server-side)
    visibility: 'public', // Public = managers & pals can see it; 'private' = only you
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
  Object.assign(task, estimateFor(task)); // heuristic complexity / minutes / points (estimateMin stays as typed; the server re-locks at countdown start)
  { const ap = _clampPts(newTask.value.aiPoints); if (ap) { task.points = ap; task.pointsSource = 'ai'; const cx = _clampCx(newTask.value.aiComplexity); if (cx) task.complexity = cx; } } // assistant: Gemini-rated points

  // Parse datetime-local input if provided
  if (newTask.value.reminder?.datetime) {
    const dateObj = new Date(newTask.value.reminder.datetime);
    const date = localYMD(dateObj); // local date (UTC flipped 8PM+ reminders to the next day)
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
  const insertAt = (list, copy, dayName) => { const l = [...list]; l.splice(Number.isNaN(position) || isDayLocked(dayName) ? l.length : position, 0, copy); return l; }; // locked day: append only
  const viewDay = days[selectedDayIndex.value].day;
  const key = taskKey(task);
  if (selectedDays.some((d) => d.day === viewDay)) selectedDayRoutine.value = insertAt(selectedDayRoutine.value || [], copyFor({ day: viewDay }), viewDay);
  if (gateCache) gateCache.extra.push(task);
  pendingAdds.set(key, task);
  const hadReminder = !!task.reminder;
  newTask.value = blankTask();
  capWarning.value = false; capOverride.value = false;
  closeModal();
  error.value = '';
  lastAddPersist = trackWrite((async () => {
    try {
      await Promise.all(selectedDays.map((d) => mutateDay(d.day, (l) => (l.some((t) => taskKey(t) === key) ? l : insertAt(l, copyFor(d), d.day)))));
    } catch (e) {
      console.error('Error adding task:', e);
      selectedDayRoutine.value = (selectedDayRoutine.value || []).filter((t) => taskKey(t) !== key);
      pendingAdds.delete(key);
      if (gateCache) gateCache.extra = gateCache.extra.filter((t) => taskKey(t) !== key);
      error.value = `Could not save “${task.title}”. Please try again.`;
      alert(error.value);
      return false;
    }
    try { if (hadReminder) await scheduleNotification(task, task.reminder); } catch (e) { console.error(e); }
    fetchUserName(userId.value).then((n) => n && sendNotificationToPlayer(n, 'created')).catch(() => {});
    return true;
  })());
  if (planBump) lastAddPersist.then((ok) => ok && eh.savePlan(planBump)).catch((e) => console.warn('plan raise failed', e && e.message)); // required count +1 once the task is saved
  return true;
};
let lastAddPersist = Promise.resolve(true);

// Repeat control on task cards: keep one copy of the task (same createdAt+title) on every chosen weekday.
// Copies keep the original createdAt, so making a task recurring never counts as a new task toward the daily limit.
const setTaskRepeat = async (task, dayNames) => {
  if (!userId.value || !task) return;
  if (days.some((d) => isDayLocked(d.day))) { alert(lockedMessage()); return; } // a repeat edit rewrites copies on every weekday, including the locked one
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
    // one transaction over all 7 day docs: the series is updated atomically (no half-applied repeat after a reload)
    await trackWrite(runTransaction(db, async (tx) => {
      const refs = days.map((d) => doc(db, 'weeklyRoutines', `${userId.value}_${d.day}`));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      snaps.forEach((snap, i) => {
        const d = days[i];
        const l = snap.exists() ? snap.data().tasks || [] : [];
        const has = l.some((t) => taskKey(t) === key);
        let next = l;
        if (!want.has(d.day)) { if (!has) return; next = l.filter((t) => taskKey(t) !== key); }
        else if (has) next = l.map((t) => (taskKey(t) === key ? { ...t, ...patch } : t));
        else {
          const af = i !== selectedDayIndex.value ? activeFromForDay(i) : '';
          const { timerActive, timerEnd, timerStart, boss, ...base } = task;
          next = [...l, { ...base, ...patch, completed: false, completedAt: null, status: base.status === 'done' ? 'todo' : base.status, activeFrom: af }];
        }
        tx.set(refs[i], { tasks: next, updatedAt: serverTimestamp() }, { merge: true });
      });
    }));
  } catch (e) {
    console.error('repeat', e); Object.assign(task, prev); selectedDayRoutine.value = [...selectedDayRoutine.value];
    alert('Could not update the repeat setting. Please try again.');
  }
};



const speakDailyReport = async () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localYMD(yesterday);

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
  const todayStr = localYMD();

  if (lastSpokenDate.value !== todayStr) {
    showDailyReportPopup.value = true; // show popup
  }
});
watch(selectedDayIndex, () => {
  const todayStr = localYMD();

  if (lastSpokenDate.value !== todayStr && isToday(selectedDayIndex.value)) {
    showDailyReportPopup.value = true;
  }
});

const userCredits = ref(0);
const playDailyReport = () => {
  speakDailyReport(); // Call your existing function
  const todayStr = localYMD();
  localStorage.setItem("lastSpokenDate", todayStr);
  lastSpokenDate.value = todayStr;
  showDailyReportPopup.value = false;
};
const dismissReportPopup = () => {
  const todayStr = localYMD();
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
  if (isShutdown()) { alert(shutMessage()); return; } // edits are allowed during the locked window; only the post-day shutdown blocks them
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
    if (ev.status === 'broken' && data.streak) {
      await setDoc(streakDocRef, { ...st, updatedAt: serverTimestamp() }, { merge: true });
      // Streak lost because a day didn't count (fewer than 5 tasks / no Start Day). No -50 here: that penalty belongs to Discipline Mode deadlines only.
      if (!lossScreen.value && !localStorage.getItem(`streakLostSeen_${userId.value}_${localDateStr()}`)) lossScreen.value = { lostStreak: capStreak(data.streak), penalty: 0, reason: lostReason(data, localDateStr()), noticeOnly: true };
    }
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
  const todayStr = localYMD(now); // Current date in YYYY-MM-DD format
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localYMD(yesterday); // Yesterday's date

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



const currentDayKey = localYMD(); // Format: YYYY-MM-DD
const pointsAccumulated = ref(0);
const totalPoints = computed(() => (selectedDayRoutine?.value || []).reduce((n, t) => n + chipValues(t).points, 0)); // real per-task points (AI / estimate)



// Update points when tasks are completed
watch(
    () => selectedDayRoutine.value,
    (tasks) => {
      pointsAccumulated.value = (tasks || []).filter((task) => task.completed).reduce((n, t) => n + chipValues(t).points, 0); // real points, same as the card
    },
    { deep: true }
);




// Call checkStreak when component is mounted
onMounted(() => {

  checkStreakOnCompletion();
});
const showBackground = ref(false);
const bgApi = useBackground();
const bgPrefs = bgApi.prefs;
// Returning to the app (cold start or back from the background): bring back the music the user had on.
const resumeBgMusic = () => { try { bgApi.resumeIfWanted(); } catch (e) { /* audio is optional */ } };
const onBgVisible = () => { if (document.visibilityState === 'visible') resumeBgMusic(); };
onMounted(() => { resumeBgMusic(); document.addEventListener('visibilitychange', onBgVisible); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onBgVisible));
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
let voiceCommitted = ''; // finished phrases of the current long dictation
let voiceFinishing = false; // Done tapped on the web flow: process the transcript on the next onend
let voiceSubmitting = false;
let voiceAddFailed = false; // the last spoken task was refused (limit, strict boss, save error): keep the message visible
const liveTranscript = ref('');
const voiceBlocked = voiceInputBlocked(); // iOS shell: WKWebView has no SpeechRecognition -> mic button hidden
const hideUgc = ugcHidden();
const nativeVoiceIn = nativeSpeechAvailable(); // iOS app: on-device SFSpeechRecognizer via the local ClingVoice plugin
let nativeStop = null;
const voiceCap = nativeVoiceIn ? 'native' : typeof window !== 'undefined' && !voiceBlocked ? voiceCapability(window, navigator) : 'none';
const voiceSupported = voiceCap !== 'none';
// Initialize SpeechRecognition only if supported (every property access stays inside this guard)
if (voiceSupported && !nativeVoiceIn) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => { listening.value = true; if (!voiceAddFailed) voiceError.value = ''; }; // a mic auto-restart must not wipe a "could not add the task" message
  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    listening.value = false;
    if (event.error === 'aborted') return; // we stopped it ourselves (cancel / restart): not a failure
    if (event.error === 'no-speech' && voiceOpen.value && (voiceCommitted || pendingVoiceText)) return; // a pause mid-dictation: onend restarts
    voiceError.value = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
      : event.error === 'no-speech' ? "Didn't catch anything. Try again."
      : 'Voice input failed (' + (event.error || 'unknown') + ').';
  };
  recognition.continuous = voiceCap !== 'partial'; // hands-free: keep listening across pauses (Chrome/Edge)
  recognition.onend = () => {
    listening.value = false;
    // iOS Safari often ends without flagging a result final: use what we heard instead of dropping it.
    // Long dictation: commit what was heard in this segment and keep listening until the user taps Done.
    if (pendingVoiceText.trim()) { voiceCommitted = `${voiceCommitted} ${pendingVoiceText.trim()}`.trim(); pendingVoiceText = ''; }
    if (voiceFinishing) { voiceFinishing = false; if (voiceOpen.value && voiceCommitted.trim()) saveSpoken(voiceCommitted); else if (voiceOpen.value) voiceError.value = "Didn't catch anything. Try again."; return; }
    // Hands-free: restart after each pause until the user taps Done (iOS ends after every utterance).
    if (voiceOpen.value && !voiceError.value && voiceSupported && !voiceItems.value.length && !voiceBusy.value) setTimeout(() => { if (voiceOpen.value && !listening.value) { try { recognition.start(); } catch (e) { /* still stopping */ } } }, 250);
  };
  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const r = event.results[i];
      if (r.isFinal) { const f = r[0].transcript.trim(); if (f) voiceCommitted = `${voiceCommitted} ${/[.!?]$/.test(f) ? f : f + '.'}`.trim(); } // a pause ends a phrase: keep it, keep listening
      else interim += r[0].transcript;
    }
    pendingVoiceText = interim.trim();
    liveTranscript.value = `${voiceCommitted} ${pendingVoiceText}`.trim();
  };
} else {
  console.warn("Speech recognition not supported in this browser.");
}
// Hands-free capture: every finished phrase is split ("and then" / "next") and each part saved immediately, with a 5 s undo.
const ASSIST_UNDO_MS = 20000;
const voiceAdded = ref([]); // [{ id, title, createdAt, dayName, undoUntil }]
const voiceQueue = [];
// Every finished phrase (web webkitSpeechRecognition or native SFSpeechRecognizer) is interpreted into items
// (tasks / reminders / scheduled blocks) and shown on the confirm sheet; nothing is saved until the user confirms.
const voiceItems = ref([]); const voiceBusy = ref(false); const voiceSource = ref('');
const saveSpoken = async (text) => {
  pendingVoiceText = '';
  if (!voiceOpen.value || !String(text || '').trim() || voiceBusy.value || voiceItems.value.length) return;
  liveTranscript.value = text.trim();
  if (recognition) { try { recognition.stop(); } catch (e) { /* not started */ } }
  voiceBusy.value = true;
  try {
    const u = auth.currentUser;
    // AI only for Pro users who already allowed AI (no consent modal mid-dictation); otherwise the on-device parser.
    const aiOk = !!(u && rcProActive(u.uid)) && await hasAiConsent();
    const ask = aiOk ? async (task, input) => ((await ensureAiConsent()) ? askAi(task, input) : null) : null;
    const { items, source } = await interpretSpeech(text, { ask });
    voiceSource.value = source;
    voiceItems.value = items.length ? items : splitSpokenTasks(text).map((title) => ({ type: 'task', title, date: getTodayId(), start: '', durationMin: 0, remindAt: '' }));
    if (!voiceItems.value.length) voiceError.value = "Didn't catch a task. Try again.";
  } finally { voiceBusy.value = false; }
};
// Confirmed items go through the normal flows: addNewTask (daily limit, strict boss, points) for tasks and scheduled blocks,
// saveReminder (device notification, not a task, no limit) for reminders.
const confirmVoiceItems = async (items) => {
  if (voiceBusy.value) return; voiceBusy.value = true; voiceError.value = '';
  const done = [];
  try {
    for (const it of items) {
      if (!it.title || !String(it.title).trim()) continue;
      let ok = false;
      if (it.type === 'reminder') {
        const r = await saveReminder({ title: it.title.trim(), remindAt: it.remindAt }, { schedule: scheduleLocal });
        ok = r.ok; if (!ok) error.value = r.error;
      } else {
        newTask.value = { ...blankTask(), title: it.title.trim(), startTime: it.start || '', estimateMin: it.durationMin || '',
          ...(it.type === 'schedule' ? { sched: { ...blankSchedule(it.date), on: true, date: it.date, time: it.start || '09:00' } }
            : deferredDateFor(it.date, getTodayId()) ? { sched: { ...blankSchedule(it.date), on: true, date: it.date, time: it.start || '' } } : {}) };
        capOverride.value = true;
        ok = !!(await addNewTask()) && (it.type === 'schedule' || !!deferredDateFor(it.date, getTodayId()) || (await lastAddPersist));
        capOverride.value = false;
      }
      if (!ok) { voiceError.value = `${it.title}: ${error.value || 'could not be saved.'}`; break; }
      done.push(it);
      voiceAdded.value = [...voiceAdded.value, { id: `${Date.now()}-${Math.random()}`, title: `${it.type === 'reminder' ? '⏰ ' : it.type === 'schedule' ? '📅 ' : ''}${it.title}`, undoUntil: 0 }];
    }
    voiceItems.value = voiceItems.value.filter((x) => !done.includes(x));
    if (!voiceItems.value.length && !voiceError.value) setTimeout(() => { if (!voiceItems.value.length) cancelVoiceInput(); }, 1200);
  } finally { voiceBusy.value = false; }
};
const relistenVoice = () => { voiceItems.value = []; startVoiceInput(); };
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
      if (!ok) {
        voiceAddFailed = true;
        voiceError.value = error.value || 'Could not add the task.';
        if (recognition) { try { recognition.stop(); } catch (e) { /* not started */ } }
        continue;
      }
      const saved = [...(selectedDayRoutine.value || [])].filter((x) => x.title === title).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))[0];
      const entry = { id: `${Date.now()}-${Math.random()}`, title, createdAt: saved?.createdAt, dayName: days[selectedDayIndex.value]?.day, undoUntil: Date.now() + UNDO_MS };
      voiceAdded.value = [...voiceAdded.value, entry];
      setTimeout(() => { voiceAdded.value = voiceAdded.value.map((e) => (e.id === entry.id ? { ...e, undoUntil: 0 } : e)); }, UNDO_MS);
    }
  } catch (e) {
    console.error('Voice task failed:', e);
    voiceAddFailed = true;
    voiceError.value = 'Could not add the task. Please try again.';
  } finally { voiceSubmitting = false; }
};
// Today's list stays hidden until Start Day: tell the user where the spoken task went instead of leaving them guessing.
const voiceHint = computed(() => (voiceAdded.value.length && isViewingToday.value && !canViewSelectedDayTasks.value ? "Saved. Today's list is hidden until you tap Start Day." : ''));
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
  voiceAddFailed = false;
  voiceOpen.value = false; voiceItems.value = [];
  if (nativeStop) { const st = nativeStop; nativeStop = null; (st.cancel || st)(); }
  voiceCommitted = ''; voiceFinishing = false;
  if (recognition) { try { recognition.abort(); } catch (e) { /* not started */ } }
  listening.value = false;
  voiceOpen.value = false;
  voiceError.value = '';
  liveTranscript.value = '';
  pendingVoiceText = '';
  voiceAdded.value = voiceAdded.value.filter((e) => e.undoUntil > Date.now()); // keep live undo chips as toasts
};

// Done while listening: stop and organise the whole dictation into items for the review list.
const finishVoiceInput = () => {
  if (!voiceOpen.value || voiceBusy.value || voiceItems.value.length) return;
  if (nativeStop) { const st = nativeStop; nativeStop = null; (st.finish || st)(); return; } // native onFinal -> saveSpoken
  const all = `${voiceCommitted} ${pendingVoiceText}`.trim();
  if (recognition && listening.value) { voiceFinishing = true; try { recognition.stop(); } catch (e) { voiceFinishing = false; } }
  if (!voiceFinishing) { if (all) saveSpoken(all); else voiceError.value = "Didn't catch anything. Try again."; }
};
const startVoiceInput = () => {
  voiceAddFailed = false; voiceCommitted = ''; voiceFinishing = false;
  voiceAdded.value = [];
  voiceOpen.value = true; // always show the modal, even when recognition is unavailable
  liveTranscript.value = '';
  voiceError.value = '';
  pendingVoiceText = '';
  voiceItems.value = [];
  if (nativeVoiceIn) {
    startNativeSpeech({ onPartial: (t) => { liveTranscript.value = t; }, onFinal: (t) => saveSpoken(t), onError: (m) => { voiceError.value = m; }, onState: (v) => { listening.value = v; } })
      .then((stop) => { nativeStop = stop; });
    return;
  }
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
  if (blockIfShut()) return false;
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
  const dateStr = localYMD(today); // local YYYY-MM-DD
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
  if (!(await ensureAiConsent())) { closeWorkoutModal(); return; } // one-time OpenAI data-sharing consent (declined => nothing is sent)
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
  "Mon": [{ "title": "...", "type": "recurring", "completed": false }],
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
        tasks: tasks.map(({ youtubeURL, ...task }) => ({ // AI-invented video links are dropped (they are fabricated / dead)
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

    alert("✅ Your AI workout routine is ready! It is a general suggestion, not medical advice. Check with a doctor before starting a new exercise program.");
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

  // 8-hour day: the list is open while a plan is waiting for its tasks and while the window runs (no separate Start Day press needed)
  if (eh.phase.value === 'running' || eh.phase.value === 'before' || eh.phase.value === 'ready') return true;

  // Today requires Start Day
  return daySession.value.started && !daySession.value.ended;
});

// ─── Task planning (logic lives in @/utils/taskPlanning and @/composables) ───
watchMilestones(() => calculateCompletionPercentage(), milestones, selectedDayIndex);

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isDraggingTask = ref(false);
const reorderSettling = ref(false); // keeps entrance animations off while the DOM settles after a drop (no replay/flash)
let settleTimer = null;
const taskListEl = ref(null);
const { onPointerDown: onListPointerDown } = useSmoothReorder({
  listRef: taskListEl,
  enabled: () => reorderable.value,
  onStart: () => onDragStart(),
  onCommit: async (fromKey, toKey) => {
    const list = [...displayTasks.value];
    const fi = list.findIndex((t) => taskKey(t) === fromKey), ti = list.findIndex((t) => taskKey(t) === toKey);
    if (fi < 0 || ti < 0) return;
    const [moved] = list.splice(fi, 1); list.splice(ti, 0, moved);
    onReorder(list);
    await nextTick();
  },
  onEnd: (changed) => { isDraggingTask.value = false; settleReorder(); playSound('dragEnd'); if (changed) handleDragEnd(); },
});
const settleReorder = () => { reorderSettling.value = true; clearTimeout(settleTimer); settleTimer = setTimeout(() => { reorderSettling.value = false; }, 600); };
const onDragStart = () => {
  isDraggingTask.value = true; reorderSettling.value = true;
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

// (legacy note) the old soft active-task cap
const capWarning = ref(false);
const capOverride = ref(false);
const addsToToday = () => {
  const todayName = todayDayName();
  const sel = newTask.value.selectedDays;
  return sel.length > 0 ? sel.some((d) => d.day === todayName) : isViewingToday.value;
};
// The soft "3 active tasks today" nudge was removed (it no longer blocks or shows a message); the real per-plan limit is dailyLimitGate.
const isCapBlocked = () => false;
const addAnyway = () => { capOverride.value = true; capWarning.value = false; addNewTask(); };
watch(modalOpen, (open) => { if (!open) { capWarning.value = false; capOverride.value = false; limitHit.value = null; } });

// Load summary + schedule
const todayLoad = computed(() => loadSummary(selectedDayRoutine.value, eh.dayHours.value * 60));
const schedule = computed(() => buildSchedule(selectedDayRoutine.value));
const showSchedule = ref(false);

// Inline expand (tap card) + inline field editing, saved with the task
const expandedKey = ref(null);
const toggleExpanded = (task) => {
  expandedKey.value = expandedKey.value === taskKey(task) ? null : taskKey(task);
};
const patchTask = async (index, task, patch) => {
  if (blockIfShut()) return false;
  if (patch.status === 'pending' && !task.pendingSince) patch = { ...patch, pendingSince: new Date().toISOString() }; // wait time for the morning report
  try {
    const before = { createdAt: task.createdAt, title: task.title }; // stored identity before this edit
    const dayName = days[selectedDayIndex.value].day;
    Object.assign(task, patch);
    if (patch.estimateMin !== undefined) task.estimateMin = Number(patch.estimateMin) || 0;
    let saved = patch.estimateMin !== undefined ? { ...patch, estimateMin: task.estimateMin } : patch;
    // re-estimate when the inputs change (only possible outside a running lock: estimateMin/title are locked fields there)
    if (['estimateMin', 'title', 'notes', 'priority'].some((k) => patch[k] !== undefined) && !isDayLocked(dayName)) { const e = estimateFor(task); Object.assign(task, e); saved = { ...saved, ...e }; }
    await patchStoredTask(userId.value, dayName, before, index, saved);
  } catch (e) {
    if (!lockMessage(e)) console.error('Error saving task field:', e);
    if (isLockError(e)) fetchSelectedDayRoutine();
  }
};

// ── Edit task: estimate chips (locked once the timer starts), "all repeating days" option ──
const seriesKey = ref(null);
const editTask = async (index, task, rawPatch) => {
  let patch = safeEditPatch(rawPatch); // an edit never completes a task
  if (!Object.keys(patch).length) return;
  const dayName = days[selectedDayIndex.value].day;
  const lockedHit = patchTouchesLocked(patch);
  if (isDayLocked(dayName) && lockedHit.length) { alert(`${lockedMessage()} (${lockedHit.join(', ')})`); return; }
  const oldKey = taskKey(task);
  if (patch.estimateMin !== undefined) {
    patch.estimateMin = cleanEstimate(patch.estimateMin);
    // editable during lock-in and after play: a started timer's end time moves with the new duration
    if (timerStarted(task)) patch = { ...patch, ...retimePatch(task, patch.estimateMin) };
  }
  await patchTask(index, task, patch);
  if (patch.timerEndTime && task.timerActive && !task.timerPausedAt) { try { scheduleTimerDone(task); } catch (e) { /* notification reschedule best-effort */ } }
  if (seriesKey.value === oldKey) {
    const sp = seriesPatch(patch);
    if (Object.keys(sp).length) await applyToSeries(oldKey, sp);
    if (patch.title) seriesKey.value = taskKey(task);
  }
};
// Copy the editable fields to every other weekday copy of a repeating task (one transaction).
const applyToSeries = async (key, sp) => {
  const others = days.filter((d, i) => i !== selectedDayIndex.value);
  if (others.some((d) => isDayLocked(d.day)) && patchTouchesLocked(sp).length) { alert(lockedMessage()); return; }
  try {
    await trackWrite(runTransaction(db, async (tx) => {
      const refs = others.map((d) => doc(db, 'weeklyRoutines', `${userId.value}_${d.day}`));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      snaps.forEach((snap, i) => {
        if (!snap.exists()) return;
        const l = snap.data().tasks || [];
        if (!l.some((t) => taskKey(t) === key)) return;
        tx.update(refs[i], { tasks: l.map((t) => (taskKey(t) === key ? { ...t, ...sp } : t)), updatedAt: serverTimestamp() });
      });
    }));
  } catch (e) { console.error('series edit', e); alert('Saved for this day, but the other repeating days could not be updated.'); }
};

// ── Rollover notice (in-app once per rollover + device notification when it runs) ──
const rollover = ref(null);
const rolledKeys = ref([]);
const notifyRollover = (titles) => {
  if (!titles || !titles.length) return;
  scheduleLocal(`rollover:${getTodayId()}:${titles.join('|')}`, { title: 'Tasks moved to tomorrow', body: rolloverNotifBody(titles), at: new Date(Date.now() + 2000), route: '/home', type: 'rollover' });
};
watch([selectedDayRoutine, isViewingToday, userId], () => {
  if (!isViewingToday.value || !userId.value || typeof localStorage === 'undefined') return;
  const p = pendingRollover(selectedDayRoutine.value, loadSeen(localStorage, userId.value));
  if (p) rollover.value = p;
});
const dismissRollover = () => { if (rollover.value) markSeen(localStorage, userId.value, rollover.value.ids); rollover.value = null; };
const highlightRollover = () => {
  rolledKeys.value = rollover.value ? rollover.value.tasks.map(taskKey) : [];
  dismissRollover();
  setTimeout(() => { rolledKeys.value = []; }, 8000);
};

// Subtasks: saved through the same patch path; optionally complete the parent when all are done
const onSubtaskPatch = async (index, task, patch) => {
  if (blockIfShut()) return false;
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
        notifyRollover(picked.map((t) => t.title));
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
    if (!lockMessage(e)) console.error('Shutdown failed:', e);
  } finally {
    shutdownBusy.value = false;
  }
};

// ── 8-hour day: sync with the server, auto-start the locked window, keep the card's task list ──
const ehTasksCache = ref([]);
const ehTasks = computed(() => (isToday(selectedDayIndex.value) || selectedDayLocked.value ? selectedDayRoutine.value : ehTasksCache.value));
// timed tasks: any add / edit / reschedule / delete / complete on today's list re-plans the on-device pings (debounced)
watch(selectedDayRoutine, () => { if (isToday(selectedDayIndex.value)) resyncNotifications(); }, { deep: true });
watch(selectedDayRoutine, (l) => { if (isToday(selectedDayIndex.value) || selectedDayLocked.value) ehTasksCache.value = [...(l || [])]; }, { deep: true });
// Scheduled notifications: resync on any schedule/today-list change (declared after selectedDayRoutine to avoid TDZ).
watch(scheduledList, resyncNotifications);
watch(() => selectedDayRoutine.value.map((t) => `${t.scheduledId || ''}:${t.completed ? 1 : 0}:${t.time || ''}`).join(','), resyncNotifications);
watch(userId, (u) => { if (u) syncAfterAuth(); }, { immediate: true }); // also saves the wake time picked in onboarding if the account has no plan yet
const ehStartError = ref('');
let ehStarting = false;
// Legacy per-day session: opened quietly when the 8-hour window starts (so End Day / shutdown / stats keep working as before).
const ensureLegacyDayStarted = async () => {
  if (!userId.value || (daySession.value.started && !daySession.value.ended)) return;
  const now = new Date();
  await setDoc(doc(db, 'userSettings', userId.value), { daySessions: { [getTodayId()]: { started: true, ended: false, startTime: serverTimestamp(), endTime: null, updatedAt: serverTimestamp() } } }, { merge: true });
  daySession.value = { started: true, ended: false, startTime: now, endTime: null, startedAtText: formatSessionTime(now), endedAtText: '' };
};
// Morning flow (replaces the old auto-start at the wake time / when the task list matched the plan):
// on the first open of a new day (phase 'ready', no lock today) ask "How many hours will you dedicate today?" (3..12h, half hours,
// preselected to the last choice or 8), then "Are you sure? Your day will end at H:MM". The countdown starts ONLY on Confirm
// (end = confirm time + hours, frozen for the day). Nothing starts by itself any more.
const dayPromptOpen = ref(false);
const ehBusy = ref(false);
const lockInToday = computed(() => lockIn.value.enabled && lockIn.value.skipDate !== (eh.phaseInfo.value.dayKey || ''));
const openDayPrompt = () => { if (lockInToday.value && eh.phase.value === 'ready' && !eh.lock.value && isToday(selectedDayIndex.value)) { ehStartError.value = ''; dayPromptOpen.value = true; } };
const maybeShowDayPrompt = () => {
  if (!userId.value || !lockInToday.value || eh.phase.value !== 'ready' || eh.lock.value || dayPromptOpen.value || !isToday(selectedDayIndex.value)) return;
  const dk = eh.phaseInfo.value.dayKey || '';
  if (!dk || promptSeenFor() === dk) return; // once per day; the card's Start button reopens it
  markPromptSeen(dk); openDayPrompt();
};
const confirmDayStart = async (hours) => {
  if (ehStarting) return;
  if (!lockInToday.value) { ehStartError.value = lockIn.value.enabled ? 'Lock-in is skipped for today.' : 'Lock-in is off. Turn it on in Settings (Profile > Preferences).'; return; }
  ehStarting = true; ehBusy.value = true; ehStartError.value = '';
  try {
    await setDayLengthHours(hours); // remembered as next morning's preselection (users/{uid}.dayLengthHours + localStorage)
    await lastAddPersist; // the server counts what is stored: wait for any pending add
    await eh.startNow(hours);
    dayPromptOpen.value = false;
    await ensureLegacyDayStarted().catch((e) => console.warn('day session:', e));
    await fetchSelectedDayRoutine();
  } catch (e) { ehStartError.value = e.code === 'no-tasks' ? 'Add at least one task first, then confirm.' : (e.message || 'Could not start the countdown'); }
  finally { ehStarting = false; ehBusy.value = false; }
};

// ── ClingNote assistant (AssistantSheet): tool calls run through the same handlers as the buttons above ──
const todayTasksForTarget = computed(() => (isViewingToday.value ? selectedDayRoutine.value || [] : []));
// required day points: the locked boss target while the day runs, else the projection from today's tasks + chosen hours
const dayRequiredPts = computed(() => requiredPoints({ lock: eh.running.value ? eh.lock.value : null, tasks: todayTasksForTarget.value, hours: eh.hoursPref.value, stats: eh.stats.value }));

// ---- Boss coach: spoken reactions, focus check-ins, overbooked warning, missed-streak roast (in-app only, respect the Boss voice toggle) ----
const bossReact = (kind, title = '') => { if (voMuted.value || document.hidden) return; speakLive(reactionLine({ kind, title, seed: Date.now() })); };
const onceToday = (k) => { const day = localDateStr(); try { if (localStorage.getItem(k) === day) return false; localStorage.setItem(k, day); } catch (e) { /* ignore */ } return true; };
watch(streakStatus, (st) => { let last = null; try { last = localStorage.getItem('cn.boss.roast'); } catch (e) { /* ignore */ }
  if (shouldRoast(st, localDateStr(), last) && onceToday('cn.boss.roast')) setTimeout(() => bossReact('missed'), 2500); });
const focusSpoken = new Map(); // task key -> Set(marks)
const focusTick = () => {
  const t = (selectedDayRoutine.value || []).find((x) => x && x.timerActive && x.timerEndTime && !x.timerPausedAt);
  if (!t) { if (focusLive) { focusLive = false; clingNative.endFocusActivity(); } return; }
  const end = new Date(t.timerEndTime).getTime(); const k = `${taskKey(t)}|${end}`;
  if (!focusLive || focusLive !== k) { focusLive = k; clingNative.startFocusActivity(t.title, end); }
  const total = Math.max(1, Math.round((end - new Date(t.timerStartedAt || Date.now()).getTime()) / 60000));
  const spoken = focusSpoken.get(k) || new Set(); const m = dueMark(checkinMarks(total), end - Date.now(), spoken);
  if (m != null) { spoken.add(m); focusSpoken.set(k, spoken); if (!voMuted.value && !document.hidden) speakLive(checkinLine(m, t.title)); }
};
let focusLive = false; let focusIv = null;
onMounted(() => { focusIv = setInterval(focusTick, 15000); });
onBeforeUnmount(() => { clearInterval(focusIv); });
watch(() => [eh.running.value, isViewingToday.value, (selectedDayRoutine.value || []).length], () => {
  if (!eh.running.value || !isViewingToday.value) return;
  const r = overbooked(selectedDayRoutine.value || [], Math.round(eh.remainingMs.value / 60000));
  if (r.over && onceToday('cn.boss.overbooked')) { error.value = r.line; if (!voMuted.value && !document.hidden) speakLive(r.line); }
});
// ---- App lock (Screen Time shield) ----
const lockUnlockedDay = ref((() => { try { const p = JSON.parse(localStorage.getItem(PENALTY_KEY) || '[]'); return p.length ? p[p.length - 1].day : ''; } catch (e) { return ''; } })());
const lockEnabled = () => { try { return localStorage.getItem(LOCK_PREF) === '1'; } catch (e) { return false; } };
let lockOn = null;
const syncAppLock = async () => {
  if (!lockAvailable() || !isViewingToday.value) return;
  const st = await clingLock.status();
  const want = shouldShield({ enabled: lockEnabled(), running: eh.running.value, endMs: eh.lock.value && eh.lock.value.endMs, selectionCount: st.selectionCount || 0,
    earned: pointsAccumulated.value || 0, required: dayRequiredPts.value || 0, openTasks: (selectedDayRoutine.value || []).filter((t) => t && !t.completed && t.status !== 'wontdo').length,
    unlockedToday: lockUnlockedDay.value === localDateStr() });
  if (want && lockOn !== eh.lock.value.endMs) { lockOn = eh.lock.value.endMs; await clingLock.startLock(lockOn, 'ClingNote lock-in'); }
  else if (!want && (lockOn || st.locked)) { lockOn = null; await clingLock.stopLock(); }
};
watch(() => [eh.running.value, pointsAccumulated.value, dayRequiredPts.value, streakProgress.value, lockUnlockedDay.value], () => { syncAppLock(); });
// ---- Siri / Shortcuts / Action Button "Add task" queue ----
const drainIntents = async () => { if (!nativeAvailable()) return; const r = await clingNative.takeIntents(); for (const it of (r.items || [])) {
  if (!it || !it.title) continue; try { const snap = await assistantExecutor.snapshot(); const v = validateCall('create_tasks', { items: [{ title: String(it.title).slice(0, 120), ...(/^\d{2}:\d{2}$/.test(it.time || '') ? { start: it.time } : {}) }] }, snap);
    if (v.ok) await assistantExecutor.run('create_tasks', v.args); } catch (e) { console.error('siri add', e.message); } } };
const onIntentVisible = () => { if (!document.hidden) { drainIntents(); syncAppLock(); } };
onMounted(() => { setTimeout(drainIntents, 1500); document.addEventListener('visibilitychange', onIntentVisible); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onIntentVisible));
watch(dayRequiredPts, (n) => { if (isViewingToday.value && isNativeIOS()) import('@/utils/widgetSync').then((m) => m.setWidgetDayTarget(n)).catch(() => {}); }, { immediate: true });
const openAssistant = (listen = false) => {
  if (userId.value) loadAssistant(userId.value);
  if (!isViewingToday.value && todayIdx.value >= 0) selectedDayIndex.value = todayIdx.value; // the assistant works on today's list
  assistantListen.value = !!listen; askOpen.value = true;
};
// Assistant extras: read-only week snapshot (today = live list; other days one getDoc each, stale old-week completions shown as open).
const agentWeek = async (untilToday) => {
  const out = [];
  for (let i = 0; i < 7; i++) {
    if (untilToday && i > todayIdx.value) break;
    let tasks = [];
    if (i === todayIdx.value && isViewingToday.value) tasks = selectedDayRoutine.value;
    else { try { const snap = await getDoc(doc(db, 'weeklyRoutines', `${userId.value}_${days[i].day}`)); tasks = snap.exists() ? (snap.data().tasks || []) : []; } catch (e) { tasks = []; } }
    out.push({ day: days[i].day, tasks: (tasks || []).map((t) => (isStaleCompletion(t, i) ? { ...t, completed: false } : t)) });
  }
  return out;
};
const agentIdx = (task) => { const i = realIndex(task); if (i < 0) throw new Error('That task is no longer in today\'s list.'); return i; };
const assistantExecutor = createAssistantExecutor({
  tasks: () => todayTasksForTarget.value,
  today: () => getTodayId(),
  pro: () => rcProActive(auth.currentUser?.uid) || !!(gateCache && gateCache.pro),
  limitRemaining: async () => {
    const g = gateCache && Date.now() - gateCache.at < 60000 ? gateCache : await fetchGateData();
    const r = checkDailyLimit(g.pro, getTodayId(), [...g.lists, g.extra, [...pendingAdds.values()]], scheduledList.value || []);
    return Math.max(0, (Number(r.limit) || 5) - (Number(r.count) || 0));
  },
  stats: () => ({ streak: streak.value, points: pointsAccumulated.value, hours: eh.hoursPref.value,
    target: eh.lock.value ? eh.lock.value.target : previewDayTarget(todayTasksForTarget.value, eh.hoursPref.value, eh.stats.value).target,
    lock: eh.lock.value ? { endsAt: eh.endsLabel.value || '', earned: eh.lock.value.earned || 0, target: eh.lock.value.target || 0 } : null,
    upcoming: scheduledList.value || [], settings: { sounds: !!soundEnabled.value, boss_voice: !voMuted.value, spoken_replies: !!assistantSession.speak.value }, route: '/home' }),
  addTask: async (it) => {
    error.value = '';
    if (it.type === 'reminder') { const r = await saveReminder({ title: it.title, remindAt: it.remindAt }, { schedule: scheduleLocal }); return { ok: r.ok, error: r.error }; }
    newTask.value = { ...blankTask(), title: it.title, startTime: it.start || '', estimateMin: it.durationMin || '', priority: it.priority || newTask.value.priority,
      aiPoints: it.points || 0, aiComplexity: it.complexity || 0,
      ...(it.type === 'schedule' ? { sched: { ...blankSchedule(it.date), on: true, date: it.date, time: it.start || '09:00', ...(it.repeat ? { repeat: it.repeat, days: it.days || [] } : {}) } }
        : deferredDateFor(it.date, getTodayId()) ? { sched: { ...blankSchedule(it.date), on: true, date: it.date, time: it.start || '' } } : {}) };
    capOverride.value = true; agentAdd.value = true;
    try {
      const ok = !!(await addNewTask()) && (it.type === 'schedule' || !!deferredDateFor(it.date, getTodayId()) || (await lastAddPersist));
      const lim = limitHit.value;
      if (ok && it.type !== 'schedule' && !deferredDateFor(it.date, getTodayId())) { // same Undo chip the old mic gave (kept longer: the sheet may still be open)
        const saved = [...(selectedDayRoutine.value || [])].filter((x) => x.title === it.title).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)))[0];
        const entry = { id: `${Date.now()}-${Math.random()}`, title: it.title, createdAt: saved?.createdAt, dayName: days[selectedDayIndex.value]?.day, undoUntil: Date.now() + ASSIST_UNDO_MS };
        voiceAdded.value = [...voiceAdded.value, entry];
        setTimeout(() => { voiceAdded.value = voiceAdded.value.map((e) => (e.id === entry.id ? { ...e, undoUntil: 0 } : e)); }, ASSIST_UNDO_MS);
      }
      return ok ? { ok: true } : { ok: false, error: lim ? `Daily limit reached (${lim.limit}/day).` : error.value || 'not saved', limit: !!lim };
    } finally { capOverride.value = false; agentAdd.value = false; newTask.value = blankTask(); }
  },
  editTask: (task, patch) => editTask(agentIdx(task), task, patch),
  reschedule: async (task, { date, time }) => {
    if (date) return scheduleExistingTask(agentIdx(task), task, { date, time });
    return editTask(agentIdx(task), task, { startTime: time });
  },
  weekStats: async () => ({ ...weekStats(await agentWeek(true), { streak: streak.value, bestStreak: bestStreak.value }), pointsToday: pointsAccumulated.value, pointsNeededToday: dayRequiredPts.value || 0, streakDoneToday: streakProgress.value, streakLeft: Math.max(0, DAILY_STREAK_MIN - streakProgress.value), habits: habitSummary(loadHabits(userId.value), localDateStr()) }),
  findTasks: async ({ query, day }) => searchTasks(await agentWeek(false), scheduledList.value || [], { query, day }),
  suggestNext: async () => suggestNext(selectedDayRoutine.value, { minutesLeft: eh.running.value ? Math.round(eh.remainingMs.value / 60000) : null }),
  snooze: async (task, minutes) => { const t = snoozeTo(new Date(), minutes); if (t.nextDay) return { error: 'That runs past midnight: reschedule it to tomorrow instead.' }; await editTask(agentIdx(task), task, { startTime: t.time }); return t; },
  addSubtasks: (task, items) => editTask(agentIdx(task), task, { subtasks: items.reduce((l, x) => addSubtask(l, x), subtasksOf(task)) }),
  rollUnfinished: async () => { if (!isViewingToday.value) return { moved: 0 }; const to = tomorrowStr(); let moved = 0;
    for (const t of rollCandidates(selectedDayRoutine.value)) { const i = agentIdx(t); if (i < 0) continue; await scheduleExistingTask(i, t, { date: to, time: t.startTime || '' }); moved++; }
    return { moved }; },
  autoSchedule: async ({ writeCalendar }) => {
    const acc = await clingNative.calendarAccess(); const now = new Date(); const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const busy = acc.granted ? busyToDay((await clingNative.busy(now.getTime(), d1)).busy, now) : [];
    const untilMin = (() => { const [h, m] = String(disciplineSettings.value.deadline || '22:00').split(':').map(Number); return (h || 22) * 60 + (m || 0); })();
    const r = autoSchedule(selectedDayRoutine.value.filter((t) => !t.completed && t.status !== 'wontdo'), busy, { nowMin: now.getHours() * 60 + now.getMinutes(), untilMin: Math.max(untilMin, now.getHours() * 60 + 60) });
    for (const p of r.plan) { if (p.task.startTime === p.start) continue; await editTask(agentIdx(p.task), p.task, { startTime: p.start });
      if (writeCalendar && acc.granted) { const [h, m] = p.start.split(':').map(Number); const [eh2, em] = p.end.split(':').map(Number); const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        await clingNative.addEvent({ title: p.task.title, startMs: b.getTime() + (h * 60 + m) * 60000, endMs: b.getTime() + (eh2 * 60 + em) * 60000 }); } }
    return { ...r, calendar: acc.granted ? 'used' : 'no access (free time = whole day)' };
  },
  habit: async (name, a) => { const uid = userId.value; let list = loadHabits(uid);
    if (name === 'add_habit') { list = addHabit(list, a.name); saveHabits(uid, list); return { habits: habitSummary(list) }; }
    if (name === 'log_habit') { const r = logHabit(list, a.name, localDateStr(), a.done); if (!r.habit) return { error: `No habit called ${a.name}. Add it first?` }; saveHabits(uid, r.list); return { habit: habitSummary([r.habit], localDateStr())[0] }; }
    return { habits: habitSummary(list, localDateStr()) }; },
  placeReminder: async ({ title, place, saveHere }) => { const KEYP = `cn.places.${userId.value}`; let places = {}; try { places = JSON.parse(localStorage.getItem(KEYP) || '{}') || {}; } catch (e) { /* ignore */ }
    if (saveHere || !places[place]) { const here = await clingNative.currentLocation(); if (!here || here.error || !Number.isFinite(here.lat)) return { error: nativeAvailable() ? `I couldn't get your location${here && here.error ? ` (${here.error})` : ''}. Be at ${place} and say "save this place as ${place}".` : 'Place reminders need the iPhone app.' };
      if (!saveHere && !places[place]) return { error: `I don't know where "${place}" is yet. Are you there now? Then ask me to save this place as ${place}.` };
      places[place] = { lat: here.lat, lng: here.lng }; try { localStorage.setItem(KEYP, JSON.stringify(places)); } catch (e) { /* ignore */ } }
    const p = places[place]; const r = await clingNative.addGeofence({ id: `${place}-${Date.now()}`, lat: p.lat, lng: p.lng, radius: 150, body: title, repeats: false });
    return r.error ? { error: r.error } : { ok: true }; },
  appLock: async (action) => {
    if (!lockAvailable()) return { error: 'App lock is not available in this version yet.' };
    if (action === 'pick_apps') { const a0 = await clingLock.requestAuthorization(); if (a0.status !== 'approved') return { error: 'Screen Time permission was not given.' }; const r = await clingLock.pickApps(); if (r.saved) { try { localStorage.setItem(LOCK_PREF, '1'); } catch (e) { /* ignore */ } } syncAppLock(); return { saved: !!r.saved, apps: r.apps || 0 }; }
    if (action === 'turn_off') { try { localStorage.removeItem(LOCK_PREF); } catch (e) { /* ignore */ } await clingLock.stopLock(); return { summary: 'App lock off' }; }
    if (action === 'emergency_unlock') { await clingLock.stopLock(); const day = localDateStr(); let pen = []; try { pen = JSON.parse(localStorage.getItem(PENALTY_KEY) || '[]'); } catch (e) { /* ignore */ }
      pen.push({ day, points: EMERGENCY_PENALTY, at: Date.now() }); try { localStorage.setItem(PENALTY_KEY, JSON.stringify(pen.slice(-60))); } catch (e) { /* ignore */ }
      lockUnlockedDay.value = day; return { summary: `Unlocked. Penalty: ${EMERGENCY_PENALTY} extra points owed today.`, penalty: EMERGENCY_PENALTY }; }
    return { ...(await clingLock.status()), enabled: lockEnabled() };
  },
  deleteTask: (task) => deleteTask(agentIdx(task), { skipConfirm: true }),
  complete: (task) => toggleTaskCompletion(agentIdx(task)),
  startTimer: async (task, minutes) => { selectedTimerTaskIndex.value = agentIdx(task); selectedTimerHours.value = Math.floor(minutes / 60); selectedTimerMinutes.value = minutes % 60; await startTimer(); },
  bossCheckin: async (task, on) => { if (!!task.boss !== !!on) await setBoss(agentIdx(task), task); },
  startDay: async (hours) => { await confirmDayStart(hours); return ehStartError.value ? { error: ehStartError.value } : { target: eh.lock.value && eh.lock.value.target }; },
  setHours: (hours) => setDayLengthHours(hours), // the ONE "hours today" setting (also the DayStartPrompt preselection); the agent only calls it when asked
  setSetting: (k, on) => {
    if (k === 'sounds') { if (!!soundEnabled.value !== on) toggleSound(); }
    else if (k === 'boss_voice') setVoMuted(!on);
    else if (k === 'spoken_replies') { assistantSession.speak.value = on; saveAssistant(); }
  },
  navigate: (path) => { askOpen.value = path === '/home' ? askOpen.value : false; return _proRouter.push(path); },
  post: async ({ text, includeStats }) => {
    const u = auth.currentUser; if (!u) return { error: 'Not signed in.' };
    const C = await import('@/composables/useCommunity'); const cu = await import('@/utils/community');
    let prefs = {}; try { prefs = await C.loadPrefs(u.uid); } catch (e) { /* ignore */ }
    const eula = Number(prefs.eulaVersion) >= cu.EULA_VERSION || localStorage.getItem(`cm.eula.${u.uid}`) === String(cu.EULA_VERSION);
    if (!eula) return { error: 'The user must accept the Community rules first: open the Community page once.' };
    let name = cu.displayNameOf(u.displayName); let avatar = cu.safeAvatar(u.photoURL);
    try { const { getPublicProfile } = await import('@/composables/usePublicProfile'); const p = await getPublicProfile(u.uid); if (p) { name = cu.displayNameOf(p.name || u.displayName); avatar = cu.safeAvatar(p.avatarURL || u.photoURL); } } catch (e) { /* ignore */ }
    const stats = includeStats ? await C.loadTodayStats(u.uid).catch(() => null) : null;
    await C.createPost({ uid: u.uid, name, avatar }, { text, stats });
    return { ok: true };
  },
});
watch(userId, (u) => { if (u) loadDayLengthHours().catch(() => {}); }, { immediate: true });
// Share today's done/wrapped state with the status pill (EightHourChrome), so it never says "Ready to start" after the day is over.
watch(() => [isViewingToday.value, !!daySession.value.ended, dayTasks.value.length, completedTaskCount.value], ([today, ended, n, done]) => {
  if (!today) return;
  homeDay.value = { dayKey: getTodayId(), wrapped: ended, allDone: n > 0 && done >= n };
}, { immediate: true });
watch(userId, (u) => { if (u) loadLockIn(true).then(maybeShowDayPrompt).catch(() => {}); }, { immediate: true });
// "Skip lock-in today" (start-day prompt): this date only, stored on users/{uid}.lockInSkipDate; the day still starts normally.
const skipLockIn = async () => {
  const dk = eh.phaseInfo.value.dayKey || ''; if (!userId.value || !dk) return;
  dayPromptOpen.value = false;
  try { await skipLockInToday(userId.value, dk); await ensureLegacyDayStarted(); } catch (e) { console.warn('skip lock-in:', e); }
};
watch([() => eh.phase.value, () => eh.phaseInfo.value.dayKey, userId, selectedDayIndex, () => lockInToday.value], maybeShowDayPrompt, { immediate: true });
</script>


<style scoped>
.rollover-banner { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; padding: 10px 12px; border-radius: 14px; background: linear-gradient(90deg,#fff7ed,#fef3c7); border: 1px solid #fcd34d; }
.rollover-banner__body { flex: 1; text-align: left; background: none; border: 0; font-weight: 600; font-size: 13.5px; color: #92400e; cursor: pointer; }
.rollover-banner__x { background: none; border: 0; font-size: 20px; color: #92400e; cursor: pointer; padding: 0 4px; }
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
.bg-pill { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1.5px solid #6b8cff; background: rgba(79,111,240,.22); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.bg-pill:active { transform: scale(.97); }
.bg-pill-sub { font-weight: 400; font-size: 11px; color: #b9c6ee; }
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
  background: linear-gradient(180deg, rgba(7,13,28,.25), rgba(7,13,28,0) 40%, var(--c-bg) 96%), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 30% / cover no-repeat; }
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
.app-root .task-play.task-play.task-play { color: #fff; }
.app-root .task-play.task-play.task-play::before { width: 40px; height: 40px; border: 0; background: linear-gradient(180deg, #3D8BFF, #1F5FEA); box-shadow: 0 3px 10px rgba(47,111,255,.4); }
.app-root .task-play--primary.task-play--primary.task-play--primary::before { box-shadow: 0 0 0 3px rgba(61,139,255,.28), 0 6px 18px rgba(47,111,255,.55); }
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
.app-root .content-wrap.content-wrap { padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
.app-root .fab-group.fab-group { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }

/* ══ v3: pixel-close mockup layout ══ */
body.home-v2 .app-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 60; background: transparent; border-bottom: 0; pointer-events: none; }
.app-shell .app-topbar-inner > *, .app-shell .app-topbar aside { pointer-events: auto; }
@media (min-width: 768px) { body.home-v2.sidebar-open .app-topbar { left: 16rem; } }
.app-root .calendar-section.calendar-section { padding-top: calc(60px + env(safe-area-inset-top)); }
.app-root .hero-scene.hero-scene { top: 0; height: calc(360px + env(safe-area-inset-top)); left: -16px; right: -16px;
  background: linear-gradient(180deg, rgba(7,13,28,.15), rgba(7,13,28,0) 35%, rgba(7,13,28,.55) 75%, var(--c-bg) 98%), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 30% / cover no-repeat; }
.app-root .hero.hero { display: flex; align-items: flex-start; justify-content: space-between; padding: 0; }
.app-root .hero-date.hero-date { margin: 0; font-size: 13px; letter-spacing: .16em; color: #5E9BFF; }
.app-root .hero-title.hero-title { font-size: 36px; line-height: 42px; margin: 4px 0 2px; }
.app-root .hero-sub.hero-sub { margin: 0; font-size: 16px; color: #B7C2DA; }
.app-root .hero.hero { position: relative; }
.app-root .hero-text { flex: 1 1 100%; min-width: 0; }
.app-root .hero-menu.hero-menu { position: absolute; right: 0; top: 22px; display: flex; gap: 8px; }
.app-root .hero-menu-btn.hero-menu-btn { width: 44px; height: 44px; border-radius: 50%; font-size: 14px; color: #C9D5F0; background: rgba(12,22,48,.55); border: 1px solid rgba(90,120,190,.35); box-shadow: none; position: relative; }
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
.app-root .toggle-visibility.toggle-visibility { width: 44px; min-width: 44px; height: 44px; min-height: 44px; }
.app-root .task-card.task-card.task-card { min-height: 58px; padding: 8px 8px 8px 4px; }
.app-root .task-card--next.task-card--next.task-card--next { min-height: 72px; }
.app-root .tasks-list.tasks-list > * + * { margin-top: 7px; }
.app-root .task-cat { width: 36px; height: 36px; font-size: 16px; border-radius: 10px; }
.app-root .task-title.task-title.task-title { font-size: 15px; line-height: 20px; }
.app-root .task-sub.task-sub { font-size: 13px; }
.app-root .task-upnext { font-size: 10px; }

/* ══ Mobile UI fixes: task-card controls, smooth reorder, bottom bar alignment ══ */
/* 1) Right-hand controls: one aligned row [repeat][play][more], pinned top-right; the points badge is small so it never changes the row height */
.app-root .task-right.task-right.task-right { top: 8px; right: 6px; height: 44px; display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
.app-root .task-repeat-wrap { display: flex; align-items: center; justify-content: center; width: 32px; height: 44px; }
.app-root .task-repeat.task-repeat { width: 32px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1; opacity: .6; }
.app-root .task-repeat.task-repeat--on { opacity: 1; }
.app-root .task-play-wrap { position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: 0 0 44px; }
.app-root .task-play.task-play.task-play { width: 44px; height: 44px; }
.app-root .task-pts.task-pts { position: static; display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(245,197,66,.16); font-size: 11px; line-height: 14px; pointer-events: none; white-space: nowrap; }
.app-root .task-more.task-more.task-more { width: 32px; height: 44px; flex: 0 0 32px; }
.app-root .task-body > .task-upnext, .app-root .task-body > .task-title-row, .app-root .task-body > .task-sub { padding-right: 122px; }
.app-root .task-avatar.task-avatar.task-avatar { width: 22px; margin-right: -6px; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
@media (max-width: 400px) {
  .app-root .task-more.task-more.task-more { width: 32px; }
  .app-root .task-body > .task-upnext, .app-root .task-body > .task-title-row, .app-root .task-body > .task-sub { padding-right: 118px; }
}
/* 2) Smooth reorder (useSmoothReorder): transforms are written inline by JS; CSS only styles lift/settle.
   No CSS transition targets transform on list items outside JS control, so nothing fights the drag loop. */
.app-root .tasks-list > * { position: relative; }
.app-root.reorder-active .tasks-list > * { animation: none !important; }
.app-root .tasks-list.reorder-live { user-select: none; -webkit-user-select: none; }
.app-root .tasks-list > .reorder-lift { box-shadow: 0 16px 36px rgba(0,0,0,.45), 0 0 0 1px rgba(124,156,255,.35); cursor: grabbing; }
.app-root .tasks-list > .reorder-settle { animation: reorderSettle .5s cubic-bezier(0.22,1,0.36,1) !important; }
@keyframes reorderSettle {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124,156,255,.55); }
  35% { transform: scale(1.012); box-shadow: 0 0 0 4px rgba(124,156,255,.28); }
  65% { transform: scale(.996); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124,156,255,0); }
}
@media (prefers-reduced-motion: reduce) { .app-root .tasks-list > .reorder-settle { animation: none !important; } }
.app-root .drag-handle { touch-action: none; }
/* 3) Bottom area: stats bar centered in a tidy grid, fab bar aligned to the same 16px gutters, safe-area aware */
.app-root .stats-bar.stats-bar.stats-bar { flex-wrap: wrap; gap: 8px 0; padding: 10px; }
.app-root .stats-bar .stat { flex: 1 1 0; min-width: 0; justify-content: center; text-align: center; padding: 2px 6px; }
.app-root .stats-bar .stat > div { min-width: 0; }
.app-root .stats-bar .wrap-btn { flex: 1 0 100%; justify-content: center; margin-top: 2px; min-height: 44px; }
@media (min-width: 768px) { .app-root .stats-bar .wrap-btn { flex: 0 0 auto; margin: 0 0 0 8px; } .app-root .stats-bar .stat { justify-content: flex-start; text-align: left; } .app-root .stats-bar.stats-bar.stats-bar { flex-wrap: nowrap; } }
.app-root .done-section, .app-root .sched { padding-left: 0; padding-right: 0; }
.app-root .fab-group.fab-group { left: 0; right: 0; padding-left: max(16px, calc((100vw - 560px) / 2 + 16px)); padding-right: max(16px, calc((100vw - 560px) / 2 + 16px)); padding-top: var(--sp-4, 16px); padding-bottom: calc(12px + env(safe-area-inset-bottom)); gap: 12px; justify-content: center; align-items: center; pointer-events: none; }
.app-root .fab-group.fab-group > * { pointer-events: auto; }
.app-root .content-wrap.content-wrap { padding-bottom: calc(150px + env(safe-area-inset-bottom)); }
/* In the tab shell, .app-shell--tabs already pads for the tab bar + floating buttons: no second 150px gap under Scheduled. */
.app-shell--tabs .app-root .content-wrap.content-wrap { padding-bottom: 12px; }
/* Animated background sits behind the content (z -1): the page/shell backgrounds go transparent so the same #070D1C html background shows through. */
/* !important beats index.html's inline launch-flash <body style=background>; html keeps #070D1C underneath. */
body:has(.app-root.has-bg-anim), body:has(.app-root.has-bg-anim) #app { background: transparent !important; }
.app-shell.app-shell--home:has(.app-root.has-bg-anim), .app-root.has-bg-anim.has-bg-anim { background: transparent; }
/* Status-bar scrim: scrolled content (e.g. the streak line) never shows under the notch / Dynamic Island. */
.app-root .safe-top-scrim { position: fixed; top: 0; left: 0; right: 0; height: env(safe-area-inset-top, 0px); z-index: 59; pointer-events: none;
  background: linear-gradient(180deg, #070D1C 0%, #070D1C 78%, rgba(7,13,28,.0) 100%); }

/* ══ Compact task cards v2: title + actions on row 1, category · estimate · points on row 2, extras on one truncated line ══ */
.app-root .task-card.task-card.task-card { min-height: 0; padding: 6px 6px 6px 4px; gap: 6px; }
.app-root .task-card--next.task-card--next.task-card--next { min-height: 0; }
.app-root .task-cat.task-cat { width: 30px; height: 30px; font-size: 13px; border-radius: 9px; }
.app-root .task-avatar.task-avatar.task-avatar { height: 44px; }
.app-root .task-check.task-check.task-check { width: 44px; height: 44px; margin: 0 -6px; font-size: 22px; }
.app-root .task-left.task-left.task-left { gap: 2px; }
.app-root .task-repeat-wrap.task-repeat-wrap { width: 0; height: 0; position: absolute; right: 0; top: 44px; }
.app-root .task-edit.task-edit { width: 44px; height: 44px; margin: 0; border: 0; background: none; color: #A78BFA; font-size: 13px; border-radius: 10px; }
.app-root .task-edit--open.task-edit--open { background: #7c3aed; color: #fff; }
.app-root .task-right.task-right.task-right { top: 2px; right: 2px; gap: 0; }
.app-root .task-more.task-more.task-more { width: 44px; flex: 0 0 44px; }
.app-root .task-body.task-body.task-body { row-gap: 2px; column-gap: 6px; }
.app-root .task-body > .task-upnext, .app-root .task-body > .task-title-row { padding-right: 134px; }
.app-root .task-body > .task-title-row { min-height: 22px; }
.app-root .task-body > .task-sub.task-sub { order: 2 !important; flex: 0 0 auto; padding-right: 0; font-size: 12.5px; }
.app-root .task-body > .task-chips.task-chips { order: 3; flex: 0 1 auto; flex-wrap: wrap; }
.app-root .task-body > .task-meta-row.task-meta-row { order: 4; flex: 0 0 auto; }
.app-root .task-body > .task-extras { order: 5; flex: 0 0 100%; }
.app-root .task-pts.task-pts { padding: 1px 6px; font-size: 10.5px; }
.app-root .task-body .chip { line-height: 16px; padding: 0 6px; font-size: 11px; }
.app-root .task-upnext { line-height: 12px; }
.app-root .task-title-row .task-private, .app-root .task-title-row .task-repeat-badge { border: 0; padding: 0; margin: 0; font-size: 12px; text-transform: none; }
.app-root .importance-btn.importance-btn::before { inset: -12px -15px; }
/* Voice button sits bottom-left above the footer tab bar; the global Create-task FAB is bottom-right. */
.app-root .fab-group.fab-group.fab-group--voice-only { left: max(16px, calc((100vw - 540px) / 2 + 16px)); right: auto; width: auto; padding: 0; background: none; bottom: calc(var(--tabbar-h, 64px) + 14px + env(safe-area-inset-bottom)); }
</style>
