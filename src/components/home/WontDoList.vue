<template>
  <div class="wont-do-list">
    <p class="wont-do-label">🚫 Skipped tasks</p>
    <div v-for="(task, index) in tasks" :key="index" class="wont-do-item">
      <button @click="$emit('undo', index)" class="wont-do-undo" title="Restore">↩</button>
      <span class="wont-do-title">{{ task.title }}</span>
      <span v-if="task.wontDoReason" class="wont-do-reason">— {{ task.wontDoReason }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({ tasks: { type: Array, default: () => [] } });
defineEmits(['undo']);
</script>

<style scoped>
.wont-do-list {
  margin-top: 1rem;
  background: var(--c-surface, #18181b);
  border: 1px solid var(--c-danger-soft, #3b0d0d);
  border-radius: var(--r, 3px);
  padding: 0.875rem 1rem;
}
.wont-do-label { font-size: 0.75rem; font-weight: 600; color: var(--c-danger-text, #f87171); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; }
.wont-do-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--c-border, #2a2a2e); font-size: 0.875rem; }
.wont-do-undo {
  background: var(--c-success-soft, #0d2217); color: var(--c-success, #4ade80);
  border: 1px solid var(--c-success-soft, #14432a); border-radius: var(--r, 3px);
  padding: 2px 8px; font-size: 0.8rem; cursor: pointer;
}
.wont-do-title { font-weight: 500; }
.wont-do-reason { color: var(--c-text-3, #6b6a66); font-size: 0.8rem; }
.chip--high { background: var(--c-danger-soft, #3b0d0d); color: var(--c-danger-text, #fca5a5); }
.chip--medium { background: var(--c-warn-soft, #3a2d0a); color: var(--c-warn-text, #fcd34d); }
.load-summary--over { border-color: var(--c-danger-line, #7f1d1d); }
</style>
