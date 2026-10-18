<template>
  <div class="progress-section">
    <div class="progress-top">
      <div class="progress-pct">{{ percentage }}<span class="progress-pct-sign">%</span></div>
      <div class="progress-copy">
        <p class="progress-label">Daily progress</p>
        <p v-if="total !== null" class="progress-sub">{{ done }} of {{ total }} tasks complete</p>
      </div>
      <div class="ring" role="img" :aria-label="'Progress ' + percentage + ' percent'">
        <svg viewBox="0 0 80 80" class="ring-svg">
          <circle cx="40" cy="40" r="34" class="ring-track" />
          <circle cx="40" cy="40" r="34" class="ring-fill" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - Math.min(100, Math.max(0, percentage)) / 100)" />
        </svg>
        <span class="ring-icon">{{ currentIcon }}</span>
      </div>
    </div>
    <div class="milestone-row">
      <div
          v-for="(milestone, index) in milestones"
          :key="index"
          class="milestone-dot"
          :class="{ 'milestone-dot--reached': percentage >= milestone.percent }"
          :title="milestone.icon + ' ' + milestone.percent + '%'"
      >
        <span class="milestone-icon">{{ milestone.icon }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  percentage: { type: Number, default: 0 },
  milestones: { type: Array, required: true },
  done: { type: Number, default: 0 },
  total: { type: Number, default: null },
});
const C = 2 * Math.PI * 34;
const currentIcon = computed(() => {
  const reached = props.milestones.filter((m) => props.percentage >= m.percent);
  return (reached[reached.length - 1] || props.milestones[0] || {}).icon || '';
});
</script>

<style scoped>
.progress-section { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); padding: var(--sp-4); }
.progress-top { display: flex; align-items: center; gap: var(--sp-4); }
.progress-pct { font-size: 44px; line-height: 1; font-weight: 800; letter-spacing: -.02em; color: var(--c-accent-text); font-variant-numeric: tabular-nums; }
.progress-pct-sign { font-size: 28px; }
.progress-copy { flex: 1; min-width: 0; padding-left: var(--sp-4); border-left: 1px solid var(--c-border); }
.progress-label { margin: 0; font-size: var(--fs-lg); font-weight: 700; color: var(--c-text); }
.progress-sub { margin: 2px 0 0; font-size: var(--fs-sm); color: var(--c-text-2); }
.ring { position: relative; width: 56px; height: 56px; flex-shrink: 0; }
.ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: var(--c-surface-2); stroke-width: 7; }
.ring-fill { fill: none; stroke: var(--c-accent); stroke-width: 7; stroke-linecap: round; transition: stroke-dashoffset .5s ease; }
.ring-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.milestone-row { position: relative; display: flex; justify-content: space-between; margin-top: var(--sp-4); }
.milestone-row::before { content: ''; position: absolute; left: 16px; right: 16px; top: 50%; border-top: 1px dashed var(--c-border-strong); }
.milestone-dot { position: relative; width: 32px; height: 32px; box-sizing: border-box; border-radius: 50%; background: var(--c-surface); border: 1px solid var(--c-border-strong); display: flex; align-items: center; justify-content: center; transition: all .3s; font-size: 15px; filter: grayscale(1); opacity: .75; }
.milestone-dot--reached { background: var(--c-accent-soft); border-color: var(--c-accent); filter: none; opacity: 1; }
</style>
