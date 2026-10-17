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

.task-timer-left {
  margin-top: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #f59e0b;
}

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

.load-summary--over { border-color: #7f1d1d; }

@media (max-width: 480px) {
  .field-grid { grid-template-columns: 1fr; }
}
</style>
