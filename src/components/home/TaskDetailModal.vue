<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Task details" data-test="task-detail-sheet">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="modal-header">
        <h2 class="modal-title">Task details</h2>
        <button @click="$emit('close')" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <h3 class="detail-title">{{ task.title }}</h3>
        <!-- At-a-glance facts (read-only; editing stays in the card editor) -->
        <p class="detail-facts" data-test="detail-facts">
          <span v-for="(f, i) in facts" :key="i" class="detail-fact">{{ f }}</span>
        </p>
        <p v-if="task.nextAction" class="detail-line">→ {{ task.nextAction }}</p>
        <p v-if="task.status === 'pending' && task.pendingOn" class="detail-line">⏳ Pending on {{ task.pendingOn }}</p>
        <p v-if="sub.total" class="detail-line" data-test="detail-subtasks">☑ Subtasks {{ sub.done }}/{{ sub.total }}</p>

        <!-- Attachments: reuses the card's existing upload (Storage task_images / task_files) and video-link flows -->
        <div class="detail-attach" data-test="detail-attach">
          <button type="button" class="btn-secondary" data-test="detail-attach-file" @click="fileInput && fileInput.click()">📎 Add photo or file</button>
          <button type="button" class="btn-secondary" data-test="detail-attach-video" @click="$emit('video')">🎥 {{ task.youtubeURL ? 'Change video' : 'Add video' }}</button>
          <input ref="fileInput" type="file" accept="image/*,.pdf,.doc,.docx,.txt" class="detail-hidden" @change="$emit('upload', $event)" />
        </div>

        <div v-if="task.youtubeURL" class="detail-media">
          <iframe
              :src="`https://www.youtube.com/embed/${extractYouTubeID(task.youtubeURL)}`"
              class="detail-video"
              height="220"
              frameborder="0"
              allowfullscreen
          ></iframe>
        </div>

        <div v-if="task.imageURL" class="detail-media detail-image-wrap">
          <img :src="task.imageURL" class="detail-image" @click="$emit('preview')" />
          <button @click="$emit('remove-attachment', 'imageURL')" class="detail-remove">✕</button>
        </div>

        <div v-if="task.fileURL" class="detail-file">
          📄 <a :href="task.fileURL" target="_blank" class="detail-file-link">{{ task.fileName || 'Download file' }}</a>
          <button @click="$emit('remove-attachment', 'fileURL')" class="detail-remove">✕</button>
        </div>

        <div v-if="showReminder(task.reminder)" class="detail-row">
          <span class="detail-row-icon">📅</span>
          <span>{{ formatShortDate(task.reminder.date) }} at {{ formatTime(task.reminder.time) }}</span>
        </div>

        <!-- Per-task app unlock (iPhone): one compact row in the existing detail-row style, no extra box -->
        <button v-if="taskApps.available" type="button" class="detail-row detail-row--tap" data-test="detail-task-apps" @click="$emit('pick-apps')">
          <span class="detail-row-icon">{{ taskApps.active ? '🔓' : '📱' }}</span>
          <span class="detail-row-grow">{{ taskAppsLabel }}</span>
          <span class="detail-row-chev" aria-hidden="true">›</span>
        </button>

        <div class="detail-sched" data-test="detail-schedule">
          <p v-if="label" class="detail-row" data-test="sched-label">{{ label }}</p>
          <SchedulePicker v-model="sched" :min-date="sched.repeat === 'never' ? dayDate : ''" />
          <p v-if="schedError" class="detail-err" role="alert">{{ schedError }}</p>
          <div v-if="dirty" class="detail-sched-actions">
            <template v-if="task.templateId">
              <button type="button" class="btn-secondary" data-test="sched-save-this" :disabled="sched.on && sched.repeat !== original.repeat" @click="save('this')">This one</button>
              <button type="button" class="btn-primary" data-test="sched-save-future" @click="save('future')">All future</button>
            </template>
            <button v-else type="button" class="btn-primary" data-test="sched-save" @click="save('future')">Save schedule</button>
          </div>
        </div>

        <div v-if="task.notes" class="detail-row detail-row--block">
          <span class="detail-row-icon">📝</span>
          <div>
            <p class="detail-row-label">Notes</p>
            <p class="detail-row-content">{{ task.notes }}</p>
          </div>
        </div>

        <div v-if="task.labels?.length" class="detail-labels">
          <span
              v-for="(label, index) in task.labels"
              :key="index"
              @click="$emit('toggle-label', label)"
              class="label-pill"
              :class="{ 'label-pill--active': activeLabels.includes(label) }"
          >
            {{ label }}
          </span>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-primary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { formatShortDate, formatTime, extractYouTubeID, showReminder } from '@/utils/dateTime';
import { scheduleLabel } from '@/utils/scheduling';
import SchedulePicker from './SchedulePicker.vue';
import { categoryOf } from '@/utils/taskCategory';
import { estimateOf, formatClock, formatDuration, toMinutes } from '@/utils/taskPlanning';
import { subtaskProgress } from '@/utils/subtasks';
import { taskAppsRowLabel } from '@/utils/taskAppUnlock';

const props = defineProps({
  task: { type: Object, default: () => ({}) },
  activeLabels: { type: Array, default: () => [] },
  schedule: { type: Object, default: () => ({ on: false, date: '', time: '', repeat: 'never', days: [], dayOfMonth: '', until: '' }) },
  dayDate: { type: String, default: '' },
  schedError: { type: String, default: '' },
  taskApps: { type: Object, default: () => ({ available: false }) },
});
const emit = defineEmits(['upload', 'video', 'close', 'preview', 'remove-attachment', 'toggle-label', 'save-schedule', 'pick-apps']);
const clone = (o) => JSON.parse(JSON.stringify(o || {}));
const original = ref(clone(props.schedule));
const sched = ref(clone(props.schedule));
watch(() => props.schedule, (v) => { original.value = clone(v); sched.value = clone(v); });
const dirty = computed(() => JSON.stringify(sched.value) !== JSON.stringify(original.value));
const label = computed(() => scheduleLabel(props.task));
const fileInput = ref(null);
const sub = computed(() => subtaskProgress(props.task));
const facts = computed(() => {
  const t = props.task || {}; const out = [categoryOf(t).label];
  const m = estimateOf(t); if (t.startTime) out.push('🕒 ' + formatClock(toMinutes(t.startTime)) + (m ? ' – ' + formatClock(toMinutes(t.startTime) + m) : ''));
  if (m) out.push(formatDuration(m));
  if (t.dueDate) out.push('Due ' + t.dueDate);
  if (t.priority && t.priority !== 'low') out.push(t.priority[0].toUpperCase() + t.priority.slice(1) + ' priority');
  if (t.important) out.push('🔥 Important');
  if ((t.repeatDays || []).length > 1 || t.type === 'recurring') out.push('🔁 Repeats');
  if (t.visibility === 'private') out.push('🔒 Private'); else if (t.anonymous === true) out.push('🕶️ Hidden from manager');
  if (t.carriedFrom) out.push('↪︎ Moved from yesterday');
  if (t.status && t.status !== 'todo') out.push(t.status[0].toUpperCase() + t.status.slice(1));
  return out;
});
const taskAppsLabel = computed(() => taskAppsRowLabel(props.taskApps.count || 0, props.taskApps));
const save = (scope) => emit('save-schedule', { sched: clone(sched.value), scope });
</script>

<style scoped>
/* Bottom-sheet presentation (same feel as the assistant / plan sheets) */
.modal-backdrop.modal-backdrop { align-items: flex-end; padding: 0; background: rgba(3,8,20,.6); }
.modal-box.modal-box { max-width: 560px; max-height: 88vh; border-radius: 22px 22px 0 0; border-bottom: 0; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -10px 40px rgba(0,0,0,.35); animation: sheetUp .22s ease-out; }
@keyframes sheetUp { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .modal-box.modal-box { animation: none; } }
.sheet-grab { width: 40px; height: 5px; border-radius: 3px; background: var(--c-border-strong, #3a4a70); margin: 8px auto 0; flex-shrink: 0; }
.modal-header.modal-header { border-bottom: 0; padding: .5rem 1.25rem 0; }
.modal-title.modal-title { font-size: .8rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--c-text-3, #6b6a66); }
.modal-close.modal-close { width: 44px; height: 44px; font-size: 1.05rem; }
.modal-body.modal-body { padding: .25rem 1.25rem 1rem; }
.modal-footer.modal-footer { border-top: 0; padding: .5rem 1.25rem 1.25rem; }
.modal-footer .btn-primary { width: 100%; min-height: 44px; border-radius: 12px; }
.detail-title.detail-title { font-size: 1.3rem; line-height: 1.3; margin: 0 0 .4rem; word-break: break-word; }
.detail-facts { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 .6rem; font-size: .85rem; color: var(--c-text-2, #9a9891); }
.detail-line { margin: 0 0 .35rem; font-size: .875rem; color: var(--c-text-2, #9a9891); }
.detail-attach { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; }
.detail-attach .btn-secondary { min-height: 44px; border-radius: 12px; }
.detail-hidden { display: none; }

.detail-sched { border-top: 1px solid var(--c-border, #2a2a2e); border-bottom: 1px solid var(--c-border, #2a2a2e); padding: .75rem 0; margin: .5rem 0; display: flex; flex-direction: column; gap: .5rem; }
.detail-sched-actions { display: flex; gap: .5rem; justify-content: flex-end; }
.detail-err { color: var(--c-danger, #f87171); font-size: .8rem; margin: 0; }
.btn-secondary { background: transparent; color: var(--c-text, #ededea); border: 1px solid var(--c-border, #2a2a2e); border-radius: var(--r, 3px); padding: .45rem .9rem; cursor: pointer; }
.btn-secondary:disabled { opacity: .4; cursor: not-allowed; }
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
  background: var(--c-surface, #18181b);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border, #2a2a2e);
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
.modal-close {
  background: none; border: none; color: var(--c-text-3, #6b6a66); font-size: 1rem;
  cursor: pointer; padding: 4px 8px; border-radius: var(--r, 3px);
  transition: color 0.15s;
}
.modal-close:hover { color: var(--c-text, #e8e6e1); }
.modal-body { padding: 1.25rem; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--c-border, #2a2a2e);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.btn-primary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--c-accent, #378ADD);
  color: white;
  border: none;
  border-radius: var(--r, 3px);
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: var(--c-accent-hover, #2a6db0); }
.detail-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; }
.detail-media { margin: 0.75rem 0; position: relative; }
.detail-video { width: 100%; border-radius: var(--r, 3px); }
.detail-image-wrap { display: inline-block; }
.detail-image { max-height: 200px; width: 100%; object-fit: contain; border-radius: var(--r, 3px); cursor: zoom-in; }
.detail-remove {
  position: absolute; top: 8px; right: 8px;
  background: var(--c-danger, #ef4444); color: white; border: none;
  border-radius: 50%; width: 22px; height: 22px;
  font-size: 0.7rem; cursor: pointer;
}
.detail-file {
  display: flex; align-items: center; gap: 8px;
  background: var(--c-surface-2, #1e1e22); border-radius: var(--r, 3px); padding: 8px 12px;
  font-size: 0.875rem; position: relative;
}
.detail-file-link { color: var(--c-accent-text, #7fb8f5); text-decoration: none; }
.detail-row {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 0.875rem; padding: 8px 0;
  border-top: 1px solid var(--c-border, #2a2a2e);
}
.detail-row-icon { font-size: 1rem; flex-shrink: 0; }
.detail-row--tap { width: 100%; background: none; border-left: 0; border-right: 0; border-bottom: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; align-items: center; }
.detail-row-grow { flex: 1; min-width: 0; color: var(--c-text-2, #9a9891); }
.detail-row-chev { color: var(--c-text-3, #6b6a66); }
.detail-row-label { font-weight: 600; font-size: 0.78rem; color: var(--c-text-3, #6b6a66); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
.detail-row-content { color: var(--c-text-2, #9a9891); }
.detail-labels { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 10px; border-top: 1px solid var(--c-border, #2a2a2e); }
.label-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--r, 3px);
  font-size: 0.72rem;
  font-weight: 500;
  background: var(--c-surface-2, #1e1e22);
  border: 1px solid var(--c-border, #2a2a2e);
  color: var(--c-text-2, #9a9891);
  cursor: pointer;
  transition: all 0.15s;
}
.label-pill:hover { border-color: var(--c-accent, #378ADD); color: var(--c-accent-text, #7fb8f5); }
.label-pill--active { background: var(--c-accent-soft, #1e2a3a); border-color: var(--c-accent, #378ADD); color: var(--c-accent-text, #7fb8f5); }

/* ── Jira-style dialog / form / button overrides ── */
.modal-backdrop { background: rgba(13,18,22,.72); backdrop-filter: none; }
.modal-box { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); box-shadow: var(--shadow-2); max-width: 520px; }
.modal-header { padding: var(--sp-4) var(--sp-5) var(--sp-3); border-bottom: none; }
.modal-title { font-size: var(--fs-xl); font-weight: 500; line-height: 24px; color: var(--c-text); }
.modal-close { color: var(--c-text-3); border-radius: var(--r); }
.modal-close:hover { background: var(--c-surface-2); color: var(--c-text); }
.modal-body { padding: var(--sp-2) var(--sp-5) var(--sp-4); }
.modal-footer { padding: var(--sp-3) var(--sp-5) var(--sp-4); border-top: none; gap: var(--sp-2); }
.btn-primary, .btn-secondary { font-size: var(--fs-md); font-weight: 500; border-radius: var(--r); padding: 0 12px; height: 32px; border: 1px solid transparent; transition: background .15s; }
.btn-primary { background: var(--c-accent); color: var(--c-on-accent); }
.btn-primary:hover { background: var(--c-accent-hover); }
.btn-secondary { background: var(--c-surface-2); color: var(--c-text-2); }
.btn-secondary:hover { background: var(--c-border); color: var(--c-text); }
.btn-primary:disabled, .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
.field-input, .field-select, .field-textarea { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); padding: 6px 8px; font-size: var(--fs-md); }
.field-input:focus, .field-select:focus, .field-textarea:focus { border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); outline: none; }
.field-label { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); }
@media (max-width: 600px) { .modal-backdrop { align-items: flex-end; padding: 0; } .modal-box { max-width: none; max-height: 92vh; } .modal-header, .modal-body, .modal-footer { padding-left: var(--sp-4); padding-right: var(--sp-4); } }
</style>
