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
.progress-section { padding-top: 0.75rem; }
.progress-info { display: flex; justify-content: space-between; margin-bottom: 6px; }
.progress-label { font-size: 0.75rem; color: #6b6a66; }
.progress-pct { font-size: 0.75rem; font-weight: 600; color: #378ADD; font-family: 'JetBrains Mono', monospace; }
.progress-track {
  width: 100%; height: 4px;
  background: #2a2a2e;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}
.progress-fill { height: 100%; background: #378ADD; border-radius: 4px; transition: width 0.6s ease; }
.milestone-row { position: relative; height: 36px; }
.milestone-dot {
  position: absolute;
  top: 0;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #2a2a2e;
  border: 2px solid #3a3a3e;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.4s;
  font-size: 0.9rem;
}
.milestone-dot--reached {
  background: #1e2a3a;
  border-color: #378ADD;
  transform: scale(1.15);
}
</style>
