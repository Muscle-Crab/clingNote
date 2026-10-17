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
.chip--high { background: #3b0d0d; color: #fca5a5; }
.chip--medium { background: #3a2d0a; color: #fcd34d; }
.load-summary {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem;
  font-size: 0.8rem; color: #c9c8c3; background: #18181b; border: 1px solid #2a2a2e;
  border-radius: 12px; padding: 0.5rem 0.875rem; margin-bottom: 0.75rem;
}
.load-hint { color: #86efac; }
.load-summary--full .load-hint { color: #fcd34d; }
.load-summary--over { border-color: #7f1d1d; }
.load-summary--over .load-hint { color: #fca5a5; }
.link-btn { background: none; border: none; color: #9cc7f7; cursor: pointer; font: inherit; text-decoration: underline; margin-left: auto; }
</style>
