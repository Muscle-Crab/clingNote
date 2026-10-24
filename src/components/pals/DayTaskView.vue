<template>
  <!-- Same day-based view the member sees (DayTabs + TaskCard), read-only, today first. Private tasks are stripped server-side. -->
  <div class="dtv" data-test="day-task-view">
    <DayTabs :days="tabDays" :selected-index="dayIdx" @select="(i) => (dayIdx = i)" />
    <h2 class="dtv-sec">{{ dayIdx === todayIdx ? 'Today' : FULL[dayIdx] }} <small class="dtv-muted">{{ dayDone }}/{{ dayTasks.length }} done</small></h2>
    <div v-if="!dayTasks.length" class="dtv-empty">No public tasks on {{ dayIdx === todayIdx ? 'today' : FULL[dayIdx] }}.</div>
    <div v-for="(t, k) in dayTasks" :key="t.key" class="dtv-row" :class="{ late: t.overdue }" :data-test="rowTest">
      <div class="dtv-ro" inert aria-readonly="true"><TaskCard :task="cardTask(t)" :index="k" :drag-disabled="true" :is-today-tab="dayIdx === todayIdx" /></div>
      <slot name="actions" :task="t" />
    </div>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import DayTabs from '@/components/home/DayTabs.vue';
import TaskCard from '@/components/home/TaskCard.vue';
import { withWeekDates } from '@/utils/scheduling';
import appData from '@/data.json';
const props = defineProps({ tasks: { type: Array, default: () => [] }, rowTest: { type: String, default: 'day-task' } });
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayIdx = new Date().getDay(); const dayIdx = ref(todayIdx);
const tabDays = computed(() => withWeekDates(appData.days));
const dayTasks = computed(() => { const d = tabDays.value[dayIdx.value] || {}; return props.tasks.filter((t) => (t.upcoming && t.scheduled ? t.scheduled.date === d.date : FULL.indexOf(t.day) === dayIdx.value)); });
const dayDone = computed(() => dayTasks.value.filter((t) => t.completed).length);
const cardTask = (t) => ({ title: t.title, completed: t.completed, important: t.important, reminder: t.reminder || undefined, status: t.completed ? 'done' : 'todo', createdAt: t.key,
  ...(t.scheduled ? { scheduledFor: t.scheduled.date, time: t.scheduled.time, repeatText: t.scheduled.repeat } : {}) });
</script>
<style scoped>
.dtv-sec { font-size: 15px; font-weight: 800; margin: 14px 0 8px; } .dtv-muted { opacity: .6; font-weight: 600; }
.dtv-empty { opacity: .65; padding: 14px; border-radius: 14px; background: rgba(255,255,255,.04); }
.dtv-row { position: relative; margin-bottom: 8px; } .dtv-row.late .dtv-ro { box-shadow: 0 0 0 1.5px rgba(255,90,70,.5); border-radius: 16px; }
.dtv-ro { pointer-events: none; }
</style>
