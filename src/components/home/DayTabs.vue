<template>
  <div class="day-tabs">
    <button
        v-for="(day, index) in days"
        :key="index"
        class="day-tab"
        :class="{
        'day-tab--today': isToday(index),
        'day-tab--selected': index === selectedIndex
      }"
        @click="$emit('select', index)"
    >
      <span class="day-tab-name">{{ day.day }}</span>
      <span class="day-tab-date">{{ day.date }}</span>
    </button>
  </div>
</template>

<script setup>
import { isToday } from '@/utils/dateTime';

defineProps({
  days: { type: Array, required: true },
  selectedIndex: { type: Number, default: -1 },
});
defineEmits(['select']);
</script>

<style scoped>
.day-tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; margin-bottom: var(--sp-4); border-bottom: 2px solid var(--c-border); }
.day-tab { display: flex; flex-direction: column; align-items: center; padding: var(--sp-2) var(--sp-1) 6px; background: transparent; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; border-radius: var(--r) var(--r) 0 0; cursor: pointer; color: var(--c-text-3); font-family: inherit; transition: background .15s, color .15s, border-color .15s; }
.day-tab:hover { background: var(--c-surface-2); color: var(--c-text); }
.day-tab--selected { color: var(--c-accent-text); border-bottom-color: var(--c-accent-text); }
.day-tab--today .day-tab-date { background: var(--c-accent); color: var(--c-on-accent); border-radius: var(--r); padding: 0 6px; }
.day-tab--today.day-tab--selected { color: var(--c-accent-text); }
.day-tab-name { font-size: var(--fs-xs); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.day-tab-date { font-size: var(--fs-sm); font-weight: 500; margin-top: 2px; line-height: 18px; }
@media (max-width: 480px) { .day-tab-name { font-size: 10px; } .day-tab-date { padding: 0 4px; } }
</style>
