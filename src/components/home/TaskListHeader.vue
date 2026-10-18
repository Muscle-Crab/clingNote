<template>
  <div class="task-list-header">
    <div class="task-count">
      <h2 class="task-count-label">Today</h2>
      <span class="task-count-badge">{{ completed }}/{{ total }}</span>
    </div>
    <div class="header-actions">
      <button @click="$emit('toggle-sound')" class="toggle-visibility" :aria-pressed="soundEnabled" :aria-label="soundEnabled ? 'Mute sounds' : 'Enable sounds'" :title="soundEnabled ? 'Sounds on' : 'Sounds off'">
        <i :class="soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute'"></i>
      </button>
      <button @click="$emit('toggle-completed')" class="toggle-visibility toggle-visibility--text" :aria-pressed="showCompleted" :title="showCompleted ? 'Hide completed' : 'Show completed'">
        <i :class="showCompleted ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
        <span>{{ showCompleted ? 'Hide completed' : 'Show completed' }}</span>
      </button>
    </div>
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
.task-list-header { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-2) 0; gap: var(--sp-2); }
.task-count { display: flex; align-items: center; gap: var(--sp-2); }
.task-count-label { margin: 0; font-size: 24px; line-height: 28px; font-weight: 800; letter-spacing: -.01em; color: var(--c-text); }
.task-count-badge { font-size: var(--fs-sm); font-weight: 700; font-family: 'JetBrains Mono', monospace; background: var(--c-accent-soft); color: var(--c-accent-text); padding: 2px 10px; border-radius: var(--r-pill); }
.header-actions { display: flex; align-items: center; gap: 2px; }
.toggle-visibility { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 40px; min-height: 40px; background: none; border: none; color: var(--c-text-2); cursor: pointer; font-size: var(--fs-md); padding: 0 var(--sp-2); border-radius: var(--r); transition: color .15s, background .15s; }
.toggle-visibility--text span { font-size: var(--fs-sm); }
.toggle-visibility:hover { color: var(--c-text); background: var(--c-surface-2); }
</style>
