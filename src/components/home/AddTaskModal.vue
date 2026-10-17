<template>
  <div class="modal-backdrop">
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">✦ New task</h2>
        <button @click="$emit('close')" class="modal-close">✕</button>
      </div>
      <form @submit.prevent="$emit('submit')">
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
            <button type="button" class="btn-secondary cap-override" @click="$emit('add-anyway')">Add anyway</button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" @click="$emit('close')" class="btn-secondary">Cancel</button>
          <button type="submit" class="btn-primary">Add task ✦</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ACTIVE_CAP } from '@/utils/taskPlanning';
import { getOrdinalSuffix } from '@/utils/dateTime';

// newTask is the reactive form object owned by HomeView; the form edits it in place via v-model.
defineProps({
  newTask: { type: Object, required: true },
  days: { type: Array, required: true },
  selectedDayRoutine: { type: Array, default: () => [] },
  error: { type: String, default: '' },
  capWarning: { type: Boolean, default: false },
});
const repeatMode = defineModel('repeatMode');
const showAdvanced = defineModel('showAdvanced');
defineEmits(['close', 'submit', 'add-anyway']);
</script>

<style scoped>
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
.field-group { margin-bottom: 1rem; }
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
.error-msg { color: #f87171; font-size: 0.85rem; padding: 0.5rem 0; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.cap-warning { background: #3a2d0a; border: 1px solid #92400e; color: #fde68a; border-radius: 10px; padding: 0.75rem; font-size: 0.82rem; line-height: 1.5; margin-top: 0.75rem; }
.cap-override { display: block; margin-top: 0.5rem; }
@media (max-width: 480px) {
  .field-grid { grid-template-columns: 1fr; }
}
</style>
