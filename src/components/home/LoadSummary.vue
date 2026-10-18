<template>
  <div class="load-summary" :class="'load-summary--' + load.level">
    <span>⏱ <strong>{{ formatMinutes(load.minutes) }}</strong> planned · {{ load.count }} open</span>
    <span class="load-hint">{{ load.hint }}<template v-if="load.unestimated"> · {{ load.unestimated }} without estimate</template></span>
    <button type="button" class="link-btn" @click="$emit('toggle')" :aria-expanded="expanded">🗓 Schedule</button>
  </div>
</template>

<script setup>
import { formatDuration as formatMinutes } from '@/utils/taskPlanning';

defineProps({
  load: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
});
defineEmits(['toggle']);
</script>

<style scoped>
.chip--high { background: var(--c-danger-soft, #3b0d0d); color: var(--c-danger-text, #fca5a5); }
.chip--medium { background: var(--c-warn-soft, #3a2d0a); color: var(--c-warn-text, #fcd34d); }
.load-summary {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem;
  font-size: 0.8rem; color: var(--c-text, #c9c8c3); background: var(--c-surface, #18181b); border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px); padding: 0.5rem 0.875rem; margin-bottom: 0.75rem;
}
.load-hint { color: var(--c-success, #86efac); }
.load-summary--full .load-hint { color: var(--c-warn-text, #fcd34d); }
.load-summary--over { border-color: var(--c-danger-line, #7f1d1d); }
.load-summary--over .load-hint { color: var(--c-danger-text, #fca5a5); }
.link-btn { background: none; border: none; color: var(--c-accent-text, #9cc7f7); cursor: pointer; font: inherit; text-decoration: underline; margin-left: auto; }
.load-summary { font-size: var(--fs-sm); padding: var(--sp-2) var(--sp-3); box-shadow: var(--shadow-1); }
</style>
