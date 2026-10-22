<template>
  <div class="progress-section">
    <div class="progress-top">
      <div class="progress-ring" role="img" :aria-label="'Progress ' + pct + ' percent'">
        <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="42" class="ring-track" />
          <circle cx="50" cy="50" r="42" class="ring-fill" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - pct / 100)" />
        </svg>
        <span class="progress-pct">{{ pct }}%</span>
      </div>
      <div class="progress-copy">
        <p class="progress-label">Daily progress</p>
        <p v-if="total !== null" class="progress-sub">{{ done }} of {{ total }} tasks complete</p>
        <div class="milestone-row">
          <div v-for="(milestone, index) in milestones" :key="index" class="milestone-dot"
               :class="{ 'milestone-dot--reached': percentage >= milestone.percent, 'milestone-dot--current': milestone === current }"
               :title="milestone.icon + ' ' + milestone.percent + '%'">
            <span class="milestone-icon">{{ milestone.icon }}</span>
          </div>
        </div>
      </div>
      <div class="progress-scene" aria-hidden="true"></div>
    </div>
    <div class="progress-foot">
      <p class="foot-item" :class="{ 'foot-item--risk': streakStatus === 'at-risk' }" :title="streakStatus === 'at-risk' ? `Streak at risk: ${streakProgress}/${streakMin} today` : `Complete ${streakMin} tasks a day to keep it`">
        <span class="foot-icon" aria-hidden="true">🔥</span><strong>{{ streak }}</strong>&nbsp;day streak
      </p>
      <p class="foot-item foot-item--pts"><span class="coin" aria-hidden="true">★</span><strong>{{ points }}</strong>&nbsp;points</p>
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
  streak: { type: Number, default: 0 },
  streakStatus: { type: String, default: '' },
  streakProgress: { type: Number, default: 0 },
  streakMin: { type: Number, default: 5 },
  points: { type: Number, default: 0 },
});
const C = 2 * Math.PI * 42;
const pct = computed(() => Math.round(Math.min(100, Math.max(0, Number(props.percentage) || 0))));
const current = computed(() => {
  const reached = props.milestones.filter((m) => props.percentage >= m.percent);
  return reached[reached.length - 1] || props.milestones[0] || null;
});
</script>

<style scoped>
.progress-section { position: relative; overflow: hidden; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); }
.progress-top { position: relative; display: flex; align-items: center; gap: 16px; padding: 16px; }
.progress-ring { position: relative; width: 92px; height: 92px; flex-shrink: 0; }
.ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: rgba(255,255,255,.08); stroke-width: 9; }
.ring-fill { fill: none; stroke: var(--c-accent); stroke-width: 9; stroke-linecap: round; transition: stroke-dashoffset .5s ease; }
.progress-pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: var(--c-text); font-variant-numeric: tabular-nums; }
.progress-copy { flex: 1; min-width: 0; padding-left: 16px; border-left: 1px solid var(--c-border); position: relative; z-index: 1; }
.progress-label { margin: 0; font-size: 18px; font-weight: 700; color: var(--c-text); }
.progress-sub { margin: 2px 0 0; font-size: var(--fs-md); color: var(--c-text-2); }
.progress-scene { position: absolute; z-index: 0; top: 0; right: 0; bottom: 0; width: 62%; background: url('~@/assets/progress-sprout.jpg') 78% 60% / cover no-repeat; -webkit-mask-image: linear-gradient(90deg, transparent, #000 45%); mask-image: linear-gradient(90deg, transparent, #000 45%); opacity: .95; }
.progress-top > .progress-ring, .progress-top > .progress-copy { position: relative; z-index: 1; }
.plant { position: absolute; right: 12px; top: 8px; width: 96px; height: 64px; display: flex; align-items: flex-end; justify-content: center; border-radius: 50% 50% 0 0; background: radial-gradient(60% 50% at 50% 100%, rgba(61,220,151,.22), transparent 70%); }
.plant-icon { font-size: 40px; line-height: 1; filter: drop-shadow(0 4px 10px rgba(61,220,151,.35)); }
.milestone-row { position: relative; display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.milestone-row::before { content: ''; position: absolute; left: 30%; right: 12px; top: 50%; border-top: 1px dashed var(--c-border-strong); }
.milestone-dot { position: relative; width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; background: var(--c-surface); border: 1px solid var(--c-border-strong); display: flex; align-items: center; justify-content: center; font-size: 13px; filter: grayscale(1); opacity: .7; }
.milestone-dot--reached { filter: none; opacity: 1; }
.milestone-dot--current { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(47,111,255,.25); background: var(--c-accent-soft); }
.progress-foot { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--c-border); }
.foot-item { margin: 0; padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-size: var(--fs-md); color: var(--c-text-2); }
.foot-item + .foot-item { border-left: 1px solid var(--c-border); }
.foot-item strong { color: var(--c-text); font-size: 16px; }
.foot-item--risk strong { color: var(--c-warn); }
.foot-icon { font-size: 18px; }
.foot-item--pts strong { color: #F5C542; }
.coin { width: 22px; height: 22px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 12px; color: #7A4B00; background: radial-gradient(circle at 35% 30%, #FFE08A, #E0A21B); }
@media (max-width: 400px) { .progress-scene { position: absolute; z-index: 0; top: 0; right: 0; bottom: 0; width: 62%; background: url('~@/assets/progress-sprout.jpg') 78% 60% / cover no-repeat; -webkit-mask-image: linear-gradient(90deg, transparent, #000 45%); mask-image: linear-gradient(90deg, transparent, #000 45%); opacity: .95; }
.progress-top > .progress-ring, .progress-top > .progress-copy { position: relative; z-index: 1; }
.plant { width: 64px; } .plant-icon { font-size: 30px; } .progress-ring { width: 80px; height: 80px; } }
</style>
