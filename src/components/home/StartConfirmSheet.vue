<template>
  <!-- Pre-start time confirm (play). Same sheet style as Break it down / Time off. -->
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box modal-box--sm" role="dialog" aria-modal="true" aria-labelledby="sc-title" data-test="start-confirm" @keydown.esc="$emit('close')">
      <div class="modal-header"><h2 id="sc-title" class="modal-title">⏱️ {{ minutes }} min for “{{ title }}”?</h2></div>
      <div class="modal-body">
        <p class="field-hint">Are you sure you can finish it in {{ minutes }} minutes? Going over costs points.</p>
        <p class="sc-adj" role="group" aria-label="Adjust time">
          <button type="button" class="btn-secondary" data-test="start-confirm-minus" @click="$emit('update:minutes', adjustMinutes(minutes, -5))">−5</button>
          <button v-for="p in ADJUST_PRESETS" :key="p" type="button" class="btn-secondary" :class="{ 'sc-on': p === minutes }" :data-test="'start-confirm-preset-' + p" @click="$emit('update:minutes', p)">{{ p }}</button>
          <button type="button" class="btn-secondary" data-test="start-confirm-plus" @click="$emit('update:minutes', adjustMinutes(minutes, 5))">+5</button>
        </p>
        <label class="field-hint sc-dont"><input type="checkbox" data-test="start-confirm-dont-ask" :checked="dontAsk" @change="$emit('update:dontAsk', $event.target.checked)" /> Don't ask again</label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-test="start-confirm-skip" @click="$emit('skip')">Skip</button>
        <button type="button" class="btn-primary" data-test="start-confirm-start" @click="$emit('start')">Start</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ADJUST_PRESETS, adjustMinutes } from '@/utils/startConfirm';
defineProps({ title: { type: String, default: '' }, minutes: { type: Number, required: true }, dontAsk: { type: Boolean, default: false } });
defineEmits(['close', 'start', 'skip', 'update:minutes', 'update:dontAsk']);
</script>
<style scoped>
/* modal + button styles: same as BreakdownSheet */
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
@media (max-width: 600px) { .modal-backdrop { align-items: flex-end; padding: 0; } .modal-box { max-width: none; max-height: 92vh; } .modal-header, .modal-body, .modal-footer { padding-left: var(--sp-4); padding-right: var(--sp-4); } }
.field-hint { margin: 4px 0 0; font-size: var(--fs-xs, 12px); color: var(--c-text-3, #9ca3af); }
.sc-adj { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.sc-adj .btn-secondary { min-width: 0; padding: 6px 10px; }
.sc-on { outline: 2px solid var(--c-primary, #3c8cff); }
.sc-dont { display: flex; align-items: center; gap: 6px; }
</style>
