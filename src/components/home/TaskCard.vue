<template>
                <div
                                      class="task-card"
                    :class="{
                    'task-card--completed': task.completed && isTodayTab,
                    'task-card--important': task.important
                  }"
                >
                  <!-- Left: drag + avatar -->
                  <div class="task-left">
                    <div class="task-avatar drag-handle" :style="{ background: 'grey' }">
                      <i class="fas fa-grip-vertical"></i>
                    </div>
                    <div class="task-index">{{ index + 1 }}</div>
                  </div>

                  <!-- Center: main content -->
                  <div class="task-body" @click="onCardTap">
                    <div class="task-title-row">
                      <!-- Completion toggle -->
                      <button
                          v-if="isTodayTab"
                          @click="$emit('toggle-complete')"
                          class="task-check"
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
                      <button @click="$emit('toggle-important')" class="importance-btn" :title="task.important ? 'Important' : 'Mark important'">
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
                        <label class="mini-field"><span>Next action</span>
                          <input type="text" class="field-input" :value="task.nextAction || ''" @change="$emit('patch', { nextAction: $event.target.value.trim() })" /></label>
                      </div>
                      <label class="mini-field"><span>Note</span>
                        <textarea class="field-textarea" rows="2" :value="task.notes || ''" placeholder="Quick note…" @change="$emit('patch', { notes: $event.target.value })"></textarea></label>
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
                    <div class="coin-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" class="coin-svg" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
                        <circle cx="12" cy="12" r="8" fill="#D97706"/>
                        <text x="12" y="16" font-size="10" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">$</text>
                      </svg>
                      <span class="coin-value">10</span>
                    </div>

                    <div class="task-actions">
                      <button @click="$emit('open-reminder')" class="action-btn" title="Reminder">📅</button>
                      <button @click="$emit('transfer')" class="action-btn" title="Transfer">🔄</button>
                      <button @click="$emit('video')" class="action-btn" title="Video">🎥</button>
                      <button @click="fileInput && fileInput.click()" class="action-btn" title="Attach file">📎</button>
                      <input type="file" ref="fileInput" accept="image/*,.pdf,.doc,.docx,.txt" @change="$emit('upload', $event)" class="hidden-input" />
  <!--                    <button @click="showTimerModal = true" class="action-btn" title="Timer">⏱️</button>-->
                      <button @click="$emit('timer')" class="action-btn" title="Start Task">▶️</button>
                      <button @click="$emit('wont-do')" class="action-btn action-btn--warn" title="Won't do">🚫</button>
                      <button @click="$emit('delete')" class="action-btn action-btn--danger" title="Delete">🗑️</button>
                    </div>
                  </div>

                  <!-- Notification toast -->
                  <div v-if="showNotification" class="task-toast">Saved ✓</div>
                  <div v-if="transferNotification" class="task-toast task-toast--info">{{ transferNotification }}</div>
                </div>
</template>

<script setup>
import { ref } from 'vue';
import { STATUSES, taskKey, estimateOf, formatClock, formatDuration as formatMinutes, toMinutes } from '@/utils/taskPlanning';
import { subtaskProgress } from '@/utils/subtasks';
import { taskTimeLeft } from '@/utils/dayStats';
import { formatShortDate, formatTime } from '@/utils/dateTime';
import SubtaskList from '@/components/home/SubtaskList.vue';

defineProps({
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
  'toggle-label', 'open-reminder', 'transfer', 'video', 'upload', 'timer', 'wont-do', 'delete']);

const fileInput = ref(null); // hidden <input type=file> for this card (was a string ref on HomeView)

// Tap on the card body toggles the inline expansion, unless the tap hit an interactive element.
const onCardTap = (event) => {
  if (event.target.closest('button, input, textarea, select, .task-title, .label-pill, .task-expand')) return;
  emit('toggle-expand');
};
</script>

<style scoped>
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
.task-card { position: relative; display: flex; gap: var(--sp-2); align-items: flex-start; padding: var(--sp-2) var(--sp-3); background: var(--c-surface); border: 1px solid var(--c-border); border-left: 3px solid transparent; border-radius: var(--r); box-shadow: var(--shadow-1); transition: background .15s, border-color .15s; }
.task-card:hover { background: var(--c-surface-2); }
.task-card--completed { opacity: .6; }
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
@media (max-width: 600px) {
  .task-card { flex-wrap: wrap; }
  .task-body { flex: 1 1 calc(100% - 56px); }
  .task-right { flex: 0 0 100%; justify-content: space-between; padding-left: 24px; }
  .task-body > .task-chips { flex: 1 1 100%; justify-content: flex-start; }
  .field-grid { grid-template-columns: 1fr; }
}
</style>
