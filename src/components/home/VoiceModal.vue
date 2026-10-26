<template>
  <div class="modal-backdrop">
    <div class="modal-box modal-box--sm voice-modal" role="dialog" aria-modal="true" aria-label="Voice input" @keydown.esc="$emit('cancel')">
      <button @click="$emit('cancel')" class="modal-close voice-cancel" aria-label="Close">✕</button>
      <template v-if="!supported">
        <p class="voice-label">Voice input isn't supported</p>
        <p v-if="native" class="voice-hint">Voice input isn't available on this device. Tap Add Task to type your task instead.</p>
        <p v-else class="voice-hint">This browser can't do speech recognition. Try Chrome, Edge or Safari, or add the task with the keyboard.</p>
      </template>
      <template v-else-if="edit.length">
        <p class="voice-label">Review {{ edit.length }} item{{ edit.length === 1 ? '' : 's' }}</p>
        <p class="voice-transcript">"<span>{{ transcript }}</span>"</p>
        <ul class="vc-list" data-test="voice-confirm">
          <li v-for="(it, i) in edit" :key="i" class="vc-item">
            <div class="vc-row">
              <div class="vc-seg" role="radiogroup" aria-label="Type">
                <button v-for="t in TYPES" :key="t.v" type="button" :class="{ on: it.type === t.v }" :aria-pressed="it.type === t.v" @click="setType(it, t.v)">{{ t.l }}</button>
              </div>
              <button type="button" class="vc-del" :aria-label="'Remove ' + it.title" @click="edit.splice(i, 1)">✕</button>
            </div>
            <input v-model="it.title" class="vc-in" aria-label="Title" maxlength="140" />
            <div v-if="it.type === 'reminder'" class="vc-row"><label>Remind at <input v-model="it.remindAt" type="datetime-local" class="vc-in" /></label></div>
            <div v-else class="vc-row">
              <label v-if="it.type === 'schedule'">Day <input v-model="it.date" type="date" class="vc-in" /></label>
              <label>Start <input v-model="it.start" type="time" class="vc-in" /></label>
              <label>Min <input v-model.number="it.durationMin" type="number" min="0" max="1440" step="5" class="vc-in vc-num" /></label>
            </div>
          </li>
        </ul>
        <p v-if="error" class="voice-error" role="alert">{{ error }}</p>
        <p class="voice-hint">{{ source === 'ai' ? 'Interpreted by AI.' : 'Interpreted on your device.' }} Reminders don't count toward your daily task limit.</p>
        <div class="vc-actions">
          <button type="button" class="btn-secondary" @click="$emit('relisten')">🎙️ Again</button>
          <button type="button" class="btn-primary" data-test="voice-save" :disabled="busy || !edit.length" @click="$emit('confirm', edit.map((x) => ({ ...x })))">{{ busy ? 'Adding…' : edit.length > 1 ? `Add all ${edit.length}` : 'Add' }}</button>
        </div>
      </template>
      <template v-else>
        <div class="voice-waves">
          <span class="wave wave-1"></span>
          <span class="wave wave-2"></span>
          <span class="wave wave-3"></span>
          <span class="wave wave-4"></span>
          <span class="wave wave-5"></span>
        </div>
        <p class="voice-label">{{ error ? 'Voice input stopped' : busy ? 'Organising…' : 'Listening… take your time' }}</p>
        <p v-if="error" class="voice-error" role="alert">{{ error }}</p>
        <p v-else class="voice-transcript">"<span>{{ transcript }}</span>"</p>
        <p v-if="busy" class="voice-hint">Working it out…</p>
        <p v-else-if="!error" class="voice-hint">Explain everything you need to do — as long as you like, pauses are fine. E.g. “First buy groceries, then call the dentist at 3, and block 2 hours for homework tomorrow.” Tap Done when finished; you'll review each item before anything is saved.</p>
        <p v-if="capability === 'partial'" class="voice-hint">On iPhone/Safari the mic restarts after each phrase; if it stops, tap the mic again.</p>
        <p v-if="hint" class="voice-hint" role="status">{{ hint }}</p>
        <ul v-if="added.length" class="voice-added">
          <li v-for="e in added" :key="e.id">✓ {{ e.title }} <button v-if="e.undoUntil" type="button" class="voice-undo" @click="$emit('undo', e)">Undo</button></li>
        </ul>
        <div class="vc-actions">
          <button type="button" class="btn-secondary" data-test="voice-cancel" @click="$emit('cancel')">Cancel</button>
          <button type="button" class="btn-primary" data-test="voice-done" :disabled="busy || (!transcript && !error)" @click="error ? $emit('cancel') : $emit('finish')">{{ error ? 'Close' : 'Done' }}</button>
        </div>
      </template>
      <button v-if="!supported" type="button" class="btn-secondary voice-close-btn" @click="$emit('cancel')">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { voiceInputBlocked } from '@/utils/platform';
const native = voiceInputBlocked();
const TYPES = [{ v: 'task', l: 'Task' }, { v: 'reminder', l: 'Reminder' }, { v: 'schedule', l: 'Schedule' }];
const props = defineProps({
  items: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  source: { type: String, default: '' },
  transcript: { type: String, default: '' },
  supported: { type: Boolean, default: true },
  error: { type: String, default: '' },
  capability: { type: String, default: 'full' },
  hint: { type: String, default: '' },
  added: { type: Array, default: () => [] },
});
defineEmits(['cancel', 'undo', 'confirm', 'relisten', 'finish']);
const edit = ref([]);
watch(() => props.items, (v) => { edit.value = (v || []).map((x) => ({ ...x })); }, { immediate: true });
const setType = (it, t) => {
  it.type = t;
  if (t === 'reminder' && !it.remindAt) it.remindAt = `${it.date}T${it.start || '09:00'}`;
  if (t === 'schedule' && !it.start) it.start = it.remindAt ? it.remindAt.slice(11) : '09:00';
};
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
.voice-transcript { color: var(--c-accent-text, #7fb8f5); font-size: 0.9rem; margin-bottom: 0.5rem; max-height: 9rem; overflow-y: auto; }
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
.vc-list { list-style: none; padding: 0; margin: 8px 0; display: grid; gap: 8px; max-height: 46vh; overflow: auto; text-align: left; }
.vc-item { border: 1px solid rgba(127,127,160,.35); border-radius: 12px; padding: 8px; display: grid; gap: 6px; }
.vc-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px; }
.vc-row label { display: flex; gap: 4px; align-items: center; }
.vc-in { border: 1px solid rgba(127,127,160,.4); border-radius: 8px; padding: 4px 6px; background: transparent; color: inherit; font-size: 14px; min-width: 0; }
.vc-num { width: 64px; }
.vc-seg { display: inline-flex; border-radius: 9px; overflow: hidden; border: 1px solid rgba(127,127,160,.4); }
.vc-seg button { background: none; border: 0; padding: 4px 8px; font-size: 12px; color: inherit; }
.vc-seg button.on { background: #1E5BFF; color: #fff; }
.vc-del { margin-left: auto; background: none; border: 0; color: inherit; font-size: 14px; }
.vc-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
</style>
