<template>
                <div
                    class="task-card"
                    @mousedown="onCardDown"
                    @click="onCardTap"
                    :class="{
                    'task-card--completed': task.completed && isTodayTab,
                    'task-card--important': task.important,
                    'task-card--menu': moreOpen
                  }"
                >
                  <!-- Left: drag + avatar -->
                  <div class="task-left">
                    <div class="task-avatar drag-handle" :class="{ 'drag-handle--disabled': dragDisabled }" :style="{ background: 'grey' }"
                         :title="dragDisabled ? 'Reordering is off while a sort or filter is active (or on days other than today)' : 'Drag to reorder'"
                         :aria-disabled="dragDisabled ? 'true' : 'false'">
                      <i class="fas fa-grip-vertical"></i>
                    </div>
                    <div class="task-index">{{ index + 1 }}</div>
                  </div>

                  <!-- Center: main content -->
                  <div class="task-body">
                    <div class="task-title-row">
                      <!-- Completion toggle -->
                      <button
                          v-if="isTodayTab"
                          @click="$emit('toggle-complete')"
                          class="task-check" :aria-label="task.completed ? 'Mark not done' : 'Mark done'"
                          :class="{ 'task-check--done': task.completed }"
                      >
                        <i :class="task.completed ? 'fas fa-check-circle' : 'far fa-circle'"></i>
                      </button>

                      <span
                          class="task-title"
                          :class="{ 'task-title--done': task.completed && isTodayTab }"
                          @click="$emit('open-detail')"
                      >
                        {{ task.title.length > 28 ? task.title.slice(0, 28) + '…' : task.title }}
                      </span>
                      <span v-if="task.timerActive" class="task-timer-left">
                        ⏳  {{ taskTimeLeft(task, now) }}
                      </span>
                      <span v-if="task.youtubeURL" class="task-attachment" title="Video">🎥</span>
                      <span v-if="task.imageURL" class="task-attachment" title="Image">🖼️</span>
                      <span v-if="task.fileURL" class="task-attachment" title="File">📄</span>
                    </div>

                    <div v-if="task.reminder?.date && task.reminder?.time" class="task-reminder">
                      📅 {{ formatShortDate(task.reminder.date) }}· ⏰ {{ formatTime(task.reminder.time) }}
                    </div>

                    <div class="task-meta-row">

                      <span v-if="task.completed && isTodayTab" class="task-status task-status--done">Complete</span>
                      <span v-else-if="task.status === 'pending'" class="task-status task-status--pending" :title="task.pendingOn ? 'Pending on ' + task.pendingOn : 'Pending'">Pending</span>
                      <button @click="$emit('toggle-important')" class="importance-btn" :title="task.important ? 'Important' : 'Mark important'" :aria-label="task.important ? 'Unmark important' : 'Mark important'" :aria-pressed="task.important ? 'true' : 'false'">
                        <i :class="task.important ? 'fas fa-fire task-fire--on' : 'fas fa-fire task-fire--off'"></i>
                      </button>
                    </div>

                    <!-- Planning chips -->
                    <div v-if="estimateOf(task) || task.startTime || task.dueDate || (task.priority && task.priority !== 'low') || (task.status && task.status !== 'todo' && task.status !== 'pending')" class="task-chips">
                      <span v-if="task.priority && task.priority !== 'low'" class="chip" :class="'chip--' + task.priority">{{ task.priority }}</span>
                      <span v-if="task.status && task.status !== 'todo' && task.status !== 'pending'" class="chip">{{ task.status }}</span>
                      <span v-if="task.dueDate" class="chip">Due {{ task.dueDate }}</span>
                      <span v-if="estimateOf(task)" class="chip">⏱ {{ formatMinutes(estimateOf(task)) }}</span>
                      <span v-if="task.startTime" class="chip">🕒 {{ formatClock(toMinutes(task.startTime)) }}<template v-if="estimateOf(task)"> – {{ formatClock(toMinutes(task.startTime) + estimateOf(task)) }}</template></span>
                    </div>
                    <div v-if="subtaskProgress(task).total" class="task-chips">
                      <span class="chip chip--subtasks" :class="{ 'chip--subtasks-done': subtaskProgress(task).done === subtaskProgress(task).total }" title="Subtasks done">☑ {{ subtaskProgress(task).done }}/{{ subtaskProgress(task).total }}</span>
                    </div>
                    <div v-if="task.status === 'pending' && task.pendingOn" class="task-next task-pending-on">⏳ Pending on {{ task.pendingOn }}</div>
                    <div v-if="task.nextAction" class="task-next">→ {{ task.nextAction }}</div>
                    <div v-if="task.notes && !expanded" class="task-note-preview">📝 {{ task.notes.length > 60 ? task.notes.slice(0, 60) + '…' : task.notes }}</div>

                    <div v-if="expanded" class="task-expand">
                      <div class="field-grid">
                        <label class="mini-field"><span>Status</span>
                          <select class="field-select" :value="task.status || 'todo'" @change="$emit('patch', { status: $event.target.value })">
                            <option v-for="st in STATUSES" :key="st.value" :value="st.value">{{ st.label }}</option>
                          </select></label>
                        <label class="mini-field"><span>Priority</span>
                          <select class="field-select" :value="task.priority || 'low'" @change="$emit('patch', { priority: $event.target.value })">
                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                          </select></label>
                        <label class="mini-field"><span>Due date</span>
                          <input type="date" class="field-input" :value="task.dueDate || ''" @change="$emit('patch', { dueDate: $event.target.value })" /></label>
                        <label class="mini-field"><span>Start time</span>
                          <input type="time" class="field-input" :value="task.startTime || ''" @change="$emit('patch', { startTime: $event.target.value })" /></label>
                        <label class="mini-field"><span>Estimate (min)</span>
                          <input type="number" min="0" step="5" class="field-input" :value="task.estimateMin || ''" @change="$emit('patch', { estimateMin: Number($event.target.value) || 0 })" /></label>
                        <label v-if="task.status === 'pending'" class="mini-field"><span>Pending on</span>
                          <input type="text" class="field-input" :value="task.pendingOn || ''" placeholder="e.g. Apple review" @change="$emit('patch', { pendingOn: $event.target.value.trim() })" /></label>
                        <label class="mini-field"><span>Next action</span>
                          <input type="text" class="field-input" :value="task.nextAction || ''" @change="$emit('patch', { nextAction: $event.target.value.trim() })" /></label>
                      </div>
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

                    <!-- Labels -->
                    <div v-if="task.labels?.length" class="task-labels">
                      <span
                          v-for="(label, i) in task.labels"
                          :key="i"
                          @click="$emit('toggle-label', label)"
                          class="label-pill label-pill--sm"
                          :class="{ 'label-pill--active': activeLabels.includes(label) }"
                      >
                        {{ label }}
                      </span>
                    </div>
                  </div>

                  <!-- Right: coin + actions -->
                  <div class="task-right">
                    <button type="button" class="task-chevron" :class="{ 'task-chevron--open': expanded }" aria-label="Show details"
                        :aria-expanded="expanded ? 'true' : 'false'" :title="expanded ? 'Hide details' : 'Show details'" @click.stop="$emit('toggle-expand')">
                      <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="coin-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" class="coin-svg" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
                        <circle cx="12" cy="12" r="8" fill="#D97706"/>
                        <text x="12" y="16" font-size="10" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">$</text>
                      </svg>
                      <span class="coin-value">10</span>
                    </div>

                    <button type="button" class="task-play" title="Start Task" aria-label="Start Task" @click.stop="$emit('timer')">
                      <i class="fas fa-play"></i>
                    </button>
                    <button type="button" class="task-more" :class="{ 'task-more--open': moreOpen }" title="More actions" aria-label="More actions"
                        :aria-expanded="moreOpen ? 'true' : 'false'" @click.stop="moreOpen = !moreOpen">
                      <i class="fas fa-ellipsis-h"></i>
                    </button>

                    <div v-show="moreOpen" class="task-actions" @click.stop>
                      <button @click="$emit('open-reminder')" class="action-btn" title="Reminder" aria-label="Add reminder">📅</button>
                      <button @click="$emit('transfer')" class="action-btn" title="Transfer" aria-label="Transfer to another day">🔄</button>
                      <button @click="$emit('video')" class="action-btn" title="Video" aria-label="Attach video">🎥</button>
                      <button @click="fileInput && fileInput.click()" class="action-btn" title="Attach file" aria-label="Attach file">📎</button>
                      <input type="file" ref="fileInput" accept="image/*,.pdf,.doc,.docx,.txt" @change="$emit('upload', $event)" class="hidden-input" />
  <!--                    <button @click="showTimerModal = true" class="action-btn" title="Timer">⏱️</button>-->
                                            <button @click="$emit('wont-do')" class="action-btn action-btn--warn" title="Won't do" aria-label="Mark as won't do">🚫</button>
                      <button @click="$emit('delete')" class="action-btn action-btn--danger" title="Delete" aria-label="Delete task">🗑️</button>
                    </div>
                  </div>

                  <!-- Notification toast -->
                  <div v-if="showNotification" class="task-toast">Saved ✓</div>
                  <div v-if="transferNotification" class="task-toast task-toast--info">{{ transferNotification }}</div>
                </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { STATUSES, taskKey, estimateOf, formatClock, formatDuration as formatMinutes, toMinutes } from '@/utils/taskPlanning';
import { subtaskProgress } from '@/utils/subtasks';
import { taskTimeLeft } from '@/utils/dayStats';
import { formatShortDate, formatTime } from '@/utils/dateTime';
import SubtaskList from '@/components/home/SubtaskList.vue';

defineProps({
  dragDisabled: { type: Boolean, default: false },
  task: { type: Object, required: true },
  index: { type: Number, required: true },
  isTodayTab: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  activeLabels: { type: Array, default: () => [] },
  now: { type: Number, default: 0 }, // ticking clock from HomeView for running task timers
  showNotification: { type: Boolean, default: false },
  transferNotification: { type: String, default: null },
});
const emit = defineEmits(['toggle-expand', 'toggle-complete', 'open-detail', 'toggle-important', 'patch', 'subtask-patch',
  'toggle-label', 'open-reminder', 'transfer', 'video', 'upload', 'timer', 'wont-do', 'delete', 'schedule']);

const moreOpen = ref(false);
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
const fileInput = ref(null); // hidden <input type=file> for this card (was a string ref on HomeView)

// Tap on the card body toggles the inline expansion, unless the tap hit an interactive element.
let downPos = null;
const onCardDown = (e) => { downPos = { x: e.clientX, y: e.clientY }; };
const onCardTap = (event) => { // bound on the whole card (blank areas, chips, next-action line, coin/right side)
  if (event.target.closest('button, input, textarea, select, a, label, .task-title, .label-pill, .task-expand, .drag-handle')) return;
  // Only a click that ends a *drag-select* inside this card is ignored; a stale selection elsewhere must not block taps.
  if (downPos && Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y) > 5) {
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).length && event.currentTarget.contains(sel.anchorNode)) return;
  }
  emit('toggle-expand');
};
</script>

<style scoped>
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
.task-card--completed { opacity: .6; }
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
.task-body > .task-meta-row { order: 2; flex: 0 0 auto; margin: 0; }
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
.task-status { border-radius: var(--r-pill); padding: 0 8px; }
.label-pill { border-radius: var(--r-pill); }
.task-right { gap: 0; padding: 0; margin-left: auto; position: static; }
.coin-badge { gap: 4px; padding: 0 var(--sp-2); height: 22px; margin-right: var(--sp-1); border-radius: var(--r-pill); background: var(--c-warn-soft); }
.coin-svg { width: 12px; height: 12px; }
.coin-value::after { content: ' pts'; }
.task-play { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; background: none; border: none; padding: 0; cursor: pointer; position: relative; font-size: 11px; color: var(--c-on-accent); }
.task-play::before { content: ''; position: absolute; width: 32px; height: 32px; border-radius: 50%; background: var(--c-accent); transition: background .15s; }
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
</style>
