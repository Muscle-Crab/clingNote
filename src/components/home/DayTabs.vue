<template>
  <div class="day-tabs">
    <button
        v-for="{ day, index } in ordered"
        :key="index"
        class="day-tab"
        :class="{
        'day-tab--today': isToday(index),
        'day-tab--selected': index === selectedIndex
      }"
        :aria-pressed="index === selectedIndex ? 'true' : 'false'"
        @click="$emit('select', index)"
    >
      <span class="day-tab-name">{{ day.day }}</span>
      <span class="day-tab-date">{{ dayNumber(day.date) }}</span>
      <span v-if="scheduledCounts[day.date]" class="day-tab-dot" :title="scheduledCounts[day.date] + ' scheduled'" aria-hidden="true"></span>
      <span v-if="scheduledCounts[day.date]" class="sr-only">{{ scheduledCounts[day.date] }} scheduled</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { isToday } from '@/utils/dateTime';
import { rollingOrder } from '@/utils/scheduling';

const props = defineProps({
  days: { type: Array, required: true },
  selectedIndex: { type: Number, default: -1 },
  scheduledCounts: { type: Object, default: () => ({}) },
});
defineEmits(['select']);
// Rolling order: today first, then the next six days (index stays the weekday, so storage is unchanged).
const ordered = computed(() => rollingOrder().filter((i) => props.days[i]).map((i) => ({ day: props.days[i], index: i })));
const dayNumber = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? String(Number(d.slice(8))) : d);
</script>

<style scoped>
.day-tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: var(--sp-4) 0; }
.day-tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 52px; padding: 6px 0 10px; background: transparent; border: 1px solid transparent; border-radius: var(--r-pill); cursor: pointer; color: var(--c-text-2); font-family: inherit; transition: background .15s, color .15s, border-color .15s; }
.day-tab:hover { background: var(--c-surface-2); color: var(--c-text); }
.day-tab--selected, .day-tab--selected:hover { background: var(--c-accent); color: var(--c-on-accent); }
.day-tab--today:not(.day-tab--selected) { border-color: var(--c-accent-line); }
.day-tab-name { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
.day-tab-date { font-size: var(--fs-lg); font-weight: 700; margin-top: 2px; line-height: 20px; font-variant-numeric: tabular-nums; }
.day-tab-dot { position: absolute; bottom: 4px; width: 5px; height: 5px; border-radius: 50%; background: var(--c-warn); }
.day-tab--selected .day-tab-dot { background: var(--c-on-accent); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
