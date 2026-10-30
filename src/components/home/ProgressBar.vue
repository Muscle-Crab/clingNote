<template>
  <div class="progress-section" :class="{ 'is-zooming': growing }" @click="skipAnims">
    <div class="progress-top" data-coach="grow">
      <div class="progress-ring" role="img" :aria-label="'Progress ' + pct + ' percent'">
        <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">
          <circle cx="50" cy="50" r="42" class="ring-track" />
          <circle cx="50" cy="50" r="42" class="ring-fill" :stroke-dasharray="C" :stroke-dashoffset="C * (1 - shownPct / 100)" />
        </svg>
        <span class="progress-pct" data-test="progress-pct" :class="{ 'num-bump': bump.pct }" :style="pct >= 100 ? { fontSize: '20px' } : null">{{ Math.round(shownPct) }}%</span>
      </div>
      <div class="progress-copy">
        <p class="progress-label">Daily progress</p>
        <p v-if="total !== null" class="progress-sub"><span class="num-roll" data-test="progress-done" :class="{ 'num-bump': bump.done }">{{ Math.round(shownDone) }}</span> of {{ total }} tasks complete</p>
        <div class="milestone-row">
          <div v-for="(milestone, index) in milestones" :key="index" class="milestone-dot"
               :class="{ 'milestone-dot--reached': grow >= milestone.percent && milestone !== current, 'milestone-dot--current': milestone === current, 'milestone-dot--future': grow < milestone.percent, 'milestone-dot--pop': popIndex === index }" :data-test="'milestone-' + index"
               :title="milestone.icon + ' ' + milestone.percent + '%'">
            <span class="milestone-icon">{{ milestone.icon }}</span>
          </div>
        </div>
      </div>
      <div class="progress-scene" aria-hidden="true" data-test="plant-scene" :data-stage="shownStage" :class="{ 'scene--zoom': growing }">
        <!-- one layer per milestone stage, all in the DOM (so they preload); the shown one is on. On a stage-up the camera
             zooms in (the scene briefly covers the card), the old plant swells and fades while the new one grows up from the soil. -->
        <div class="scene-cam">
          <div v-for="(img, i) in STAGE_IMAGES" :key="i" class="scene-layer"
               :class="{ 'scene-layer--on': i === shownStage, 'scene-layer--from': growing && i === growFrom, 'scene-layer--to': growing && i === shownStage }"
               :style="{ backgroundImage: `url(${img})` }"></div>
          <div v-if="growing" class="scene-sparkle"></div>
        </div>
      </div>
    </div>
    <div class="progress-foot">
      <p class="foot-item foot-item--streak" :class="{ 'foot-item--risk': streakStatus === 'at-risk' }" :title="`Complete ${streakMin} tasks a day (after Start Day) to keep your streak. Today: ${streakProgress}/${streakMin}. Every ${FREEZE_EVERY} days in a row earns a freeze (max ${FREEZE_MAX}) that covers a missed day.`">
        <span class="foot-icon"><span aria-hidden="true" data-test="streak-icon">{{ offToday ? '🏖️' : '🔥' }}</span><span v-if="freezes > 0" class="foot-freeze" data-test="streak-freezes" :title="`${freezes} streak freeze${freezes === 1 ? '' : 's'} held: covers a missed day automatically. Earn 1 per ${FREEZE_EVERY} days in a row (max ${FREEZE_MAX}).`" :aria-label="`${freezes} streak freeze${freezes === 1 ? '' : 's'}`">🧊{{ freezes }}</span></span>
        <span class="foot-text"><span><strong data-test="streak-count">{{ Math.min(shownStreak, STREAK_CAP) }}/{{ STREAK_CAP }}</strong>&nbsp;day streak</span><small v-if="offToday" data-test="streak-today">Day off · streak safe</small><small v-else data-test="streak-today">{{ Math.min(streakProgress, streakMin) }}/{{ streakMin }} done today to keep it</small></span>
      </p>
      <!-- kill-streak style level-up: overlay only while animating (charge: medal ring fills + number ticks up, then impact) -->
      <div v-if="streakFx" class="streak-fx" :class="'streak-fx--' + streakFx.phase" data-test="streak-fx" aria-hidden="true">
        <svg viewBox="0 0 64 64" class="streak-medal" data-test="streak-rank" :data-rank="fxRank.name" :style="{ '--rank-glow': fxRank.glow, '--rank-burst': fxRank.burst }"><circle cx="32" cy="32" r="27" class="medal-track" />
          <!-- rank emblem (PUBG-style tier) inside the existing medal: charge shows the current tier, impact swaps to the reached one -->
          <path :d="RANK_SHAPES[fxRank.shape]" class="rank-emblem" :data-test="'rank-emblem-' + fxRank.name.toLowerCase()" :fill="fxRank.fill" :stroke="fxRank.rim" transform="rotate(90 32 32)" />
          <g v-if="streakFx.burst" class="rank-burst" data-test="rank-burst" :data-rank="fxRank.name"><line v-for="a in 12" :key="a" x1="32" y1="6" x2="32" y2="0" :stroke="fxRank.burst" :transform="`rotate(${a * 30} 32 32)`" /></g>
          <circle cx="32" cy="32" r="27" class="medal-fill" :stroke="fxRank.rim" :stroke-dasharray="MC" :stroke-dashoffset="MC * (1 - streakFx.fill)" /></svg>
        <span class="streak-fx-num" :style="{ transform: `scale(${0.7 + streakFx.fill * 0.6})` }">{{ Math.round(streakFx.num) }}</span>
        <span class="streak-fx-label" data-test="streak-rank-label">{{ fxRank.name.toUpperCase() }} · DAY STREAK</span>
      </div>
      <p class="foot-item foot-item--pts"><span class="coin" aria-hidden="true">★</span><strong data-test="day-pts" :class="{ 'num-bump': bump.pts }">{{ target > 0 ? dayPtsLabel(Math.round(shownPts), target) : `${Math.round(shownPts)} pts` }}</strong></p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import { sfx, coinTickTimes } from '@/utils/sfx';
import { tweenNumber, prefersReducedMotion, readSeen, writeSeen } from '@/utils/countUp';
import { localDateStr } from '@/utils/streak';
import { STREAK_CAP, FREEZE_EVERY, FREEZE_MAX } from '@/utils/streak';
import { rankFor, rankUp, RANK_SHAPES } from '@/utils/streakRank';
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
  hold: { type: Boolean, default: false }, // a full-screen overlay (reward/loss) is up: queue the streak level-up until it closes
  uid: { type: String, default: '' }, // last-seen plant stage / streak are remembered per user on this device
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

// ── Live animation layer ─────────────────────────────────────────────────────────────────────────────
// Values settle silently for SETTLE_MS after mount (data loads in), then every real change animates.
const SETTLE_MS = 1200;
const MC = 2 * Math.PI * 27;
let settled = false; const timers = []; const cancels = {};
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const shownPct = ref(pct.value), shownDone = ref(props.done), shownPts = ref(props.points);
const bump = reactive({ pct: false, done: false, pts: false });
const pulse = (k) => { bump[k] = false; window.requestAnimationFrame(() => { bump[k] = true; later(() => { bump[k] = false; }, 450); }); };
const animate = (key, target, to, ms, k) => {
  if (cancels[key]) cancels[key]();
  if (!settled) { target.value = to; return; }
  const from = target.value; if (from === to) return;
  cancels[key] = tweenNumber(from, to, ms, (v) => { target.value = v; });
  if (to > from && !prefersReducedMotion()) pulse(k);
};
watch(pct, (v) => animate('pct', shownPct, v, 700, 'pct'));
watch(() => props.done, (v) => animate('done', shownDone, v, 500, 'done'));
watch(() => props.points, (to, from) => {
  const was = shownPts.value; animate('pts', shownPts, to, 900, 'pts');
  if (!settled || !(to > from)) return;
  // coin-counter clinks synced to the tick-up (capped ~12 for big jumps), then a final coin chime
  const times = coinTickTimes(to - was, 800); times.forEach((t, i) => later(() => sfx('coin', { step: i }), t)); later(() => sfx('points'), 860);
});

// plant stage (driven by growPct: today's task % or points vs the target, whichever is further)
const shownStage = ref(stageIndex.value), growFrom = ref(-1), growing = ref(false), popIndex = ref(-1);
const today = () => localDateStr();
const GROW_MS = 2600;
const playGrow = (from, to) => {
  shownStage.value = to; writeSeen('stage', props.uid, to, today());
  popIndex.value = to; later(() => { if (popIndex.value === to) popIndex.value = -1; }, 1400);
  if (prefersReducedMotion()) return; // reduced motion: plain crossfade + static highlight
  growFrom.value = from; growing.value = true; sfx('grow');
  later(() => { growing.value = false; growFrom.value = -1; }, GROW_MS);
};
watch(stageIndex, (to) => {
  if (!settled) { shownStage.value = to; return; }
  const from = shownStage.value;
  if (to > from) playGrow(from, to); else { shownStage.value = to; writeSeen('stage', props.uid, to, today()); }
});

// streak: kill-streak style counter (charge ~1s: medal fills, number ticks up + scales; impact: overshoot/shake/glow; settle)
const shownStreak = ref(props.streak), streakFx = ref(null);
let queued = null;
const fxRank = computed(() => rankFor(streakFx.value ? streakFx.value.rank : shownStreak.value));
const playStreak = (from, to) => {
  if (props.hold) { queued = [from, to]; return; }
  writeSeen('streak', props.uid, to);
  if (prefersReducedMotion()) { shownStreak.value = to; return; }
  const CHARGE = 1000; streakFx.value = { phase: 'charge', fill: 0, num: from, rank: from, burst: false }; sfx('charge', { dur: CHARGE / 1000, force: false });
  cancels.streak = tweenNumber(0, 1, CHARGE, (v) => { if (streakFx.value) { streakFx.value.fill = v; streakFx.value.num = from + (to - from) * v; } }, (t) => t * t);
  later(() => { if (!streakFx.value) return; streakFx.value = { phase: 'impact', fill: 1, num: to, rank: to, burst: rankUp(from, to) }; sfx('impact'); }, CHARGE);
  later(() => { if (streakFx.value) { streakFx.value.phase = 'settle'; } shownStreak.value = to; }, CHARGE + 700);
  later(() => { streakFx.value = null; }, CHARGE + 1150);
};
watch(() => props.streak, (to) => {
  if (!settled) { shownStreak.value = to; return; }
  if (to > shownStreak.value) playStreak(shownStreak.value, to); else { shownStreak.value = to; writeSeen('streak', props.uid, to); }
});
watch(() => props.hold, (h) => { if (!h && queued) { const [f, t] = queued; queued = null; later(() => playStreak(f, t), 350); } });
const skipAnims = () => {
  if (!growing.value && !streakFx.value) return;
  growing.value = false; growFrom.value = -1;
  if (streakFx.value) { if (cancels.streak) cancels.streak(); shownStreak.value = props.streak; streakFx.value = null; }
};
onMounted(() => {
  later(() => {
    settled = true;
    shownPct.value = pct.value; shownDone.value = props.done; shownPts.value = props.points;
    // catch up a transition that happened while Home was not visible (once per transition, per user+device)
    const seenStage = readSeen('stage', props.uid, today());
    if (seenStage !== null && stageIndex.value > seenStage) { shownStage.value = seenStage; playGrow(seenStage, stageIndex.value); } else { shownStage.value = stageIndex.value; writeSeen('stage', props.uid, stageIndex.value, today()); }
    const seenStreak = readSeen('streak', props.uid);
    if (seenStreak !== null && props.streak > seenStreak) { shownStreak.value = seenStreak; playStreak(seenStreak, props.streak); } else { shownStreak.value = props.streak; writeSeen('streak', props.uid, props.streak); }
  }, SETTLE_MS);
});
onBeforeUnmount(() => { timers.forEach(clearTimeout); Object.values(cancels).forEach((c) => c && c()); });
defineExpose({ skipAnims });
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
/* ── live animations ── */
.num-bump { display: inline-block; animation: num-bump .45s cubic-bezier(.3,1.6,.5,1); }
@keyframes num-bump { 0% { transform: scale(1); } 40% { transform: scale(1.22); color: #FFE08A; } 100% { transform: scale(1); } }
.milestone-dot--pop { animation: dot-pop 1.2s ease-out; }
@keyframes dot-pop { 0% { transform: scale(.7); filter: grayscale(1); } 35% { transform: scale(1.45); box-shadow: 0 0 0 6px rgba(79,149,255,.45), 0 0 26px rgba(140,220,120,.9); } 100% { transform: scale(1.12); } }
.scene-cam { position: absolute; inset: 0; transform-origin: 78% 62%; }
.progress-scene.scene--zoom { z-index: 3; width: 100%; -webkit-mask-image: none; mask-image: none; background: var(--c-surface); animation: scene-cover 2.6s ease-in-out both; }
.scene--zoom .scene-cam { animation: cam-zoom 2.6s cubic-bezier(.45,0,.25,1) both; }
@keyframes scene-cover { 0% { clip-path: inset(0 0 0 38% round 0); } 15%, 82% { clip-path: inset(0 0 0 0 round 0); } 100% { clip-path: inset(0 0 0 38% round 0); } }
@keyframes cam-zoom { 0% { transform: scale(1); } 18% { transform: scale(1.9); } 80% { transform: scale(1.9); } 100% { transform: scale(1); } }
.scene-layer--from { opacity: .95; transform-origin: 78% 92%; animation: plant-out 1.4s ease-in .35s both; }
.scene-layer--to { transform-origin: 78% 92%; animation: plant-in 1.5s cubic-bezier(.2,1.4,.4,1) .55s both; }
@keyframes plant-out { 0% { opacity: .95; transform: scale(1); filter: brightness(1); } 60% { opacity: .7; transform: scale(1.1); filter: brightness(1.4); } 100% { opacity: 0; transform: scale(1.18); } }
@keyframes plant-in { 0% { opacity: 0; transform: scale(.45) translateY(10%); clip-path: inset(100% 0 0 0); filter: brightness(1.6); } 45% { opacity: 1; clip-path: inset(0 0 0 0); } 75% { transform: scale(1.08); filter: brightness(1.15); } 100% { opacity: .95; transform: scale(1); filter: none; } }
.scene-sparkle { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 78% 60%, rgba(190,255,160,.55), transparent 45%); opacity: 0; animation: sparkle 1.2s ease-out 1.1s both; }
@keyframes sparkle { 0% { opacity: 0; transform: scale(.6); } 40% { opacity: 1; } 100% { opacity: 0; transform: scale(1.4); } }
.progress-foot { position: relative; }
.streak-fx { position: absolute; z-index: 4; left: 0; top: 50%; width: 50%; display: flex; align-items: center; justify-content: center; gap: 10px; pointer-events: none; transform: translateY(-50%); }
.streak-medal { position: absolute; width: 64px; height: 64px; left: calc(50% - 32px); top: calc(50% - 32px); transform: rotate(-90deg); filter: drop-shadow(0 0 6px rgba(255,170,40,.6)); }
.medal-track { fill: rgba(10,18,40,.85); stroke: rgba(255,255,255,.15); stroke-width: 5; }
.medal-fill { fill: none; stroke-width: 5; stroke-linecap: round; }
.streak-fx-num { position: relative; font-size: 34px; font-weight: 900; color: #FFF3D6; text-shadow: 0 0 10px rgba(255,150,30,.9), 0 2px 0 #7A3A00; font-variant-numeric: tabular-nums; }
.streak-fx-label { position: absolute; top: calc(50% + 26px); font-size: 9px; font-weight: 900; letter-spacing: .18em; color: #FFCF7A; text-shadow: 0 0 6px rgba(255,140,0,.8); }
.streak-fx--impact .streak-fx-num { animation: fx-impact .7s cubic-bezier(.2,2,.4,1) both; }
.streak-fx--impact { animation: fx-shake .35s linear; }
.rank-emblem { stroke-width: 2; opacity: .9; transition: fill .2s, stroke .2s; }
.streak-fx--impact .rank-emblem { transform-origin: 32px 32px; animation: rank-pop .6s cubic-bezier(.2,2,.4,1) both; }
@keyframes rank-pop { 0% { transform: rotate(90deg) scale(.6); } 40% { transform: rotate(90deg) scale(1.25); } 100% { transform: rotate(90deg) scale(1); } }
.rank-burst line { stroke-width: 3; stroke-linecap: round; transform-box: view-box; animation: rank-burst .65s ease-out both; }
@keyframes rank-burst { 0% { opacity: 0; stroke-dasharray: 0 8; } 30% { opacity: 1; } 100% { opacity: 0; stroke-dasharray: 6 8; stroke-dashoffset: -6; } }
.streak-fx--impact .streak-medal { filter: drop-shadow(0 0 16px var(--rank-glow, rgba(255,190,60,1))); }
@keyframes fx-impact { 0% { transform: scale(1.3); } 25% { transform: scale(2.1); color: #fff; text-shadow: 0 0 24px #FFB23F, 0 0 46px #FF6A00; } 100% { transform: scale(1.4); } }
@keyframes fx-shake { 0%,100% { transform: translate(0,-50%); } 20% { transform: translate(-4px,calc(-50% + 2px)); } 40% { transform: translate(4px,calc(-50% - 2px)); } 60% { transform: translate(-3px,-50%); } 80% { transform: translate(2px,calc(-50% + 1px)); } }
.streak-fx--settle { animation: fx-settle .45s ease-in both; }
@keyframes fx-settle { to { opacity: 0; transform: translate(-30%,-50%) scale(.4); } }
@media (prefers-reduced-motion: reduce) { .num-bump, .milestone-dot--pop, .scene-layer--from, .scene-layer--to, .scene--zoom, .scene--zoom .scene-cam, .scene-sparkle, .streak-fx * { animation: none !important; } .streak-fx { display: none; } }
</style>
