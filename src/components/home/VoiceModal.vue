<template>
  <div class="modal-backdrop">
    <div class="modal-box modal-box--sm voice-modal" role="dialog" aria-modal="true" aria-label="Voice input" @keydown.esc="$emit('cancel')">
      <button @click="$emit('cancel')" class="modal-close voice-cancel" aria-label="Close">✕</button>
      <template v-if="!supported">
        <p class="voice-label">Voice input isn't supported</p>
        <p v-if="native" class="voice-hint">Voice input isn't available in the iPhone app yet. Tap Add Task to type your task instead.</p>
        <p v-else class="voice-hint">This browser can't do speech recognition. Try Chrome, Edge or Safari, or add the task with the keyboard.</p>
      </template>
      <template v-else>
        <div class="voice-waves">
          <span class="wave wave-1"></span>
          <span class="wave wave-2"></span>
          <span class="wave wave-3"></span>
          <span class="wave wave-4"></span>
          <span class="wave wave-5"></span>
        </div>
        <p class="voice-label">{{ error ? 'Voice input stopped' : 'Listening… hands-free' }}</p>
        <p v-if="error" class="voice-error" role="alert">{{ error }}</p>
        <p v-else class="voice-transcript">"<span>{{ transcript }}</span>"</p>
        <p v-if="!error" class="voice-hint">Say a task and pause — it saves automatically. Say “and then” or “next” to add several at once.</p>
        <p v-if="capability === 'partial'" class="voice-hint">On iPhone/Safari the mic restarts after each phrase; if it stops, tap the mic again.</p>
        <p v-if="hint" class="voice-hint" role="status">{{ hint }}</p>
        <ul v-if="added.length" class="voice-added">
          <li v-for="e in added" :key="e.id">✓ {{ e.title }} <button v-if="e.undoUntil" type="button" class="voice-undo" @click="$emit('undo', e)">Undo</button></li>
        </ul>
        <button type="button" class="btn-secondary voice-close-btn" @click="$emit('cancel')">Done</button>
      </template>
      <button v-if="!supported" type="button" class="btn-secondary voice-close-btn" @click="$emit('cancel')">Close</button>
    </div>
  </div>
</template>

<script setup>
import { voiceInputBlocked } from '@/utils/platform';
const native = voiceInputBlocked();
defineProps({
  transcript: { type: String, default: '' },
  supported: { type: Boolean, default: true },
  error: { type: String, default: '' },
  capability: { type: String, default: 'full' },
  hint: { type: String, default: '' },
  added: { type: Array, default: () => [] },
});
defineEmits(['cancel', 'undo']);
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
.modal-close {
  background: none; border: none; color: var(--c-text-3, #6b6a66); font-size: 1rem;
  cursor: pointer; padding: 4px 8px; border-radius: var(--r, 3px);
  transition: color 0.15s;
}
.modal-close:hover { color: var(--c-text, #e8e6e1); }
.voice-modal { text-align: center; padding: 2rem 1.5rem; position: relative; }
.voice-cancel { position: absolute; top: 12px; right: 12px; }
.voice-waves { display: flex; gap: 4px; justify-content: center; margin-bottom: 1.5rem; align-items: flex-end; }
.wave {
  width: 4px; border-radius: var(--r, 3px);
  background: var(--c-success, #4ade80);
  animation: waveUp 0.8s ease infinite alternate;
}
.wave-1 { height: 16px; animation-delay: 0.0s; }
.wave-2 { height: 24px; animation-delay: 0.1s; }
.wave-3 { height: 32px; animation-delay: 0.2s; }
.wave-4 { height: 20px; animation-delay: 0.3s; }
.wave-5 { height: 12px; animation-delay: 0.4s; }
.voice-label { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
.voice-transcript { color: var(--c-accent-text, #7fb8f5); font-size: 0.9rem; margin-bottom: 0.5rem; }
.voice-error { color: var(--c-danger-text, #f87171); font-size: 0.85rem; margin-bottom: 0.75rem; }
.voice-close-btn { margin-top: 1rem; }
.voice-hint { font-size: 0.75rem; color: var(--c-text-3, #6b6a66); }
@keyframes waveUp { from { transform: scaleY(0.5); } to { transform: scaleY(1); } }

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
.voice-added { list-style: none; padding: 0; margin: 8px 0; text-align: left; max-height: 140px; overflow: auto; }
.voice-added li { padding: 3px 0; font-size: .9rem; }
.voice-undo { margin-left: 8px; color: #f59e0b; font-weight: 700; background: none; border: none; cursor: pointer; }
</style>
