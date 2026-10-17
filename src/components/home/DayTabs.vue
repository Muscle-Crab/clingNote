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
.day-tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-bottom: 1.25rem; }
.day-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid #2a2a2e;
  background: #1a1a1e;
  cursor: pointer;
  transition: all 0.15s;
  color: #9a9891;
  font-family: inherit;
}
.day-tab:hover { border-color: #3a3a3e; color: #e8e6e1; }
.day-tab--selected { background: #1e2a3a; border-color: #378ADD; color: #7fb8f5; }
.day-tab--today { background: #378ADD; border-color: #378ADD; color: #fff; font-weight: 600; }
.day-tab-name { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.day-tab-date { font-size: 0.8rem; font-weight: 500; margin-top: 2px; }
</style>
