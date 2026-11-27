<template>
  <span class="timer-ring" :class="{ 'timer-ring--done': done, 'timer-ring--paused': paused }" data-test="timer-ring"
      role="timer" :aria-label="(paused ? 'Timer paused, ' : 'Elapsed ') + label + (over ? ', over by ' + over : '')">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="timer-ring-track" :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke-width="stroke" />
      <circle class="timer-ring-arc" :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke-width="stroke" stroke-linecap="round"
          :stroke="color" :stroke-dasharray="dash.c" :stroke-dashoffset="dash.offset" :transform="`rotate(-90 ${size / 2} ${size / 2})`" />
    </svg>
    <span class="timer-ring-text" :style="{ color }">{{ label }}<span v-if="over" class="timer-ring-over" data-test="timer-ring-over"> +{{ over }}</span></span>
    <span v-if="over && !paused" class="timer-ring-warn" data-test="timer-ring-warn">{{ OVER_WARN }}</span>
  </span>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { OVER_WARN } from '@/utils/localNotify';
import { ringFraction, ringColor, ringDash, timerTimes, elapsedMs, overtimeMs, durationMs, fmtElapsed } from '@/utils/timerRing';
import { bindWallClock } from '@/utils/timerClock';

const props = defineProps({ task: { type: Object, required: true }, size: { type: Number, default: 28 } });
const stroke = 3;
const r = computed(() => (props.size - stroke) / 2);
// Own clock (from the stored timestamps, so it survives re-render / app resume). rAF when motion is OK, else ~1 s steps.
const now = ref(Date.now());
let raf = 0, iv = 0, lastPaint = 0, unbindClock = () => {};
const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loop = (ts) => { if (ts - lastPaint > 100) { lastPaint = ts; now.value = Date.now(); } raf = window.requestAnimationFrame(loop); };
const tick = () => { now.value = Date.now(); };
onMounted(() => {
  if (!reduce && window.requestAnimationFrame) raf = window.requestAnimationFrame(loop);
  else iv = window.setInterval(tick, 1000);
  unbindClock = bindWallClock(tick);
});
onBeforeUnmount(() => { if (raf) window.cancelAnimationFrame(raf); if (iv) window.clearInterval(iv); unbindClock(); });

const paused = computed(() => !!timerTimes(props.task).paused);
const frac = computed(() => ringFraction(props.task, now.value));
const done = computed(() => frac.value <= 0);
const color = computed(() => ringColor(frac.value));
const dash = computed(() => ringDash(frac.value, r.value));
// Counts UP from 00:00 to the set duration, then holds it and shows the overtime subtly (+MM:SS); it never stops on its own.
const label = computed(() => { const d = durationMs(props.task), e = elapsedMs(props.task, now.value); return fmtElapsed(d ? Math.min(e, d) : e); });
const over = computed(() => { const o = overtimeMs(props.task, now.value); return o >= 1000 ? fmtElapsed(o) : ''; });
</script>

<style scoped>
.timer-ring { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; flex-shrink: 1; min-width: 0; max-width: 100%; vertical-align: middle; }
.timer-ring-track { stroke: var(--c-border, rgba(127, 127, 127, 0.25)); }
.timer-ring-text { font-size: var(--fs-sm, 12px); font-weight: 700; font-variant-numeric: tabular-nums; }
.timer-ring-over { font-weight: 600; opacity: 0.65; }
.timer-ring-warn { flex-basis: 100%; font-size: var(--fs-xs, 11px); font-weight: 800; color: #f97316; line-height: 1.3; overflow-wrap: anywhere; } /* own line under the ring: never runs under the play button */
.timer-ring--paused .timer-ring-arc, .timer-ring--paused .timer-ring-text { opacity: 0.6; }
.timer-ring--done .timer-ring-track { stroke: hsl(0 78% 48% / 0.35); }
@media (prefers-color-scheme: dark) { .timer-ring-track { stroke: var(--c-border, rgba(255, 255, 255, 0.16)); } }
@media (prefers-reduced-motion: reduce) { .timer-ring-arc { transition: none; } }
</style>
