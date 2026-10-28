<template>
                <div
                    ref="cardEl"
                    class="task-card"
                    @mousedown="onCardDown"
                    @click="onCardTap"
                    @touchstart.passive="onPressStart" @touchend="onPressEnd" @touchmove.passive="onPressEnd"
                    @contextmenu.prevent="$emit('edit')"
                    :class="{
                    'task-card--completed': task.completed && isTodayTab,
                    'task-card--important': task.important,
                    'task-card--menu': moreOpen,
                    'task-card--next': upNext,
                    'task-card--completing': completing,
                    'task-card--rolled': highlight
                  }"
                >
                  <!-- Left: drag handle, completion circle, category tile -->
                  <div class="task-left">
                    <div class="task-avatar drag-handle" :class="{ 'drag-handle--disabled': dragDisabled }"
                         :title="dragDisabled ? 'Reordering is off while a sort or filter is active (or on days other than today)' : 'Drag to reorder'"
                         :aria-disabled="dragDisabled ? 'true' : 'false'" :aria-label="'Task ' + (index + 1) + ', drag to reorder'">
                      <i class="fas fa-grip-vertical"></i>
                    </div>
                    <button v-if="isTodayTab" ref="checkEl" @click="onCheck" class="task-check" :aria-label="task.completed ? 'Mark not done' : 'Mark done'" :class="{ 'task-check--done': task.completed, 'task-check--pop': completing }">
                      <i v-if="!completing" :class="task.completed ? 'fas fa-check-circle' : 'far fa-circle'"></i>
                      <svg v-else class="check-draw" viewBox="0 0 24 24" aria-hidden="true">
                        <circle class="check-draw__disc" cx="12" cy="12" r="10.5" />
                        <path class="check-draw__tick" d="M7 12.5l3.2 3.2L17 9" />
                      </svg>
                    </button>
                    <div class="task-cat" :class="'task-cat--' + cat.tone" aria-hidden="true"><i :class="'fas ' + cat.icon"></i></div>
                  </div>

                  <!-- Center: main content -->
                  <div class="task-body">
                    <p v-if="upNext" class="task-upnext">Up next</p>
                    <div class="task-title-row">

                      <span
                          class="task-title"
                          :class="{ 'task-title--done': task.completed && isTodayTab }"
                          data-test="task-title-edit" title="Tap to edit" @click="$emit('edit')"
                      >
                        {{ task.title }}
                      </span>
                      <button v-if="repeatInfo && !task.completed" type="button" class="task-repeat-toggle" :class="{ 'is-on': repeatInfo.on, 'is-pending': repeatInfo.pending, 'is-pop': repeatPop }" data-test="repeat-toggle"
                          :aria-pressed="repeatInfo.on ? 'true' : 'false'" :aria-label="repeatInfo.on ? `Repeat on (${repeatInfo.label}). Tap to stop repeating` : 'Repeat off. Tap to repeat daily'"
                          :title="repeatInfo.on ? repeatInfo.label : 'Tap to repeat'" @click.stop="onRepeatTap"><span class="task-repeat-glyph" aria-hidden="true">🔁</span></button>
                      <span v-else-if="isRepeating" class="task-repeat-badge" data-test="repeat-badge" :title="'Repeats: ' + repeatLabel" :aria-label="'Repeats ' + repeatLabel">🔁</span>
                      <span v-if="task.anonymous === true && task.visibility !== 'private'" class="task-private task-anon" data-test="anon-label" title="Name hidden from manager: managers see it as 'Anonymous task'" aria-label="Name hidden from manager">🕶️</span>
                      <span v-if="task.visibility === 'private'" class="task-private" data-test="private-label" title="Private: only you can see this task" aria-label="Private">🔒</span>
                      <TimerRing v-if="hasRing(task)" :task="task" />
                      <span v-if="task.youtubeURL" class="task-attachment" title="Video">🎥</span>
                      <span v-if="task.imageURL" class="task-attachment" title="Image">🖼️</span>
                      <span v-if="task.fileURL" class="task-attachment" title="File">📄</span>
                    </div>

                    <p class="task-sub" :title="cat.label + ' · ' + whenText">{{ cat.label }}<template v-if="!est.minutes"> · {{ whenText }}</template></p>

                    <div class="task-meta-row">
                      <span class="task-pts" title="Points for completing this task" data-test="task-pts">+{{ est.points }} pts</span>

                      <span v-if="task.completed && isTodayTab" class="task-status task-status--done">Complete</span>
                      <span v-else-if="task.status === 'pending'" class="task-status task-status--pending" :title="task.pendingOn ? 'Pending on ' + task.pendingOn : 'Pending'">Pending</span>
                      <button @click="$emit('toggle-important')" class="importance-btn" :title="task.important ? 'Important' : 'Mark important'" :aria-label="task.important ? 'Unmark important' : 'Mark important'" :aria-pressed="task.important ? 'true' : 'false'">
                        <i :class="task.important ? 'fas fa-fire task-fire--on' : 'fas fa-fire task-fire--off'"></i>
                      </button>
                                    </div>

                    <!-- Planning chips -->
                    <div class="task-chips">
                      <span class="chip chip--est" data-test="est-chips" :title="'Estimate: ' + est.minutes + ' min' + (est.computed ? ' (estimated)' : '')">{{ fmtMin(est.minutes) }}</span>
                      <span v-if="task.priority && task.priority !== 'low'" class="chip" :class="'chip--' + task.priority">{{ task.priority }}</span>
                      <span v-if="task.status && !['todo', 'pending', 'active'].includes(task.status)" class="chip">{{ task.status }}</span>
                      <span v-if="task.scheduledFor" class="chip chip--due" :class="{ 'chip--overdue': task.scheduledFor < todayYmd }">{{ dueBadge(task, todayYmd) }}</span>
                      <span v-if="schedText" class="chip chip--sched" :class="{ 'chip--overdue': schedLate }" data-test="sched-label">{{ schedText }}<template v-if="schedLate"> · Overdue</template></span>
                      <span v-else-if="task.dueDate" class="chip">Due {{ task.dueDate }}</span>
                                            <span v-if="task.startTime" class="chip">🕒 {{ formatClock(toMinutes(task.startTime)) }}<template v-if="estimateOf(task)"> – {{ formatClock(toMinutes(task.startTime) + estimateOf(task)) }}</template></span>
                    </div>
                    <div v-if="subtaskProgress(task).total" class="task-chips">
                      <span class="chip chip--subtasks" :class="{ 'chip--subtasks-done': subtaskProgress(task).done === subtaskProgress(task).total }" title="Subtasks done">☑ {{ subtaskProgress(task).done }}/{{ subtaskProgress(task).total }}</span>
                      <span v-if="!task.boss" class="sub-bar" role="progressbar" :aria-valuenow="subtaskPercent(task)" aria-valuemin="0" aria-valuemax="100" :aria-label="'Subtasks ' + subtaskPercent(task) + '% done'"><span class="sub-bar-fill" :style="{ width: subtaskPercent(task) + '%' }"></span></span>
                    </div>
                    <div v-if="task.boss && isTodayTab" class="boss-bar" :title="'Challenge HP ' + bossHp(task) + '%'">
                      <span class="boss-label">🎯 CHALLENGE</span>
                      <div class="boss-hp" role="progressbar" :aria-valuenow="bossHp(task)" aria-valuemin="0" aria-valuemax="100"><div class="boss-hp-fill" :style="{ width: bossHp(task) + '%' }"></div></div>
                      <span class="boss-hp-num">{{ bossHp(task) }} HP</span>
                    </div>
                    <!-- Secondary info: one truncated line of icons -->
                    <div v-if="hasExtras" class="task-extras" data-test="task-extras" :title="extrasTitle">
                      <span v-if="reminderVisible" class="task-reminder">⏰ {{ formatShortDate(task.reminder.date) }} {{ formatTime(task.reminder.time) }}</span>
                      <span v-if="task.carriedFrom" class="task-rolled" data-test="rolled-tag" title="Moved from yesterday">↪︎</span>
                      <span v-if="task.status === 'pending' && task.pendingOn" class="task-next task-pending-on">⏳ {{ task.pendingOn }}</span>
                      <span v-if="task.nextAction" class="task-next">→ {{ task.nextAction }}</span>
                      <span v-for="(label, i) in labelList" :key="'l' + i" @click="$emit('toggle-label', label)" class="label-pill label-pill--sm" :class="{ 'label-pill--active': activeLabels.includes(label) }">{{ label }}</span>
                      <span v-if="task.notes && !expanded" class="task-note-preview">📝 {{ task.notes }}</span>
                    </div>
                  </div>

                  <!-- Right: coin + actions -->
                  <div class="task-right">
                    <div class="task-repeat-wrap" @click.stop>
                      <button v-if="false" type="button" class="task-repeat" :class="{ 'task-repeat--on': isRepeating }" :title="isRepeating ? 'Repeats: ' + repeatLabel : 'Make recurring'" aria-label="Repeat settings" @click="repeatOpen = !repeatOpen">🔁</button>
                      <div v-if="repeatOpen" class="repeat-pop" data-test="repeat-pop">
                        <button type="button" data-test="repeat-opt-daily" @click="pickRepeat(ALL)">Every day</button>
                        <button type="button" data-test="repeat-opt-weekdays" @click="pickRepeat(WEEKDAYS)">Weekdays</button>
                        <div class="repeat-days">
                          <label v-for="d in ALL" :key="d"><input type="checkbox" :value="d" v-model="customDays" />{{ d }}</label>
                        </div>
                        <button type="button" data-test="repeat-opt-custom" @click="pickRepeat(customDays)">Save days</button>
                        <button type="button" data-test="repeat-opt-none" @click="pickRepeat([])">Don't repeat</button>
                      </div>
                    </div>
                    <button type="button" class="task-edit" data-test="edit-btn" :class="{ 'task-edit--open': expanded }" :aria-label="expanded ? 'Close edit' : 'Edit task'" :title="expanded ? 'Close edit' : 'Edit task'" @click.stop="$emit('edit')">
                      <i class="fas fa-pen"></i>
                    </button>
                    <button type="button" class="task-chevron" :class="{ 'task-chevron--open': expanded }" aria-label="Show details"
                        :aria-expanded="expanded ? 'true' : 'false'" :title="expanded ? 'Hide details' : 'Show details'" @click.stop="$emit('toggle-expand')">
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="task-play-wrap">
                      <button type="button" class="task-play" :class="{ 'task-play--primary': upNext }" title="Start focus timer" aria-label="Start focus timer" @click.stop="$emit('timer')">
                        <i class="fas fa-play"></i>
                      </button>
                    </div>
                    <button type="button" class="task-more" :class="{ 'task-more--open': moreOpen }" title="More actions" aria-label="More actions"
                        :aria-expanded="moreOpen ? 'true' : 'false'" @click.stop="moreOpen = !moreOpen">
                      <i class="fas fa-ellipsis-h"></i>
                    </button>

                    <div v-show="moreOpen" class="task-actions" @click.stop>
                      <button @click="$emit('toggle-expand'); moreOpen = false" class="action-btn" title="Details" aria-label="Show details">📝</button>
                      <button type="button" @click="repeatOpen = !repeatOpen; moreOpen = false" class="action-btn" data-test="repeat-btn" :class="{ 'action-btn--on': repeatOnAny }" :title="repeatOnAny ? repeatText : 'Make recurring'" aria-label="Repeat settings">🔁</button>
                      <button @click="$emit('open-reminder')" class="action-btn" title="Reminder" aria-label="Add reminder">📅</button>
                      <button @click="$emit('transfer')" class="action-btn" title="Transfer" aria-label="Transfer to another day">🔄</button>
                      <button @click="$emit('video')" class="action-btn" title="Video" aria-label="Attach video">🎥</button>
                      <button @click="fileInput && fileInput.click()" class="action-btn" title="Attach file" aria-label="Attach file">📎</button>
                      <input type="file" ref="fileInput" accept="image/*,.pdf,.doc,.docx,.txt" @change="$emit('upload', $event)" class="hidden-input" />
  <!--                    <button @click="showTimerModal = true" class="action-btn" title="Timer">⏱️</button>-->
                      <button v-if="canSkip" type="button" @click="$emit('skip-today'); moreOpen = false" class="action-btn" data-test="skip-today" title="Skip today (no streak penalty; the series continues)" aria-label="Skip today">⏭️</button>
                      <button @click="$emit('wont-do')" class="action-btn action-btn--warn" title="Won't do" aria-label="Mark as won't do">🚫</button>
                      <button @click="$emit('delete')" class="action-btn action-btn--danger" title="Delete" aria-label="Delete task">🗑️</button>
                    </div>
                  </div>

                  <!-- Notification toast -->
                  <div v-if="showNotification" class="task-toast">Saved ✓</div>
                  <div v-if="transferNotification" class="task-toast task-toast--info">{{ transferNotification }}</div>
                                    <div v-if="expanded" class="task-expand edit-panel" data-test="edit-panel">
                      <p v-if="dayLocked" class="lock-hint" data-test="lock-hint">🔒 Locked in: you can still edit the name, estimate and timer. Deleting and adding stay locked.</p>
                      <label class="mini-field"><span>Name</span>
                        <input type="text" class="field-input" data-test="edit-title" :value="task.title" maxlength="140"
                               @change="$event.target.value.trim() && $emit('patch', { title: $event.target.value.trim() })" /></label>
                      <div class="mini-field"><span>Estimate (min)</span>
                        <p v-if="timerLocked" class="field-hint" data-test="timer-lock-hint">⏱️ Changing the estimate adjusts the running timer.</p>
                        <div class="est-chips" role="group" aria-label="Time estimate" data-test="est-edit">
                          <button v-for="m in ESTIMATE_CHIPS" :key="m" type="button" class="adj-chip" :class="{ on: Number(task.estimateMin) === m }"
                                  :data-test="'est-chip-' + m" @click="$emit('patch', { estimateMin: m })">{{ m }}</button>
                          <input type="number" min="1" max="1440" step="5" class="field-input est-custom" data-test="est-custom" placeholder="Custom"
                                 :value="ESTIMATE_CHIPS.includes(Number(task.estimateMin)) ? '' : (task.estimateMin || '')" @change="cleanEstimate($event.target.value) && $emit('patch', { estimateMin: cleanEstimate($event.target.value) })" />
                        </div>
                        <small class="field-hint">{{ est.points }} points (auto from the estimate{{ estLocked ? ', locked' : '' }})</small></div>
                      <div class="edit-row">
                        <button type="button" class="adj-chip" :class="{ on: task.important }" data-test="edit-important" @click="$emit('toggle-important')">{{ task.important ? '★ Important' : '☆ Mark important' }}</button>
                        <button type="button" class="adj-chip" data-test="edit-reminder" @click="$emit('open-reminder')">⏰ {{ task.reminder?.date ? 'Change reminder' : 'Add reminder' }}</button>
                        <button type="button" class="adj-chip" data-test="edit-repeat" @click="repeatOpen = !repeatOpen">🔁 {{ repeatOnAny ? repeatText : 'Repeat' }}</button>
                        <button v-if="canSkip" type="button" class="adj-chip" data-test="edit-skip-today" @click="$emit('skip-today')">⏭ Skip today</button>
                        <button type="button" class="adj-chip" @click="$emit('open-detail')">⤢ Full view</button>
                      </div>
                      <label v-if="isRepeating" class="series-opt" data-test="edit-series"><input type="checkbox" :checked="allOccurrences" @change="$emit('series', $event.target.checked)" />
                        Apply changes to all repeating days (default: only this day)</label>
                      <div class="field-grid">
                        <label class="mini-field"><span>Status</span>
                          <select class="field-select" :value="task.status || 'todo'" @change="$emit('patch', { status: $event.target.value })">
                            <option v-for="st in STATUSES" :key="st.value" :value="st.value">{{ st.label }}</option>
                          </select></label>
                        <div class="mini-field"><span>Visible to</span>
                          <div class="vis-toggle" role="group" aria-label="Who can see this task" data-test="visibility-toggle">
                            <button type="button" :class="{ on: task.visibility !== 'private' }" :aria-pressed="task.visibility !== 'private' ? 'true' : 'false'" title="Your managers and pals can see this task" @click="$emit('patch', { visibility: 'public' })">Public</button>
                            <button type="button" :class="{ on: task.visibility === 'private' }" :aria-pressed="task.visibility === 'private' ? 'true' : 'false'" title="Only you can see this task" @click="$emit('patch', { visibility: 'private' })">Private</button>
                          </div></div>
                        <div class="mini-field"><span>Hide name from manager</span>
                          <div class="vis-toggle" role="group" aria-label="Hide name from manager" data-test="anon-edit-toggle">
                            <button type="button" :class="{ on: task.anonymous !== true }" :aria-pressed="task.anonymous !== true ? 'true' : 'false'" title="Managers see the task name" @click="$emit('patch', { anonymous: false })">Named</button>
                            <button type="button" :class="{ on: task.anonymous === true }" :aria-pressed="task.anonymous === true ? 'true' : 'false'" title="Managers see 'Anonymous task' (time, status and points stay visible)" @click="$emit('patch', { anonymous: true })">🔒 Anonymous</button>
                          </div></div>
                        <label class="mini-field"><span>Priority</span>
                          <select class="field-select" :value="task.priority || 'low'" @change="$emit('patch', { priority: $event.target.value })">
                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                          </select></label>
                        <label class="mini-field"><span>Due date</span>
                          <input type="date" class="field-input" :value="task.dueDate || ''" @change="$emit('patch', { dueDate: $event.target.value })" /></label>
                        <label class="mini-field"><span>Start time</span>
                          <input type="time" class="field-input" :value="task.startTime || ''" @change="$emit('patch', { startTime: $event.target.value })" /></label>
                        <label v-if="task.status === 'pending'" class="mini-field"><span>Pending on</span>
                          <input type="text" class="field-input" :value="task.pendingOn || ''" placeholder="e.g. Apple review" @change="$emit('patch', { pendingOn: $event.target.value.trim() })" /></label>
                        <label class="mini-field"><span>Next action</span>
                          <input type="text" class="field-input" :value="task.nextAction || ''" @change="$emit('patch', { nextAction: $event.target.value.trim() })" /></label>
                      </div>
                      <button type="button" class="cal-btn" @click="addToCalendar">📅 Add to calendar</button>
                      <button v-if="isTodayTab && !task.completed" type="button" class="boss-btn" @click="$emit('set-boss')">{{ task.boss ? '✖ Remove challenge' : '🎯 Make this the evening challenge' }}</button>
                      <label class="mini-field"><span>Note</span>
                        <textarea class="field-textarea" rows="2" :value="task.notes || ''" placeholder="Quick note…" @change="$emit('patch', { notes: $event.target.value })"></textarea></label>
                      <div v-if="task.type === 'one-time' && isTodayTab && !task.completed" class="mini-field sched-field"><span>Schedule for later</span>
                        <div class="sched-row-ed">
                          <input type="date" class="field-input" :min="tomorrow" v-model="schedDate" aria-label="Schedule date" />
                          <input type="time" class="field-input" v-model="schedTime" :disabled="!schedDate" aria-label="Schedule time (optional)" />
                          <button type="button" class="btn-secondary" :disabled="!schedDate" @click="$emit('schedule', { date: schedDate, time: schedTime })">Schedule</button>
                        </div></div>
                      <SubtaskList :task="task" @change="$emit('subtask-patch', { subtasks: $event })" @toggle-auto="$emit('subtask-patch', { autoCompleteParent: $event })" />
                    </div>
                </div>
</template>

<script setup>
import { burstFrom, lightHaptic, prefersReducedMotion, COMPLETE_MS } from '@/composables/useTaskMotion';
import { bossHp } from '@/utils/discipline';
import { dueBadge, scheduleLabel, scheduledOverdue } from '@/utils/scheduling';
import { downloadTaskIcs } from '@/utils/ics';
import { isNative } from '@/utils/platform';
import { localDateStr } from '@/utils/streak';
const todayYmd = localDateStr();
const addToCalendar = async () => {
  const r = await downloadTaskIcs(props.task, todayYmd, { native: isNative() });
  if (r === 'copied') window.alert('Your phone could not open the calendar sheet, so the event details were copied. Paste them into Calendar.');
  else if (r === 'failed') window.alert('Could not add this to your calendar. Try again.');
};
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { categoryOf } from '@/utils/taskCategory';
import { STATUSES, taskKey, estimateOf, formatClock, formatDuration as formatMinutes, toMinutes } from '@/utils/taskPlanning';
import { subtaskProgress, subtaskPercent } from '@/utils/subtasks';
import { chipValues, fmtMin } from '@/utils/taskEstimate';
import { formatShortDate, formatTime, showReminder } from '@/utils/dateTime';
import TimerRing from './TimerRing.vue';
import { hasRing } from '@/utils/timerRing';
import { ESTIMATE_CHIPS, cleanEstimate, timerStarted } from '@/utils/taskEdit';
import SubtaskList from '@/components/home/SubtaskList.vue';

const props = defineProps({
  canSkip: Boolean, // routine occurrence today: "Skip today" in the ⋯ menu / edit chips
  repeatInfo: { type: Object, default: null }, // { on, label, pending } from HomeView; null = read-only badge
  upNext: { type: Boolean, default: false }, // first open task on today's list: highlighted row
  dragDisabled: { type: Boolean, default: false },
  task: { type: Object, required: true },
  index: { type: Number, required: true },
  isTodayTab: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  activeLabels: { type: Array, default: () => [] },
  now: { type: Number, default: 0 }, // ticking clock from HomeView for running task timers
  showNotification: { type: Boolean, default: false },
  transferNotification: { type: String, default: null },
  dayLocked: { type: Boolean, default: false }, // 8-hour lock on this day: title/estimate/points frozen
  highlight: { type: Boolean, default: false }, // just rolled over (tapped from the rollover banner)
  allOccurrences: { type: Boolean, default: false },
});
const emit = defineEmits(['skip-today', 'set-repeat', 'set-boss', 'toggle-expand', 'toggle-complete', 'open-detail', 'toggle-important', 'patch', 'subtask-patch',
  'toggle-label', 'open-reminder', 'transfer', 'video', 'upload', 'timer', 'wont-do', 'delete', 'schedule', 'toggle-repeat']);
// 🔁 one-tap toggle (HomeView passes repeatInfo = { on, label, pending } covering both repeat models)
const repeatPop = ref(false);
const onRepeatTap = () => { repeatPop.value = true; setTimeout(() => { repeatPop.value = false; }, 260); emit('toggle-repeat'); };
const ALL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // same keys as data.json days[].day
const WEEKDAYS = ALL.slice(1, 6);
const repeatOpen = ref(false);
const isRepeating = computed(() => (props.task.repeatDays || []).length > 1 || (props.task.type === 'recurring' && !Array.isArray(props.task.repeatDays)));
const repeatLabel = computed(() => {
  const r = props.task.repeatDays || [];
  if (r.length === 7) return 'daily';
  if (r.length === 5 && WEEKDAYS.every((d) => r.includes(d))) return 'weekdays';
  return r.length ? ALL.filter((d) => r.includes(d)).map((d) => d.slice(0, 3)).join(' ') : 'weekly';
});
// Both repeat models (legacy repeatDays + v2 templates via repeatInfo) so the menu/edit chips agree with the 🔁 toggle.
const repeatOnAny = computed(() => (props.repeatInfo ? !!props.repeatInfo.on : isRepeating.value));
const repeatText = computed(() => {
  const l = props.repeatInfo && props.repeatInfo.on ? props.repeatInfo.label : `Repeats ${repeatLabel.value}`;
  return /^repeats\b/i.test(l) ? l : `Repeats: ${l}`;
});
const customDays = ref([...(props.task.repeatDays || [])]);
const pickRepeat = (list) => { repeatOpen.value = false; emit('set-repeat', [...list]); };

const moreOpen = ref(false);
const cat = computed(() => categoryOf(props.task));
// labels may be stored as an array or a comma-separated string (older tasks); never iterate a string per character
const labelList = computed(() => { const l = props.task.labels; return (Array.isArray(l) ? l : typeof l === 'string' ? l.split(',') : []).map((x) => String(x).trim()).filter(Boolean); });
const whenText = computed(() => {
  const t = props.task; const est = estimateOf(t);
  if (est) return formatMinutes(est);
  if (t.startTime) return formatClock(toMinutes(t.startTime));
  if (t.reminder?.time) return formatTime(t.reminder.time);
  return 'Today';
});
// Close the "..." menu on Escape or any press outside the menu/its button.
const onDocDown = (e) => { if (!e.target.closest || !e.target.closest('.task-actions, .task-more')) moreOpen.value = false; };
const onDocKey = (e) => { if (e.key === 'Escape') moreOpen.value = false; };
watch(moreOpen, (open) => {
  if (open) { document.addEventListener('pointerdown', onDocDown, true); document.addEventListener('keydown', onDocKey); }
  else { document.removeEventListener('pointerdown', onDocDown, true); document.removeEventListener('keydown', onDocKey); }
});
onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDocDown, true); document.removeEventListener('keydown', onDocKey); });
const schedDate = ref('');
const schedTime = ref('');
const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();
const cardEl = ref(null);
const checkEl = ref(null);
// Completion: play the pop / tick / burst / sweep first, then tell the parent (which moves or removes the row).
const completing = ref(false);
const onCheck = () => {
  if (completing.value) return;
  if (props.task.completed || prefersReducedMotion()) { if (!props.task.completed) lightHaptic(); emit('toggle-complete'); return; }
  completing.value = true;
  lightHaptic();
  burstFrom(checkEl.value);
  setTimeout(() => { emit('toggle-complete'); completing.value = false; }, COMPLETE_MS);
};
const fileInput = ref(null); // hidden <input type=file> for this card (was a string ref on HomeView)

// Tap on the card body toggles the inline expansion, unless the tap hit an interactive element.
let downPos = null;
const onCardDown = (e) => { downPos = { x: e.clientX, y: e.clientY }; };
const onCardTap = (event) => {
  if (pressTimer === 'fired') { pressTimer = null; return; } // bound on the whole card (blank areas, chips, next-action line, coin/right side)
  if (event.target.closest('button, input, textarea, select, a, label, .task-title, .label-pill, .task-expand, .drag-handle')) return;
  // Only a click that ends a *drag-select* inside this card is ignored; a stale selection elsewhere must not block taps.
  if (downPos && Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y) > 5) {
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).length && event.currentTarget.contains(sel.anchorNode)) return;
  }
  emit('toggle-expand');
};
// past one-off reminders are hidden (display only; nothing is written)
const reminderVisible = computed(() => showReminder(props.task.reminder, new Date(props.now || Date.now())));
const hasExtras = computed(() => { const t = props.task; return !!(reminderVisible.value || t.carriedFrom || (t.status === 'pending' && t.pendingOn) || t.nextAction || labelList.value.length || (t.notes && !props.expanded)); });
const extrasTitle = computed(() => [props.task.nextAction, props.task.notes].filter(Boolean).join(' · '));
const schedText = computed(() => scheduleLabel(props.task));
const schedLate = computed(() => !!props.task?.scheduledFor && scheduledOverdue(props.task, new Date()));
const est = computed(() => chipValues(props.task));
const timerLocked = computed(() => timerStarted(props.task)); // estimate frozen once play was pressed
const estLocked = computed(() => false); // estimate/timer stay editable during lock-in and after play (end time is shifted)
// Long-press (550 ms, finger kept still) on the card opens the editor.
let pressTimer = null;
const onPressStart = (e) => { if (e.target.closest('button, input, textarea, select, a, .task-expand, .drag-handle')) return; clearTimeout(pressTimer); pressTimer = setTimeout(() => { pressTimer = 'fired'; emit('edit'); }, 550); };
const onPressEnd = () => { if (pressTimer !== 'fired') clearTimeout(pressTimer); };
</script>

<style scoped>
.task-card { flex-wrap: wrap; }
.task-card > .task-card > .task-expand { flex: 0 0 100%; order: 20; margin-left: 4px; margin-right: 4px; cursor: default; }
.task-edit { width: 28px; height: 28px; margin-right: 2px; border-radius: 10px; border: 1px solid rgba(124,58,237,.25); background: rgba(124,58,237,.08); color: #7c3aed; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; }
.task-edit--open { background: #7c3aed; color: #fff; }
.task-title { cursor: pointer; }
.task-card--rolled { box-shadow: 0 0 0 2px #f59e0b, 0 6px 18px rgba(245,158,11,.25); }
.adj-chip { border: 1px solid rgba(124,58,237,.3); background: #fff; color: #5b21b6; border-radius: 999px; padding: 5px 10px; font-size: 12.5px; font-weight: 600; cursor: pointer; min-height: 30px; }
.adj-chip.on { background: #7c3aed; color: #fff; border-color: #7c3aed; }
.adj-chip:disabled { opacity: .45; cursor: not-allowed; }
.edit-panel > .mini-field { margin-bottom: 10px; }
.est-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.est-custom { width: 84px; }
.field-hint { display: block; margin-top: 4px; font-size: 11.5px; opacity: .7; }
.edit-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
.lock-hint { font-size: 12px; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; border-radius: 10px; padding: 6px 8px; margin: 0 0 10px; }
.series-opt { display: flex; gap: 6px; align-items: center; font-size: 12.5px; margin-bottom: 10px; }
.field-input:disabled { opacity: .55; cursor: not-allowed; }
.drag-handle--disabled { opacity: .35; cursor: not-allowed !important; }
.field-input, .field-select, .field-textarea { width: 100%; box-sizing: border-box; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); padding: 6px 8px; min-height: 32px; color: var(--c-text); font-family: inherit; font-size: var(--fs-md); transition: border-color .15s, background .15s; }
.field-input:hover, .field-select:hover, .field-textarea:hover { background: var(--c-surface-2); }
.field-input:focus, .field-select:focus, .field-textarea:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); background: var(--c-bg); }
.field-textarea { min-height: 64px; resize: vertical; }
.btn-primary, .btn-secondary { font-family: inherit; font-size: var(--fs-md); font-weight: 500; border-radius: var(--r); padding: 0 12px; height: 32px; cursor: pointer; border: 1px solid transparent; transition: background .15s, border-color .15s; }
.btn-primary { background: var(--c-accent); color: var(--c-on-accent); }
.btn-primary:hover { background: var(--c-accent-hover); }
.btn-secondary { background: var(--c-surface-2); color: var(--c-text-2); }
.btn-secondary:hover { background: var(--c-border); color: var(--c-text); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

.drag { transform: rotate(2deg); }
.task-card { cursor: pointer; position: relative; display: flex; gap: var(--sp-2); align-items: flex-start; padding: var(--sp-2) var(--sp-3); background: var(--c-surface); border: 1px solid var(--c-border); border-left: 3px solid transparent; border-radius: var(--r); box-shadow: var(--shadow-1); transition: background .15s, border-color .15s; }
.task-card:hover { background: var(--c-surface-2); }
/* dim the text of a finished task, but never the controls (a see-through play button looks broken) */
.task-card--completed .task-body, .task-card--completed .task-cat { opacity: .6; }
/* opacity makes each completed card its own stacking context: lift the card whose menu is open above its siblings */
.task-card--menu { z-index: 30; }
.drag-handle { user-select: none; -webkit-user-select: none; }
.task-card--important { border-left-color: var(--c-danger); }
.task-left { display: flex; align-items: center; gap: var(--sp-2); padding-top: 2px; }
.task-avatar { width: 16px; height: 24px; background: transparent !important; display: flex; align-items: center; justify-content: center; cursor: grab; color: var(--c-text-3); font-size: var(--fs-sm); flex-shrink: 0; }
.task-avatar:hover { color: var(--c-text); }
.task-avatar:active { cursor: grabbing; }
.task-index { min-width: 16px; font-size: var(--fs-xs); color: var(--c-text-3); font-family: 'JetBrains Mono', monospace; text-align: right; }
.task-body { flex: 1; min-width: 0; cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; column-gap: var(--sp-2); row-gap: var(--sp-1); }
.task-body > * { order: 10; flex: 0 0 100%; }
.task-body > .task-title-row { order: 1; flex: 1 1 200px; }
.task-body > .task-private { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--c-text-2, #A9B4CC); border: 1px solid var(--c-border, #2A3C66); border-radius: 999px; padding: 1px 7px; margin-left: 6px; white-space: nowrap; }
.vis-toggle { display: flex; border: 1px solid var(--c-border, #2A3C66); border-radius: 10px; overflow: hidden; }
.vis-toggle button { flex: 1; padding: 7px 0; font-size: 13px; background: transparent; color: var(--c-text-2, #A9B4CC); border: 0; }
.vis-toggle button.on { background: #2F6FFF; color: #fff; font-weight: 600; }
.task-meta-row { order: 2; flex: 0 0 auto; margin: 0; }
.task-body > .task-chips { order: 3; flex: 0 0 auto; margin: 0; justify-content: flex-end; }
.task-body > .task-expand, .task-body > .task-labels { order: 20; }
.task-title-row { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.task-check { background: none; border: none; cursor: pointer; padding: 0; color: var(--c-text-3); font-size: var(--fs-lg); transition: color .15s; flex-shrink: 0; }
.task-check:hover { color: var(--c-success); }
.task-check--done { color: var(--c-success); }
.task-title { font-weight: 500; font-size: var(--fs-md); color: var(--c-text); cursor: pointer; transition: color .15s; }
.task-title:hover { color: var(--c-accent-text); text-decoration: underline; }
.task-title--done { text-decoration: line-through; color: var(--c-text-3) !important; }
.task-attachment { font-size: var(--fs-sm); }
.task-reminder { font-size: var(--fs-sm); color: var(--c-text-3); font-family: 'JetBrains Mono', monospace; }
.task-meta-row { display: flex; align-items: center; gap: var(--sp-1); }
.task-status { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .02em; padding: 0 4px; line-height: 16px; border-radius: var(--r); }
.task-status--done { background: var(--c-success-soft); color: var(--c-success); }
.task-status--pending { background: var(--c-warn-soft); color: var(--c-warn-text); }
.importance-btn { background: none; border: none; cursor: pointer; font-size: var(--fs-sm); padding: 2px; transition: transform .15s; }
.importance-btn:hover { transform: scale(1.15); }
.task-fire--on { color: var(--c-danger); }
.task-fire--off { color: var(--c-border-strong); }
.task-labels { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
.label-pill { display: inline-block; padding: 0 6px; line-height: 16px; border-radius: var(--r); font-size: var(--fs-xs); font-weight: 500; background: var(--c-surface-2); border: 1px solid var(--c-border); color: var(--c-text-2); cursor: pointer; transition: all .15s; }
.label-pill:hover { border-color: var(--c-accent); color: var(--c-accent-text); }
.label-pill--active { background: var(--c-accent-soft); border-color: var(--c-accent-line); color: var(--c-accent-text); }
.label-pill--sm { font-size: var(--fs-xs); }
.task-chevron { flex-shrink: 0; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--r); color: var(--c-text-2); cursor: pointer; font-size: var(--fs-sm); position: relative; z-index: 1; }
.task-chevron:hover { background: var(--c-border); color: var(--c-text); }
.task-chevron i { transition: transform .15s; pointer-events: none; }
.task-chevron--open i { transform: rotate(180deg); }
.task-right { display: flex; align-items: center; gap: var(--sp-2); flex-shrink: 0; padding-top: 1px; }
.coin-badge { display: flex; align-items: center; gap: var(--sp-1); }
.coin-svg { width: 14px; height: 14px; }
.coin-value { font-size: var(--fs-xs); font-weight: 600; color: var(--c-warn); font-family: 'JetBrains Mono', monospace; }
.task-actions { display: flex; flex-wrap: wrap; gap: 2px; justify-content: flex-end; max-width: 168px; opacity: .55; transition: opacity .15s; }
.task-card:hover .task-actions, .task-actions:focus-within { opacity: 1; }
.action-btn { background: transparent; border: 1px solid transparent; border-radius: var(--r); width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: var(--fs-sm); cursor: pointer; line-height: 1; transition: background .15s; }
.action-btn:hover { background: var(--c-border); }
.action-btn--warn:hover { background: var(--c-warn-soft); border-color: var(--c-warn-line); }
.action-btn--danger:hover { background: var(--c-danger-soft); border-color: var(--c-danger-line); }
.hidden-input { display: none; }
.task-toast { position: absolute; top: var(--sp-2); right: var(--sp-2); background: var(--c-success-soft); color: var(--c-success); font-size: var(--fs-sm); font-weight: 600; padding: var(--sp-1) var(--sp-2); border-radius: var(--r); border: 1px solid var(--c-success-line); box-shadow: var(--shadow-2); }
.task-toast--info { background: var(--c-accent-soft); color: var(--c-accent-text); border-color: var(--c-accent-line); }
.task-timer-left { font-size: var(--fs-sm); font-weight: 700; color: var(--c-warn); }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-2); }
.mini-field { display: flex; flex-direction: column; gap: var(--sp-1); font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); margin-bottom: var(--sp-2); }
.mini-field > :not(span) { text-transform: none; letter-spacing: 0; font-weight: 400; }
.task-chips { display: flex; flex-wrap: wrap; gap: var(--sp-1); align-items: center; }
.chip { font-size: var(--fs-xs); font-weight: 600; line-height: 16px; padding: 0 6px; border-radius: var(--r); background: var(--c-surface-2); border: 1px solid var(--c-border); color: var(--c-text-2); white-space: nowrap; text-transform: capitalize; }
.chip--high { background: var(--c-danger-soft); border-color: var(--c-danger-line); color: var(--c-danger-text); }
.chip--medium { background: var(--c-warn-soft); border-color: var(--c-warn-line); color: var(--c-warn-text); }
.chip--subtasks { background: var(--c-accent-soft); border-color: var(--c-accent-line); color: var(--c-accent-text); }
.chip--subtasks-done { background: var(--c-success-soft); border-color: var(--c-success-line); color: var(--c-success); }
.task-next { font-size: var(--fs-sm); color: var(--c-accent-text); }
.task-note-preview { font-size: var(--fs-sm); color: var(--c-text-3); }
.task-expand { margin-top: var(--sp-2); padding-top: var(--sp-3); border-top: 1px solid var(--c-border); cursor: default; }
.load-summary--over { border-color: var(--c-danger-line); }
.sched-row-ed { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.sched-row-ed .field-input { flex: 1 1 120px; width: auto; }
.sched-row-ed .btn-secondary { height: 40px; }
/* ── Compact issue-style row ── */
.task-card { align-items: center; gap: var(--sp-2); padding: 6px var(--sp-2) 6px var(--sp-1); border-radius: var(--r-lg); border-left-width: 3px; box-shadow: none; }
.task-left { padding: 0; }
.task-index { display: none; }
.task-avatar { width: 16px; height: 40px; font-size: 11px; opacity: .6; touch-action: none; }
/* iOS: bigger touch target, no callout/selection on long-press, never let the page pan from the handle */
.drag-handle { position: relative; touch-action: none !important; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
.drag-handle::before { content: ''; position: absolute; inset: -4px 0 -4px -12px; } /* grow left only: never over the done button */
.drag-handle i { pointer-events: none; }
.task-body { gap: 2px var(--sp-2); padding: 2px 0; }
.task-body > * { flex: 0 0 100%; }
.task-body > .task-title-row { order: 1; flex: 1 1 100%; }
.task-body > .task-reminder { order: 2; }
.task-body > .task-meta-row { order: 3; flex: 0 0 auto; }
.task-body > .task-chips { order: 4; flex: 0 1 auto; justify-content: flex-start; }
.task-title-row { gap: var(--sp-2); }
.task-title { font-size: var(--fs-md); font-weight: 600; line-height: 20px; word-break: break-word; }
.task-check { width: 40px; height: 40px; margin: -8px -6px -8px -4px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; color: var(--c-border-strong); }
.task-check:hover { color: var(--c-accent-text); }
.task-check--done { color: var(--c-success); }
.importance-btn { position: relative; padding: 0 2px; font-size: var(--fs-sm); }
.importance-btn::before { content: ''; position: absolute; inset: -12px -6px; }
.chip { border-radius: var(--r-pill); padding: 0 8px; line-height: 18px; font-size: var(--fs-xs); background: var(--c-surface-2); border-color: var(--c-border); color: var(--c-text-2); }
.chip--est { text-transform: none; font-variant-numeric: tabular-nums; opacity: .8; }
.task-status { border-radius: var(--r-pill); padding: 0 8px; }
.label-pill { border-radius: var(--r-pill); }
.task-right { gap: 0; padding: 0; margin-left: auto; position: static; }
.coin-badge { gap: 4px; padding: 0 var(--sp-2); height: 22px; margin-right: var(--sp-1); border-radius: var(--r-pill); background: var(--c-warn-soft); }
.coin-svg { width: 12px; height: 12px; }
.coin-value::after { content: ' pts'; }
.task-play { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; background: none; border: none; padding: 0; cursor: pointer; position: relative; font-size: 11px; color: var(--c-on-accent); }
.task-play::before { content: ''; position: absolute; width: 32px; height: 32px; border-radius: 50%; background: #2F6BFF; transition: background .15s; }
.task-play i { position: relative; margin-left: 2px; }
.task-play:hover::before { background: var(--c-accent-hover); }
.task-more, .task-chevron { width: 40px; height: 40px; border: none; background: none; border-radius: var(--r); color: var(--c-text-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: var(--fs-md); padding: 0; }
.task-more:hover, .task-chevron:hover, .task-more--open { background: var(--c-surface-2); color: var(--c-text); }
.task-actions { position: absolute; right: var(--sp-2); top: calc(100% - 4px); z-index: 20; display: flex; gap: 2px; max-width: none; opacity: 1; padding: var(--sp-1); background: var(--c-surface-2); border: 1px solid var(--c-border-strong); border-radius: var(--r-lg); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.action-btn { width: 40px; height: 40px; font-size: var(--fs-lg); border-radius: var(--r); }
.task-toast { top: -10px; }
.task-expand { margin-top: var(--sp-2); }
.field-input, .field-select, .field-textarea { min-height: 40px; }
@media (max-width: 480px) {
  .field-grid { grid-template-columns: 1fr; }
  .coin-value::after { content: ''; }
  .task-actions { left: var(--sp-2); right: var(--sp-2); justify-content: space-between; }
}
.boss-bar { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.boss-label { font-size: var(--fs-xs, .7rem); font-weight: 800; color: #b91c1c; }
.boss-hp { flex: 1; height: 8px; border-radius: 999px; background: #fee2e2; overflow: hidden; }
.boss-hp-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #b91c1c); transition: width .4s; }
.boss-hp-num { font-size: var(--fs-xs, .7rem); font-variant-numeric: tabular-nums; color: #b91c1c; }
.boss-btn { margin: 6px 0; padding: 4px 10px; border-radius: 8px; border: 1px solid #fca5a5; color: #b91c1c; background: #fff5f5; font-weight: 600; }
.chip--due { background: var(--c-primary-soft, #eef2ff); color: var(--c-primary, #4f46e5); font-weight: 600; }
.chip--overdue { background: #fee2e2; color: #b91c1c; }
.sub-bar { display: inline-block; vertical-align: middle; width: 64px; height: 6px; border-radius: 999px; background: var(--c-border, #e2e8f0); overflow: hidden; margin-left: 6px; }
.sub-bar-fill { display: block; height: 100%; background: var(--c-success, #22c55e); transition: width .3s; }
.cal-btn { margin: 6px 6px 6px 0; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--c-border, #e2e8f0); background: transparent; font-weight: 600; }
.task-repeat-wrap { position: relative; }
.task-repeat { background: none; border: 0; cursor: pointer; font-size: 15px; opacity: .45; padding: 4px; }
.task-repeat--on { opacity: 1; }
.repeat-pop { position: absolute; right: 0; top: 100%; z-index: 30; display: flex; flex-direction: column; gap: 4px; min-width: 170px; padding: 8px; border-radius: 10px; background: var(--c-surface, #111a2e); border: 1px solid rgba(255,255,255,.12); box-shadow: 0 8px 24px rgba(0,0,0,.4); }
.repeat-pop button { text-align: left; padding: 6px 8px; border-radius: 6px; border: 0; background: rgba(255,255,255,.06); color: inherit; cursor: pointer; font-size: 13px; }
.repeat-days { display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; }
.repeat-days label { display: flex; align-items: center; gap: 2px; }
.chip--sched { font-size: 11px; white-space: nowrap; }
.task-repeat-toggle { /* 44pt hit area without growing the title row */ width: 44px; height: 44px; margin: -12px -10px -12px -6px; padding: 0; flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent; vertical-align: middle; }
.task-repeat-glyph { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; font-size: 12px;
  border: 1.5px dashed rgba(100, 116, 139, .55); filter: grayscale(1); opacity: .4; transition: opacity .15s, filter .15s, background .15s, border-color .15s, transform .15s; }
.task-repeat-toggle.is-on .task-repeat-glyph { opacity: 1; filter: none; border: 1.5px solid #6366f1; background: rgba(99, 102, 241, .14); }
.task-repeat-toggle:active .task-repeat-glyph, .task-repeat-toggle.is-pop .task-repeat-glyph { transform: scale(1.25); }
.task-repeat-toggle.is-pending .task-repeat-glyph { animation: repeat-pulse .8s ease-in-out infinite alternate; }
.task-repeat-toggle:focus-visible { outline: 2px solid #6366f1; outline-offset: -6px; border-radius: 12px; }
@keyframes repeat-pulse { from { opacity: .55; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .task-repeat-glyph { transition: none; } .task-repeat-toggle.is-pending .task-repeat-glyph { animation: none; } }
.task-repeat-badge { font-size: 11px; opacity: .8; margin-left: 6px; white-space: nowrap; }

/* ── Completion animation (≈560ms, transform/opacity only) ── */
.task-check { position: relative; }
.check-draw { width: 1em; height: 1em; overflow: visible; display: block; margin: auto; }
.check-draw__disc { fill: var(--c-success, #34D399); transform-origin: 12px 12px; animation: checkDisc .42s cubic-bezier(.34,1.56,.64,1) both; }
.check-draw__tick { fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 16; stroke-dashoffset: 16; animation: checkTick .3s .14s cubic-bezier(.22,1,.36,1) forwards; }
.task-check--pop { animation: checkPop .45s cubic-bezier(.34,1.56,.64,1); }
@keyframes checkDisc { 0% { transform: scale(.2); opacity: .4; } 100% { transform: scale(1); opacity: 1; } }
@keyframes checkTick { to { stroke-dashoffset: 0; } }
@keyframes checkPop { 0% { transform: scale(1); } 40% { transform: scale(1.22); } 70% { transform: scale(.94); } 100% { transform: scale(1); } }
.task-card--completing { animation: rowGlow .56s ease-out both; }
.task-card--completing .task-title { position: relative; }
.task-card--completing .task-title::after { content: ''; position: absolute; left: 0; right: 0; top: 52%; height: 2px; border-radius: 2px; background: currentColor; opacity: .7; transform: scaleX(0); transform-origin: left center; animation: strikeSweep .32s .16s cubic-bezier(.22,1,.36,1) forwards; }
.task-card--completing .task-body { animation: rowSettle .56s ease-out both; }
@keyframes rowGlow { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } 30% { box-shadow: 0 0 0 3px rgba(52,211,153,.35), 0 0 18px rgba(52,211,153,.25); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
@keyframes strikeSweep { to { transform: scaleX(1); } }
@keyframes rowSettle { 0%, 45% { opacity: 1; transform: translateX(0); } 100% { opacity: .55; transform: translateX(3px); } }
@media (prefers-reduced-motion: reduce) { .task-card--completing, .task-card--completing .task-body, .task-check--pop, .check-draw__disc, .check-draw__tick { animation: none !important; } .check-draw__tick { stroke-dashoffset: 0; } }
/* ── Compact card (v2): one meta line, one truncated extras line ── */
.task-extras { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; font-size: 12px; color: var(--c-text-2); }
.task-extras > span { flex: 0 0 auto; }
.task-extras > .task-note-preview { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.task-extras > .task-next { max-width: 45%; overflow: hidden; text-overflow: ellipsis; }
.task-rolled { color: #f59e0b; font-weight: 700; }
.action-btn--on { background: var(--c-accent-soft); }
</style>
