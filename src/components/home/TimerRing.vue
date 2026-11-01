<template>
  <span class="timer-ring" :class="{ 'timer-ring--done': done, 'timer-ring--paused': paused }" data-test="timer-ring"
      role="timer" :aria-label="done ? 'Timer finished' : (paused ? 'Timer paused, ' : 'Time left ') + label">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="timer-ring-track" :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke-width="stroke" />
      <circle class="timer-ring-arc" :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke-width="stroke" stroke-linecap="round"
          :stroke="color" :stroke-dasharray="dash.c" :stroke-dashoffset="dash.offset" :transform="`rotate(-90 ${size / 2} ${size / 2})`" />
    </svg>
    <span class="timer-ring-text" :style="{ color }">{{ done ? "0:00" : label }}</span>
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ringFraction, ringRemainingMs, ringColor, ringDash, fmtRemaining, timerTimes } from '@/utils/timerRing';

const props = defineProps({ task: { type: Object, required: true }, size: { type: Number, default: 28 } });
const stroke = 3;
const r = computed(() => (props.size - stroke) / 2);
// Own clock (from the stored timestamps, so it survives re-render / app resume). rAF when motion is OK, else ~1 s steps.
const now = ref(Date.now());
let raf = 0, iv = 0, lastPaint = 0;
const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loop = (ts) => { if (ts - lastPaint > 100) { lastPaint = ts; now.value = Date.now(); } raf = window.requestAnimationFrame(loop); };
const onVis = () => { now.value = Date.now(); };
onMounted(() => {
  if (!reduce && window.requestAnimationFrame) raf = window.requestAnimationFrame(loop);
  else iv = window.setInterval(() => { now.value = Date.now(); }, 1000);
  document.addEventListener('visibilitychange', onVis);
});
onBeforeUnmount(() => { if (raf) window.cancelAnimationFrame(raf); if (iv) window.clearInterval(iv); document.removeEventListener('visibilitychange', onVis); });

const paused = computed(() => !!timerTimes(props.task).paused);
const frac = computed(() => ringFraction(props.task, now.value));
const done = computed(() => frac.value <= 0);
const color = computed(() => ringColor(frac.value));
const dash = computed(() => ringDash(frac.value, r.value));
const label = computed(() => fmtRemaining(ringRemainingMs(props.task, now.value)));
</script>

<style scoped>
.timer-ring { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; vertical-align: middle; }
.timer-ring-track { stroke: var(--c-border, rgba(127, 127, 127, 0.25)); }
.timer-ring-text { font-size: var(--fs-sm, 12px); font-weight: 700; font-variant-numeric: tabular-nums; }
.timer-ring--paused .timer-ring-arc, .timer-ring--paused .timer-ring-text { opacity: 0.6; }
.timer-ring--done .timer-ring-track { stroke: hsl(0 78% 48% / 0.35); }
@media (prefers-color-scheme: dark) { .timer-ring-track { stroke: var(--c-border, rgba(255, 255, 255, 0.16)); } }
@media (prefers-reduced-motion: reduce) { .timer-ring-arc { transition: none; } }
</style>
