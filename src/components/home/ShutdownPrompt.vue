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
.link-btn { background: none; border: none; color: #9cc7f7; cursor: pointer; font: inherit; text-decoration: underline; margin-left: auto; }
.shutdown-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; background: #1e2a3a; border: 1px solid #2c4666; color: #cfe3fb; border-radius: 12px; padding: 0.625rem 1rem; margin-bottom: 1rem; font-size: 0.85rem; }
.shutdown-h { font-weight: 600; font-size: 0.85rem; margin: 0.5rem 0 0.25rem; }
.shutdown-list { list-style: none; margin: 0 0 0.5rem; padding: 0; font-size: 0.85rem; line-height: 1.6; }
.muted { color: #a3a29d; }
</style>
