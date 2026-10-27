<template>
  <div class="modal-backdrop nt-backdrop" :style="vvStyle" @touchmove.self.prevent>
    <div class="modal-box nt-sheet" role="dialog" aria-modal="true" aria-labelledby="nt-title" @keydown.esc="$emit('close')">
      <div class="modal-header">
        <h2 id="nt-title" class="modal-title">✦ New task</h2>
        <button type="button" @click="$emit('close')" class="modal-close" aria-label="Close">✕</button>
      </div>
      <form class="nt-form" @submit.prevent="$emit('submit')">
        <div class="modal-body">
          <div class="field-group">
            <label class="field-label" for="nt-name">Task name</label>
            <input id="nt-name" ref="titleInput" type="text" v-model="newTask.title" class="field-input" placeholder="What needs doing?" required />
          </div>

          <div class="field-group">
            <label class="field-label">Reminder</label>
            <input type="datetime-local" v-model="newTask.reminder.datetime" class="field-input" />
          </div>
          <div class="field-group">
            <SchedulePicker v-if="newTask.sched" v-model="newTask.sched" :min-date="today" />
          </div>
          <div v-if="!newTask.sched?.on" class="field-group">
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
              <label class="field-label" for="nt-status">Status</label>
              <select id="nt-status" v-model="newTask.status" class="field-select">
                <option v-for="st in STATUSES" :key="st.value" :value="st.value">{{ st.label }}</option>
              </select>
            </div>
            <div v-if="newTask.status === 'pending'" class="field-group">
              <label class="field-label" for="nt-pending-on">Pending on</label>
              <input id="nt-pending-on" type="text" v-model="newTask.pendingOn" class="field-input" placeholder="e.g. Apple review" />
            </div>
            <div class="field-group">
              <label class="field-label" for="nt-due">Due date</label>
              <input id="nt-due" type="date" v-model="newTask.dueDate" class="field-input" />
            </div>
            <div class="field-group">
              <label class="field-label" for="nt-start">Start time</label>
              <input id="nt-start" type="time" v-model="newTask.startTime" class="field-input" />
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
              <div class="field-group anon-row" data-test="anon-toggle">
                <div class="anon-text"><span class="field-label">🔒 Hide name from manager</span><small>Your manager sees the time, status &amp; points, not the name or notes</small></div>
                <button type="button" role="switch" class="anon-switch" :class="{ on: newTask.anonymous }" :aria-checked="newTask.anonymous ? 'true' : 'false'" aria-label="Hide name from manager" @click="newTask.anonymous = !newTask.anonymous"><span></span></button>
              </div>
            </div>
          </transition>

          <div v-if="error && !limitHit" class="error-msg">{{ error }}</div>
          <div v-if="limitHit" class="cap-warning limit-hit" role="alert" data-test="task-limit">
            <strong>You've hit today's limit of {{ limitHit.limit }} tasks.</strong>
            <template v-if="limitHit.pro"> That's the Pro maximum for one day. Finish or move something first.</template>
            <template v-else> Free accounts get {{ limitHit.limit }} tasks per day.<template v-if="proRaises"> Pro raises it to {{ proLimit }}.</template>
              <button v-if="!rcPro()" type="button" class="btn-secondary cap-override" data-test="limit-upgrade" @click="$emit('upgrade')">Upgrade to Pro</button>
            </template>
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
import SchedulePicker from './SchedulePicker.vue';
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ACTIVE_CAP, STATUSES } from '@/utils/taskPlanning';
import { getOrdinalSuffix } from '@/utils/dateTime';
import { TASK_LIMITS, PRO_RAISES_LIMIT } from '@/config/pricing';
import { rcProActive } from '@/composables/usePro';
import { auth } from '@/firebaseConfig';
const rcPro = () => rcProActive(auth.currentUser?.uid); // iOS: RevenueCat says Pro -> never show an upgrade prompt

// newTask is the reactive form object owned by HomeView; the form edits it in place via v-model.
defineProps({
  newTask: { type: Object, required: true },
  days: { type: Array, required: true },
  selectedDayRoutine: { type: Array, default: () => [] },
  error: { type: String, default: '' },
  capWarning: { type: Boolean, default: false },
  limitHit: { type: Object, default: null },
});
const proLimit = TASK_LIMITS.pro;
const proRaises = PRO_RAISES_LIMIT;
const repeatMode = defineModel('repeatMode');
const showAdvanced = defineModel('showAdvanced');
const today = new Date().toLocaleDateString('en-CA');
defineEmits(['close', 'submit', 'add-anyway', 'upgrade']);
const titleInput = ref(null);
onMounted(() => nextTick(() => titleInput.value && titleInput.value.focus()));

// Keep the sheet fixed in place on phones: lock page scroll while open and size/position it to the *visual* viewport,
// so the on-screen keyboard shrinks the sheet (its body scrolls) instead of pushing or dragging it around.
const vvStyle = ref({});
const syncVv = () => {
  const vv = window.visualViewport;
  vvStyle.value = vv ? { top: `${Math.round(vv.offsetTop)}px`, height: `${Math.round(vv.height)}px`, bottom: 'auto' } : {};
};
onMounted(() => {
  document.documentElement.classList.add('nt-modal-open'); document.body.classList.add('nt-modal-open');
  syncVv();
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', syncVv); window.visualViewport.addEventListener('scroll', syncVv); }
});
onBeforeUnmount(() => {
  document.documentElement.classList.remove('nt-modal-open'); document.body.classList.remove('nt-modal-open');
  if (window.visualViewport) { window.visualViewport.removeEventListener('resize', syncVv); window.visualViewport.removeEventListener('scroll', syncVv); }
});
</script>

<style scoped>
.field-input::placeholder, .field-textarea::placeholder { color: var(--c-text-3, #6b6a66); opacity: .7; font-style: italic; }
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
.field-group { margin-bottom: 1rem; }
.field-label { display: block; font-size: 0.78rem; font-weight: 500; color: var(--c-text-2, #9a9891); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
.field-input, .field-select, .field-textarea {
  width: 100%;
  background: var(--c-bg, #0f0f11);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 10px 12px;
  color: var(--c-text, #e8e6e1);
  font-family: inherit;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.field-input:focus, .field-select:focus, .field-textarea:focus {
  outline: none;
  border-color: var(--c-accent, #378ADD);
}
.field-textarea { min-height: 80px; resize: vertical; }
.field-select { cursor: pointer; }
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
.btn-secondary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--c-surface-2, #1e1e22);
  color: var(--c-text-2, #9a9891);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 9px 18px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { color: var(--c-text, #e8e6e1); border-color: var(--c-border-strong, #3a3a3e); }
.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--c-accent, #378ADD);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.5rem 0;
}
.advanced-body { padding-top: 0.5rem; }
.day-checkboxes { display: flex; flex-wrap: wrap; gap: 8px; }
.day-check-label { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer; }
.day-check-input { accent-color: var(--c-accent, #378ADD); }
.error-msg { color: var(--c-danger-text, #f87171); font-size: 0.85rem; padding: 0.5rem 0; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.cap-warning { background: var(--c-warn-soft, #3a2d0a); border: 1px solid var(--c-warn-line, #92400e); color: var(--c-warn-text, #fde68a); border-radius: var(--r, 3px); padding: 0.75rem; font-size: 0.82rem; line-height: 1.5; margin-top: 0.75rem; }
.cap-override { display: block; margin-top: 0.5rem; }
@media (max-width: 480px) {
  .field-grid { grid-template-columns: 1fr; }
}

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
.field-hint { margin: 4px 0 0; font-size: var(--fs-xs); color: var(--c-text-3); }
.sched-weekdays { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.sched-wd { font-size: var(--fs-xs, .8rem); display: flex; gap: 3px; align-items: center; }

/* ── Fixed, keyboard-safe sheet: header/footer stay put, only the body scrolls ── */
.nt-backdrop { position: fixed; inset: 0; height: 100dvh; box-sizing: border-box; overscroll-behavior: contain; touch-action: none; -webkit-tap-highlight-color: transparent; }
.nt-sheet { overflow: hidden; max-height: 100%; min-height: 0; touch-action: auto; overscroll-behavior: contain; transform: none; }
.nt-form { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
.nt-sheet .modal-header, .nt-sheet .modal-footer { flex: 0 0 auto; }
.nt-sheet .modal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch; }
.nt-sheet .modal-footer { padding-bottom: calc(var(--sp-4, 16px) + env(safe-area-inset-bottom)); }
.nt-sheet .field-input, .nt-sheet .field-select, .nt-sheet .field-textarea { scroll-margin: 16px; }
@media (max-width: 600px) {
  .nt-backdrop { padding: 0; align-items: flex-end; }
  .nt-sheet { width: 100%; max-width: 100%; max-height: min(92%, 100dvh); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .nt-sheet .field-input, .nt-sheet .field-select, .nt-sheet .field-textarea { font-size: 16px; } /* no iOS focus-zoom (which shifts the page) */
}
.anon-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.anon-text { display: flex; flex-direction: column; gap: 2px; }
.anon-text small { font-size: 11px; color: var(--c-text-2, #A9B4CC); }
.anon-switch { flex: none; width: 44px; height: 26px; border-radius: 999px; border: 1px solid var(--c-border, #2A3C66); background: rgba(255,255,255,.06); position: relative; padding: 0; cursor: pointer; transition: background .15s; }
.anon-switch span { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #cfd8cf; transition: transform .15s; }
.anon-switch.on { background: #2f7a4f; border-color: #3c9a64; }
.anon-switch.on span { transform: translateX(18px); background: #fff; }
</style>

<style>
/* Page scroll lock while the New task sheet is open (unscoped: targets html/body/app root). */
html.nt-modal-open, body.nt-modal-open { overflow: hidden !important; overscroll-behavior: none; }
body.nt-modal-open .app-root { overflow: hidden; overscroll-behavior: none; }
.app-root .nt-sheet.nt-sheet.nt-sheet { animation: ntFade .18s ease-out; transform: none; }
@keyframes ntFade { from { opacity: 0; } }
</style>
