<template>
  <!-- Holiday mode: the sergeant's "I'm off" opens this (same sheet as Transfer). Days off keep the streak, use no freeze. -->
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box modal-box--sm" role="dialog" aria-modal="true" aria-labelledby="hol-title" data-test="holiday-modal" @keydown.esc="$emit('close')">
      <div class="modal-header"><h2 id="hol-title" class="modal-title">🏖️ Time off</h2></div>
      <div class="modal-body">
        <p class="field-hint hol-lead">Your streak stays safe on days off. No tasks needed.</p>
        <div class="field-group"><label class="field-label" for="hol-from">From</label>
          <input id="hol-from" v-model="from" type="date" class="field-select" :min="today" data-test="holiday-from" /></div>
        <div class="field-group"><label class="field-label" for="hol-to">To</label>
          <input id="hol-to" v-model="to" type="date" class="field-select" :min="from || today" data-test="holiday-to" /></div>
        <p class="field-hint" data-test="holiday-count">{{ days.length ? `${days.length} day${days.length === 1 ? '' : 's'} off` : 'Pick dates (up to 31 days).' }}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" @click="$emit('close')">Cancel</button>
        <button type="button" class="btn-primary" data-test="holiday-save" :disabled="!days.length" @click="$emit('save', days)">Take {{ days.length > 1 ? 'days' : 'day' }} off</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { offRange } from '@/utils/planPhase2';
const props = defineProps({ today: { type: String, required: true } });
defineEmits(['close', 'save']);
const from = ref(props.today); const to = ref(props.today);
const days = computed(() => offRange(from.value, to.value, props.today));
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
.modal-box--sm { max-width: 360px; }
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border, #2a2a2e);
}
.modal-title { font-size: 1rem; font-weight: 600; margin: 0; }
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
.field-select {
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
.field-select:focus {
  outline: none;
  border-color: var(--c-accent, #378ADD);
}
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
.field-hint { margin: 4px 0 0; font-size: var(--fs-xs, 12px); color: var(--c-text-3, #9ca3af); }
.hol-lead { font-size: 17px; margin: 0 0 .75rem; }
.field-select { font-size: 18px; min-height: 48px; }
</style>
