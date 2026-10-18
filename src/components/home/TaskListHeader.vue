<template>
  <div class="task-list-header">
    <div class="task-count">
      <span class="task-count-label">Today</span>
      <span class="task-count-badge">{{ completed }}/{{ total }}</span>
    </div>
    <button @click="$emit('toggle-sound')" class="toggle-visibility" :aria-pressed="soundEnabled" :aria-label="soundEnabled ? 'Mute sounds' : 'Enable sounds'" :title="soundEnabled ? 'Sounds on' : 'Sounds off'">
      <i :class="soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute'"></i>
    </button>
    <button @click="$emit('toggle-completed')" class="toggle-visibility" :title="showCompleted ? 'Hide completed' : 'Show completed'">
      <i :class="showCompleted ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({
  completed: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  soundEnabled: { type: Boolean, default: false },
  showCompleted: { type: Boolean, default: false },
});
defineEmits(['toggle-sound', 'toggle-completed']);
</script>

<style scoped>
.task-list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0 0.75rem;
}
.task-count { display: flex; align-items: center; gap: 8px; }
.task-count-label { font-weight: 600; font-size: 0.875rem; color: var(--c-text-3, #6b6a66); }
.task-count-badge {
  font-size: 0.75rem; font-weight: 600; font-family: 'JetBrains Mono', monospace;
  background: var(--c-accent-soft, #1e2a3a); color: var(--c-accent-text, #7fb8f5);
  padding: 2px 8px; border-radius: var(--r, 3px);
}
.toggle-visibility {
  background: none; border: none; color: var(--c-text-3, #6b6a66);
  cursor: pointer; font-size: 0.875rem; padding: 4px 8px;
  transition: color 0.15s;
}
.toggle-visibility:hover { color: var(--c-text, #e8e6e1); }
.task-count-label { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.task-count-badge { padding: 0 6px; line-height: 16px; background: var(--c-surface-2); color: var(--c-text-2); border-radius: 8px; }
.toggle-visibility { font-size: var(--fs-sm); border-radius: var(--r); }
.toggle-visibility:hover { background: var(--c-surface-2); }
</style>
