<template>
  <div class="schedule-panel">
    <p v-if="!schedule.blocks.length" class="schedule-empty">No tasks have a start time yet. Tap a task to set one.</p>
    <ul v-else class="schedule-list">
      <li v-for="b in schedule.blocks" :key="b.task.createdAt + b.task.title" :class="{ 'schedule-conflict': b.conflict, 'schedule-done': b.task.completed }">
        <span class="schedule-time">{{ formatClock(b.start) }}<template v-if="b.end !== null"> – {{ formatClock(b.end) }}</template></span>
        <span>{{ b.task.title }}</span>
        <span v-if="b.conflict" class="schedule-flag">overlaps next</span>
      </li>
    </ul>
    <p v-if="schedule.unscheduled.length" class="schedule-unsched">Unscheduled: {{ schedule.unscheduled.filter(t => !t.completed).length }}</p>
  </div>
</template>

<script setup>
import { formatClock } from '@/utils/taskPlanning';

defineProps({ schedule: { type: Object, required: true } });
</script>

<style scoped>
.chip--high { background: #3b0d0d; color: #fca5a5; }
.chip--medium { background: #3a2d0a; color: #fcd34d; }
.load-summary--over { border-color: #7f1d1d; }
.schedule-panel { background: #18181b; border: 1px solid #2a2a2e; border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: #c9c8c3; }
.schedule-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.schedule-list li { display: flex; gap: 0.75rem; align-items: baseline; }
.schedule-time { font-family: 'JetBrains Mono', monospace; color: #7fb8f5; min-width: 9.5rem; }
.schedule-conflict .schedule-flag { color: #fca5a5; font-size: 0.7rem; }
.schedule-done { opacity: 0.5; text-decoration: line-through; }
.schedule-empty, .schedule-unsched { margin: 0; color: #a3a29d; }
.schedule-unsched { margin-top: 6px; }
@media (max-width: 480px) {
  .schedule-time { min-width: 0; } }
</style>
