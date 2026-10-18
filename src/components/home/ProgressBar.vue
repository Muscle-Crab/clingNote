<template>
          <div class="progress-section">
            <div class="progress-info">
              <span class="progress-label">Progress</span>
              <span class="progress-pct">{{ percentage }}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: percentage + '%' }"></div>
            </div>
            <div class="milestone-row">
              <div
                  v-for="(milestone, index) in milestones"
                  :key="index"
                  class="milestone-dot"
                  :class="{
                  'milestone-dot--reached': percentage >= milestone.percent
                }"
                  :style="{ left: index === 0 ? '0%' : index === milestones.length - 1 ? 'calc(100% - 28px)' : `calc(${milestone.position}% - 14px)` }"
                  :title="milestone.icon + ' ' + milestone.percent + '%'"
              >
                <span class="milestone-icon">{{ milestone.icon }}</span>
              </div>
            </div>
          </div>
</template>

<script setup>
defineProps({
  percentage: { type: Number, default: 0 },
  milestones: { type: Array, required: true },
});
</script>

<style scoped>
.progress-section { padding-top: var(--sp-2); }
.progress-info { display: flex; justify-content: space-between; margin-bottom: var(--sp-1); }
.progress-label { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3); }
.progress-pct { font-size: var(--fs-sm); font-weight: 600; color: var(--c-accent-text); font-family: 'JetBrains Mono', monospace; }
.progress-track { width: 100%; height: 4px; background: var(--c-surface-2); border-radius: 2px; overflow: hidden; margin-bottom: var(--sp-3); }
.progress-fill { height: 100%; background: var(--c-accent); border-radius: 2px; transition: width .5s ease; }
.milestone-row { position: relative; height: 28px; }
.milestone-dot { position: absolute; top: 0; width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; background: var(--c-surface-2); border: 2px solid var(--c-border); display: flex; align-items: center; justify-content: center; transition: all .3s; font-size: var(--fs-md); filter: grayscale(1); opacity: .7; }
.milestone-dot--reached { background: var(--c-accent-soft); border-color: var(--c-accent); filter: none; opacity: 1; }
</style>
