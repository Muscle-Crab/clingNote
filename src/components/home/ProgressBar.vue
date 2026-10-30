<template>
  <div class="progress-section">
    <div class="progress-top" data-coach="grow">
      <div class="progress-ring" role="img" :aria-label="'Progress ' + pct + ' percent'">
        <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="42" class="ring-track" />
          <circle cx="50" cy="50" r="42" class="ring-fill" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - pct / 100)" />
        </svg>
        <span class="progress-pct" :style="pct >= 100 ? { fontSize: '20px' } : null">{{ pct }}%</span>
      </div>
      <div class="progress-copy">
        <p class="progress-label">Daily progress</p>
        <p v-if="total !== null" class="progress-sub">{{ done }} of {{ total }} tasks complete</p>
        <div class="milestone-row">
          <div v-for="(milestone, index) in milestones" :key="index" class="milestone-dot"
               :class="{ 'milestone-dot--reached': grow >= milestone.percent && milestone !== current, 'milestone-dot--current': milestone === current, 'milestone-dot--future': grow < milestone.percent }"
               :title="milestone.icon + ' ' + milestone.percent + '%'">
            <span class="milestone-icon">{{ milestone.icon }}</span>
          </div>
        </div>
      </div>
      <div class="progress-scene" aria-hidden="true">
        <!-- one layer per milestone stage, all in the DOM (so they preload); the current one fades in -->
        <div v-for="(img, i) in STAGE_IMAGES" :key="i" class="scene-layer" :class="{ 'scene-layer--on': i === stageIndex }" :style="{ backgroundImage: `url(${img})` }"></div>
      </div>
    </div>
    <div class="progress-foot">
      <p class="foot-item foot-item--streak" :class="{ 'foot-item--risk': streakStatus === 'at-risk' }" :title="`Complete ${streakMin} tasks a day (after Start Day) to keep your streak. Today: ${streakProgress}/${streakMin}. Every ${FREEZE_EVERY} days in a row earns a freeze (max ${FREEZE_MAX}) that covers a missed day.`">
        <span class="foot-icon"><span aria-hidden="true" data-test="streak-icon">{{ offToday ? '🏖️' : '🔥' }}</span><span v-if="freezes > 0" class="foot-freeze" data-test="streak-freezes" :title="`${freezes} streak freeze${freezes === 1 ? '' : 's'} held: covers a missed day automatically. Earn 1 per ${FREEZE_EVERY} days in a row (max ${FREEZE_MAX}).`" :aria-label="`${freezes} streak freeze${freezes === 1 ? '' : 's'}`">🧊{{ freezes }}</span></span>
        <span class="foot-text"><span><strong data-test="streak-count">{{ Math.min(streak, STREAK_CAP) }}/{{ STREAK_CAP }}</strong>&nbsp;day streak</span><small v-if="offToday" data-test="streak-today">Day off · streak safe</small><small v-else data-test="streak-today">{{ Math.min(streakProgress, streakMin) }}/{{ streakMin }} done today to keep it</small></span>
      </p>
      <p class="foot-item foot-item--pts"><span class="coin" aria-hidden="true">★</span><strong data-test="day-pts">{{ target > 0 ? dayPtsLabel(points, target) : `${points} pts` }}</strong></p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { STREAK_CAP, FREEZE_EVERY, FREEZE_MAX } from '@/utils/streak';
import { growPct } from '@/utils/planPhase2';
import { dayPtsLabel } from '@/utils/dayTarget';
import stage0 from '@/assets/stages/stage-0-sprout.jpg';
import stage1 from '@/assets/stages/stage-1-leafy.jpg';
import stage2 from '@/assets/stages/stage-2-tree.jpg';
import stage3 from '@/assets/stages/stage-3-pine.jpg';
import stage4 from '@/assets/stages/stage-4-peak.jpg';
const props = defineProps({
  percentage: { type: Number, default: 0 },
  milestones: { type: Array, required: true },
  done: { type: Number, default: 0 },
  total: { type: Number, default: null },
  streak: { type: Number, default: 0 },
  streakStatus: { type: String, default: '' },
  streakProgress: { type: Number, default: 0 },
  streakMin: { type: Number, default: 5 },
  freezes: { type: Number, default: 0 }, // held streak freeze days
  points: { type: Number, default: 0 },
  target: { type: Number, default: 0 }, // boss day target (required); shown as earned/required
  offToday: { type: Boolean, default: false }, // holiday mode: 🏖️ instead of 🔥
});
const C = 2 * Math.PI * 42;
// Scene art per stage, same order as the milestone icons: 🌱 sprout, 🌿 leafy plant, 🌳 tree, 🌲 pine, 🏔️ peak
const STAGE_IMAGES = [stage0, stage1, stage2, stage3, stage4];
const pct = computed(() => Math.round(Math.min(100, Math.max(0, Number(props.percentage) || 0))));
const stageIndex = computed(() => Math.max(0, Math.min(STAGE_IMAGES.length - 1, props.milestones.indexOf(current.value))));
// growing scene: grows with today's points (vs the target) or task progress, whichever is further
const grow = computed(() => growPct(props.percentage, props.points, props.target));
const current = computed(() => {
  const reached = props.milestones.filter((m) => grow.value >= m.percent);
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
.progress-scene { position: absolute; z-index: 0; top: 0; right: 0; bottom: 0; width: 62%; -webkit-mask-image: linear-gradient(90deg, transparent, #000 45%); mask-image: linear-gradient(90deg, transparent, #000 45%); }
.scene-layer { position: absolute; inset: 0; background-position: 78% 60%; background-size: cover; background-repeat: no-repeat; opacity: 0; transition: opacity .8s ease; }
.scene-layer--on { opacity: .95; }
.progress-top > .progress-ring, .progress-top > .progress-copy { position: relative; z-index: 1; }
.milestone-row { position: relative; display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.milestone-row::before { content: ''; position: absolute; left: 30%; right: 12px; top: 50%; border-top: 1px dashed var(--c-border-strong); }
.milestone-dot { position: relative; width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; background: var(--c-surface); border: 1px solid var(--c-border-strong); display: flex; align-items: center; justify-content: center; font-size: 13px; filter: grayscale(1); opacity: .7; }
.milestone-dot--reached { filter: none; opacity: 1; border-color: var(--c-accent-line); background: var(--c-accent-soft); box-shadow: 0 0 0 2px rgba(47,111,255,.18); }
.milestone-dot--future { filter: grayscale(1) brightness(.7); opacity: .55; }
.milestone-dot--current { filter: none; opacity: 1; transform: scale(1.12); border-color: #4F95FF; background: var(--c-accent-soft); box-shadow: 0 0 0 3px rgba(47,111,255,.35), 0 0 14px rgba(79,149,255,.55); }
.progress-foot { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--c-border); }
.foot-item { margin: 0; padding: 12px 16px; display: flex; align-items: center; gap: 8px; font-size: var(--fs-md); color: var(--c-text-2); }
.foot-item + .foot-item { border-left: 1px solid var(--c-border); }
.foot-item strong { color: var(--c-text); font-size: 16px; }
.foot-item--risk strong { color: var(--c-warn); }
.foot-icon { font-size: 18px; }
.foot-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.foot-text small { font-size: var(--fs-xs); color: var(--c-text-3); }
.foot-icon { position: relative; }
.foot-freeze { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 1px); padding: 0 4px; border-radius: 999px; font-size: 10px; line-height: 15px; font-weight: 700; white-space: nowrap; color: #9AD8FF; background: var(--c-surface-2, #12203F); border: 1px solid var(--c-border-strong, #2A3C66); }
.foot-item--risk small { color: var(--c-warn); }
.foot-item--pts strong { color: #F5C542; }
.coin { width: 22px; height: 22px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 12px; color: #7A4B00; background: radial-gradient(circle at 35% 30%, #FFE08A, #E0A21B); }
@media (max-width: 400px) { .progress-ring { width: 80px; height: 80px; } }
</style>
