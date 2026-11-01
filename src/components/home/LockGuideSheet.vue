<template>
  <div v-if="open" class="modal-backdrop">
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Choose apps to lock">
      <div class="modal-header">
        <h2 class="modal-title">{{ step === 'done' ? 'Locked' : 'Choose apps to lock' }}</h2>
        <button @click="$emit('close')" class="modal-close" aria-label="Close" :disabled="busy">✕</button>
      </div>
      <div v-if="step === 'guide'" class="modal-body">
        <p class="guide-lead">{{ lead }}</p>
        <ol class="guide-steps">
          <li>Apple keeps your app list private, so ClingNote <b>can't see app names</b>. You pick them once in Apple's list.</li>
          <li>If asked, allow <b>Screen Time</b>. Then tap a category (like <b>Social</b>) and check {{ missingText || 'the apps you want' }}. Tap <b>Next</b>.</li>
          <li>Check the name next to each app and tap <b>Done</b>. That's the name you can say later.</li>
        </ol>
        <p v-if="error" class="guide-err">{{ error }}</p>
      </div>
      <div v-else class="modal-body">
        <p class="guide-lead">{{ summary }}</p>
        <ul v-if="apps.length" class="guide-list"><li v-for="a in apps" :key="a.id || a.label">{{ a.label }}<span v-if="a.locked" class="muted"> · locked</span></li></ul>
      </div>
      <div class="modal-footer">
        <template v-if="step === 'guide'">
          <button type="button" class="btn-secondary" @click="$emit('close')">Not now</button>
          <button type="button" class="btn-primary" :disabled="busy" @click="$emit('pick')">{{ busy ? 'Opening…' : 'Open app list' }}</button>
        </template>
        <button v-else type="button" class="btn-primary" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Guided first-lock sheet (assistant "lock TikTok for 2h" when TikTok was never picked). Explains Apple's privacy rule,
// opens the native picker + naming step, then HomeView resumes the pending lock (utils/appLockNames.resumePending) and shows the result here.
import { computed, watch, onBeforeUnmount } from 'vue';
import { joinNames } from '@/utils/appLockNames';
const props = defineProps({
  open: { type: Boolean, default: false },
  step: { type: String, default: 'guide' }, // guide | done
  missing: { type: Array, default: () => [] },
  firstTime: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  summary: { type: String, default: '' },
  apps: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'pick']);
const missingText = computed(() => joinNames(props.missing));
const lead = computed(() => (props.missing.length ? `To lock ${missingText.value}, pick ${props.missing.length > 1 ? 'them' : 'it'} once${props.firstTime ? '. It takes about 20 seconds.' : '. It isn\'t in your list yet.'}` : 'Pick the apps you want ClingNote to be able to lock.'));
const onKey = (e) => { if (e.key === 'Escape' && !props.busy) emit('close'); };
watch(() => props.open, (o) => { if (typeof document === 'undefined') return; document.removeEventListener('keydown', onKey); if (o) document.addEventListener('keydown', onKey); }, { immediate: true });
onBeforeUnmount(() => { if (typeof document !== 'undefined') document.removeEventListener('keydown', onKey); });
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 230;
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

.link-btn { background: none; border: none; color: var(--c-accent-text); cursor: pointer; font: inherit; margin-left: auto; }
.link-btn:hover { text-decoration: underline; }
.muted { color: var(--c-text-3); }
.modal-footer { border-top: 1px solid var(--c-border); background: var(--c-surface); position: sticky; bottom: 0; }
.guide-steps { margin: 0; padding-left: 1.1rem; font-size: var(--fs-md); line-height: 1.55; color: var(--c-text-2); }
.guide-steps li { margin-bottom: var(--sp-2); }
.guide-steps b { color: var(--c-text); font-weight: 600; }
.guide-lead { margin: 0 0 var(--sp-3); font-size: var(--fs-md); color: var(--c-text); }
.guide-list { list-style: none; margin: 0; padding: 0; font-size: var(--fs-md); }
.guide-list li { padding: 6px 0; border-bottom: 1px solid var(--c-border); }
.guide-err { color: var(--c-danger, #e5484d); font-size: var(--fs-sm, .8rem); margin: var(--sp-2) 0 0; }
</style>
