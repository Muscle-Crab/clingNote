<template>
  <div data-test="pal-tasks">
    <p v-if="!tasks.length" class="pl-muted">No tasks this week yet.</p>
    <template v-for="g in groups" :key="g.id">
      <div v-if="g.items.length" class="pl-sec" :class="g.cls">{{ g.label }} · {{ g.items.length }}</div>
      <div v-for="t in g.items" :key="t.key" class="pl-task" :class="{ done: t.completed, late: t.overdue }">
        <span class="pl-chk" :class="{ on: t.completed }">{{ t.completed ? '✓' : '' }}</span>
        <div class="pl-grow"><div class="pl-name" :class="{ 'pl-anon': t.anonymous }"><span v-if="t.anonymous" class="pl-lock" aria-hidden="true">🔒 </span>{{ t.title }}</div><div class="pl-small">{{ t.day }}<span v-if="t.scheduled && t.upcoming"> · {{ t.scheduled.date.slice(5) }}</span><span v-if="t.reminder && t.reminder.time"> · ⏰ {{ t.reminder.time }}</span><span v-if="t.scheduled && t.scheduled.repeat" data-test="pal-repeat"> · 🔁 {{ t.scheduled.repeat }}</span></div></div>
      </div>
    </template>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { groupTasks } from '@/utils/pals';
const props = defineProps({ tasks: { type: Array, default: () => [] } });
const groups = computed(() => { const g = groupTasks(props.tasks); return [{ id: 'o', label: 'Overdue', cls: 'red', items: g.overdue }, { id: 'p', label: 'To do', cls: '', items: g.open }, { id: 'd', label: 'Done', cls: 'green', items: g.done }]; });
</script>

<style scoped>
.pl-anon { font-style: italic; opacity: .85; }
</style>
