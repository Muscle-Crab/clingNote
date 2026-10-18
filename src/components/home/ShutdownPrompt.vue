<template>
  <div v-if="suggest" class="shutdown-banner" role="status">
    <span>🌙 It's evening — wrap up the day?</span>
    <button type="button" class="btn-primary" @click="$emit('start')">Start shutdown</button>
    <button type="button" class="link-btn" @click="$emit('dismiss')">Not now</button>
  </div>
  <div v-if="open" class="modal-backdrop">
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Shutdown ritual">
      <div class="modal-header">
        <h2 class="modal-title">🌙 Shutdown</h2>
        <button @click="$emit('close')" class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <p class="shutdown-h">Done ({{ done.length }})</p>
        <ul class="shutdown-list"><li v-for="t in done" :key="taskKey(t)">✓ {{ t.title }}</li>
          <li v-if="!done.length" class="muted">Nothing finished yet.</li></ul>
        <p class="shutdown-h">Unfinished ({{ openTasks.length }}) — carry to tomorrow?</p>
        <ul class="shutdown-list"><li v-for="t in openTasks" :key="taskKey(t)">
          <label><input type="checkbox" :checked="carry[taskKey(t)]" @change="$emit('update:carry', { ...carry, [taskKey(t)]: $event.target.checked })" /> {{ t.title }}</label></li>
          <li v-if="!openTasks.length" class="muted">All clear. 🎉</li></ul>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" :disabled="busy" @click="$emit('finish', false)">Finish day</button>
        <button class="btn-primary" :disabled="busy" @click="$emit('finish', true)">Carry selected &amp; finish</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { taskKey } from '@/utils/taskPlanning';

defineProps({
  suggest: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  done: { type: Array, default: () => [] },
  openTasks: { type: Array, default: () => [] },
  carry: { type: Object, default: () => ({}) },
  busy: { type: Boolean, default: false },
});
defineEmits(['start', 'dismiss', 'close', 'finish', 'update:carry']);
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
.link-btn { background: none; border: none; color: var(--c-accent-text, #9cc7f7); cursor: pointer; font: inherit; text-decoration: underline; margin-left: auto; }
.shutdown-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; background: var(--c-accent-soft, #1e2a3a); border: 1px solid var(--c-accent-line, #2c4666); color: var(--c-accent-text, #cfe3fb); border-radius: var(--r, 3px); padding: 0.625rem 1rem; margin-bottom: 1rem; font-size: 0.85rem; }
.shutdown-h { font-weight: 600; font-size: 0.85rem; margin: 0.5rem 0 0.25rem; }
.shutdown-list { list-style: none; margin: 0 0 0.5rem; padding: 0; font-size: 0.85rem; line-height: 1.6; }
.muted { color: var(--c-text-2, #a3a29d); }

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

.shutdown-banner { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); background: var(--c-accent-soft); border: 1px solid var(--c-accent-line); border-left: 3px solid var(--c-accent); color: var(--c-text); border-radius: var(--r); padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-4); font-size: var(--fs-md); }
.link-btn { background: none; border: none; color: var(--c-accent-text); cursor: pointer; font: inherit; margin-left: auto; }
.link-btn:hover { text-decoration: underline; }
.shutdown-h { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); margin: var(--sp-4) 0 var(--sp-2); padding-bottom: var(--sp-1); border-bottom: 1px solid var(--c-border); }
.shutdown-h:first-child { margin-top: 0; }
.shutdown-list { list-style: none; margin: 0 0 var(--sp-2); padding: 0; font-size: var(--fs-md); }
.shutdown-list li { padding: 6px var(--sp-2); border-radius: var(--r); transition: background .15s; }
.shutdown-list li:hover { background: var(--c-surface-2); }
.shutdown-list label { display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; }
.shutdown-list input[type="checkbox"] { accent-color: var(--c-accent); width: 14px; height: 14px; margin: 0; }
.muted { color: var(--c-text-3); }
.modal-footer { border-top: 1px solid var(--c-border); background: var(--c-surface); position: sticky; bottom: 0; }
</style>
