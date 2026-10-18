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
.chip--high { background: var(--c-danger-soft); color: var(--c-danger-text); }
.chip--medium { background: var(--c-warn-soft); color: var(--c-warn-text); }
.load-summary--over { border-color: var(--c-danger-line); }
.schedule-panel { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r); padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-3); font-size: var(--fs-sm); color: var(--c-text-2); box-shadow: var(--shadow-1); }
.schedule-list { list-style: none; margin: 0; padding: 0 0 0 var(--sp-3); border-left: 2px solid var(--c-border); display: flex; flex-direction: column; }
.schedule-list li { position: relative; display: flex; gap: var(--sp-3); align-items: baseline; padding: 6px var(--sp-2); border-bottom: 1px solid var(--c-border); font-size: var(--fs-md); color: var(--c-text); transition: background .15s; }
.schedule-list li:last-child { border-bottom: none; }
.schedule-list li:hover { background: var(--c-surface-2); }
.schedule-list li::before { content: ''; position: absolute; left: -19px; top: 14px; width: 8px; height: 8px; border-radius: 50%; background: var(--c-accent); border: 2px solid var(--c-surface); }
.schedule-time { font-family: 'JetBrains Mono', monospace; font-size: var(--fs-sm); color: var(--c-accent-text); min-width: 9.5rem; }
.schedule-conflict::before { background: var(--c-danger) !important; }
.schedule-conflict .schedule-flag { color: var(--c-danger-text); font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; margin-left: auto; }
.schedule-done { opacity: .5; text-decoration: line-through; }
.schedule-empty, .schedule-unsched { margin: 0; color: var(--c-text-3); }
.schedule-unsched { margin-top: var(--sp-2); }
@media (max-width: 480px) { .schedule-time { min-width: 0; } .schedule-list li { flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); } }
</style>
