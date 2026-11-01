<template>
  <div class="fullscreen-celebration">
    <div class="celebration-inner">
      <div class="celebration-emoji">🎉</div>
      <h1 class="celebration-title">All done!</h1>
      <p class="celebration-streak">🔥 <span>{{ Math.min(streak, 5) }}/5</span> day streak</p>
      <p class="celebration-sub">Every task complete. Take a breath — you earned it.</p>
      <button @click="$emit('close')" class="btn-primary btn-lg">Continue</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { syncAchievements } from '@/composables/useAchievements';
defineProps({ streak: { type: Number, default: 0 } });
defineEmits(['close']);
// All tasks done: offer the one-tap Perfect Day share (merged with any streak tier / badge earned now).
onMounted(() => { syncAchievements({ perfect: true }).catch(() => {}); });
</script>

<style scoped>
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
.btn-primary.btn-lg { padding: 12px 28px; font-size: 1rem; border-radius: var(--r, 3px); }
.fullscreen-celebration {
  position: fixed; inset: 0;
  background: var(--c-bg, #0f0f11);
  display: flex; align-items: center; justify-content: center;
  z-index: 300;
}
.celebration-inner { text-align: center; }
.celebration-emoji { font-size: 4rem; animation: pop 0.5s ease; }
.celebration-title { font-size: 2.5rem; font-weight: 600; margin: 0.5rem 0; }
.celebration-streak { font-size: 1.2rem; color: var(--c-warn, #F59E0B); margin-bottom: 0.5rem; }
.celebration-streak span { font-weight: 700; }
.celebration-sub { color: var(--c-text-3, #6b6a66); margin-bottom: 2rem; }
@keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

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
