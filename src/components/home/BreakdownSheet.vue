<template>
  <!-- "Break it down" (task card ⋯ menu): AI splits a vague task into 3-6 first steps (minutes + points from the app's scoring). Preview first;
       nothing is saved until "Add steps". Same sheet style as Time off / Transfer. -->
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box modal-box--sm" role="dialog" aria-modal="true" aria-labelledby="bd-title" data-test="breakdown-sheet" @keydown.esc="$emit('close')">
      <div class="modal-header"><h2 id="bd-title" class="modal-title">🪄 Break it down</h2></div>
      <div class="modal-body">
        <p class="field-hint bd-lead">{{ title }}</p>
        <p v-if="loading" class="field-hint" role="status" data-test="breakdown-loading">Thinking of small first steps…</p>
        <p v-else-if="error" class="field-hint bd-err" role="alert" data-test="breakdown-error">{{ error }}</p>
        <ul v-else class="bd-list" data-test="breakdown-steps">
          <li v-for="(s, i) in steps" :key="i" class="bd-step">
            <label><input v-model="picked[i]" type="checkbox" :data-test="'breakdown-step-' + i" /> <span class="bd-t">{{ s.title }}</span></label>
            <span class="bd-meta">{{ fmtMin(s.minutes) }} · +{{ s.points }}</span>
          </li>
        </ul>
        <p v-if="!loading && !error && chosen.length" class="field-hint" data-test="breakdown-total">{{ chosen.length }} step{{ chosen.length === 1 ? '' : 's' }} · {{ fmtMin(sum.minutes) }} · +{{ sum.points }} pts</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-test="breakdown-close" @click="$emit('close')">Cancel</button>
        <button v-if="error" type="button" class="btn-primary" data-test="breakdown-retry" @click="$emit('retry')">Try again</button>
        <button v-else type="button" class="btn-primary" data-test="breakdown-add" :disabled="loading || !chosen.length" @click="$emit('confirm', chosen)">Add as subtasks</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { totals } from '@/utils/breakdown';
import { fmtMin } from '@/utils/taskEstimate';
const props = defineProps({ title: { type: String, default: '' }, steps: { type: Array, default: () => [] }, loading: Boolean, error: { type: String, default: '' } });
defineEmits(['close', 'confirm', 'retry']);
const picked = ref([]);
watch(() => props.steps, (s) => { picked.value = (s || []).map(() => true); }, { immediate: true });
const chosen = computed(() => (props.steps || []).filter((_, i) => picked.value[i]));
const sum = computed(() => totals(chosen.value));
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
.bd-lead { font-weight: 600; color: var(--c-text, #e6e6e6); margin: 0 0 .5rem; overflow-wrap: anywhere; }
.bd-err { color: var(--c-danger, #f87171); }
.bd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.bd-step { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .9rem; }
.bd-step label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bd-t { overflow-wrap: anywhere; }
.bd-meta { flex: none; font-size: .75rem; color: var(--c-text-3, #9aa3b5); }
</style>
