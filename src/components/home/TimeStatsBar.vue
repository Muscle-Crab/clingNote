<template>
  <div class="stats-bar">
    <div class="stat"><p class="stat-label">Total</p><p class="stat-val">{{ stats.totalDayTime }}</p></div>
    <div class="stat"><p class="stat-label">Focus</p><p class="stat-val">{{ stats.productiveTime }}</p></div>
    <div class="stat"><p class="stat-label">Gap</p><p class="stat-val">{{ stats.gapTime }}</p></div>
    <div class="stat"><p class="stat-label">Done</p><p class="stat-val">{{ stats.completedTasks }}</p></div>
    <div class="stat"><p class="stat-label">Missed</p><p class="stat-val">{{ stats.missedTasks }}</p></div>
  </div>
</template>

<script setup>
defineProps({ stats: { type: Object, required: true } });
</script>

<style scoped>
.stats-bar { display: grid; grid-template-columns: repeat(5, 1fr); margin: var(--sp-3) 0 var(--sp-4); }
.stat { text-align: center; padding: 2px 0; }
.stat + .stat { border-left: 1px solid var(--c-border); }
.stat-label { margin: 0; font-size: var(--fs-xs); color: var(--c-text-3); }
.stat-val { margin: 2px 0 0; font-size: var(--fs-lg); font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
</style>
