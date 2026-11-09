<template>
  <section class="fm" data-test="focus-mode" role="dialog" aria-label="Focus Mode">
    <header class="fm-top">
      <button type="button" class="fm-icon" data-test="focus-back" aria-label="Back" @click="$emit('close')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <p class="fm-pill"><span class="fm-dot" aria-hidden="true"></span> Focus Mode</p>
      <button type="button" class="fm-icon" data-test="focus-more" aria-label="Focus menu" :aria-expanded="menu ? 'true' : 'false'" @click="menu = !menu"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg></button>
      <div v-if="menu" class="fm-menu" role="menu">
        <button type="button" role="menuitem" data-test="focus-menu-end" @click="menu = false; $emit('end')">End session</button>
        <button type="button" role="menuitemcheckbox" data-test="focus-menu-mode" :aria-checked="enabled ? 'true' : 'false'" @click="menu = false; $emit('set-mode', !enabled)">{{ enabled ? 'Turn Focus Mode off' : 'Turn Focus Mode on' }}</button>
      </div>
    </header>

    <p class="fm-date">{{ dateLabel }}</p>
    <h1 class="fm-title">Focus <span>Mode</span></h1>
    <p class="fm-lead">Deep work, less distraction.</p>

    <div class="fm-ring" data-test="focus-ring" role="timer" :aria-label="(paused ? 'Paused, ' : '') + countdown + ' remaining'">
      <svg viewBox="0 0 280 280" aria-hidden="true">
        <circle class="fm-track" cx="140" cy="140" r="124" />
        <circle class="fm-arc" cx="140" cy="140" r="124" :stroke-dasharray="dash.c" :stroke-dashoffset="dash.offset" />
      </svg>
      <div class="fm-face">
        <svg class="fm-leaf" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 40c0-14 8-22 18-24-2 16-10 24-18 24z"/><path d="M24 40C24 26 16 16 6 14c2 16 10 24 18 26z"/><path d="M24 40V18"/></svg>
        <p class="fm-time" data-test="focus-countdown">{{ countdown }}</p>
        <p class="fm-caption">FOCUS SESSION</p>
      </div>
    </div>

    <div class="fm-task">
      <span class="fm-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>
      <div>
        <h2 data-test="focus-task-title">{{ task.title || 'Focus' }}</h2>
        <p data-test="focus-subtitle">{{ subtitle }}</p>
      </div>
    </div>

    <button type="button" class="fm-music" data-test="focus-music" :aria-pressed="musicOn ? 'true' : 'false'" @click="toggleMusic">{{ musicOn ? '⏸ Pause focus music' : '▶ Play focus music' }}<small>{{ trackLabel }} · continues on the Home Screen</small></button>

    <div class="fm-controls">
      <button type="button" class="fm-side" data-test="focus-end" @click="$emit('end')"><span class="fm-side-ico" aria-hidden="true"></span>End</button>
      <button v-if="!paused" type="button" class="fm-pause" data-test="focus-pause" @click="$emit('pause')"><span aria-hidden="true">❚❚</span> Pause</button>
      <button v-else type="button" class="fm-pause" data-test="focus-resume" @click="$emit('resume')">Play</button>
      <button type="button" class="fm-side" data-test="focus-play" :disabled="!paused" @click="paused && $emit('resume')"><span class="fm-play" aria-hidden="true"></span>Play</button>
    </div>

    <article class="fm-card" data-test="focus-session">
      <span class="fm-card-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg></span>
      <div class="fm-card-copy">
        <h3>Session progress</h3>
        <p>{{ session.label }}</p>
        <span class="fm-bar"><span :style="{ width: session.percent + '%' }"></span></span>
      </div>
      <strong data-test="focus-percent">{{ session.percent }}%</strong>
    </article>

    <article v-if="steps" class="fm-card fm-steps" data-test="focus-steps">
      <span class="fm-card-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/></svg></span>
      <div class="fm-card-copy">
        <div class="fm-steps-head"><h3>Next steps</h3><span>{{ steps.left }} left</span></div>
        <ul>
          <li v-for="step in steps.items" :key="step.id || step.title">
            <button type="button" :data-test="'focus-step-' + (step.id || step.title)" :aria-pressed="step.done ? 'true' : 'false'" @click="$emit('toggle-step', step.id)">
              <span class="fm-check" :class="{ 'fm-check--on': step.done }" aria-hidden="true"></span>{{ step.title }}
            </button>
          </li>
        </ul>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ringDash } from '@/utils/timerRing';
import { focusCountdown, focusDateLabel, focusRingFraction, focusSessionCard, focusSteps, focusSubtitle } from '@/utils/focusScreen';
import { useBackground } from '@/composables/useBackground';
import { TRACKS } from '@/utils/bgPrefs';

const props = defineProps({
  task: { type: Object, required: true },
  coach: { type: Object, default: null },
  enabled: { type: Boolean, default: true },
});
defineEmits(['close', 'end', 'pause', 'resume', 'toggle-step', 'set-mode']);

const now = ref(Date.now());
const menu = ref(false);
let iv = 0;
onMounted(() => { iv = window.setInterval(() => { now.value = Date.now(); }, 250); });
onBeforeUnmount(() => window.clearInterval(iv));

const paused = computed(() => !!(props.task && props.task.timerPausedAt));
const countdown = computed(() => focusCountdown(props.task, now.value));
const dateLabel = computed(() => focusDateLabel(new Date(now.value)));
const subtitle = computed(() => focusSubtitle(props.task));
const session = computed(() => focusSessionCard(props.task, { now: now.value, coach: props.coach }));
const steps = computed(() => focusSteps(props.task));
const bg = useBackground();
const musicOn = computed(() => bg.playing.value);
const trackLabel = computed(() => { const t = TRACKS.find((x) => x.id === bg.prefs.track); return t ? t.label : 'Focus music'; });
const toggleMusic = () => bg.toggle();
const dash = computed(() => ringDash(focusRingFraction(props.task, now.value), 124));
</script>

<style scoped>
.fm { position: fixed; z-index: 86; left: 0; right: 0; top: 0; bottom: calc(64px + env(safe-area-inset-bottom)); overflow: auto;
  padding: calc(12px + env(safe-area-inset-top)) 16px 24px; color: #e8eefc;
  background: linear-gradient(180deg, rgba(6, 14, 32, .55), rgba(6, 12, 28, .78) 28%, rgba(5, 10, 24, .88));
  font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.fm-top { display: flex; align-items: center; justify-content: space-between; position: relative; }
.fm-icon { width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(160, 190, 255, .28); background: rgba(10, 20, 44, .55); color: #d5e2ff; display: inline-flex; align-items: center; justify-content: center; }
.fm-icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.fm-pill { margin: 0; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; border: 1px solid rgba(160, 190, 255, .28); background: rgba(8, 16, 36, .72); font: 700 13px/1 Inter, sans-serif; }
.fm-dot { width: 8px; height: 8px; border-radius: 50%; background: #3dde7a; box-shadow: 0 0 8px #3dde7a; }
.fm-menu { position: absolute; top: 48px; right: 0; z-index: 2; min-width: 160px; padding: 6px; border-radius: 14px; background: rgba(10, 18, 40, .96); border: 1px solid rgba(160, 190, 255, .28); }
.fm-menu button { width: 100%; text-align: left; background: none; border: 0; color: #e8eefc; font: 600 14px/1 Inter, sans-serif; padding: 10px 12px; border-radius: 10px; }
.fm-date { margin: 18px 0 0; color: #7eb6ff; font: 700 13px/1 Inter, sans-serif; letter-spacing: .06em; }
.fm-title { margin: 6px 0 0; font: 800 34px/1.05 Inter, sans-serif; letter-spacing: -.02em; }
.fm-title span { color: #3d8bff; }
.fm-lead { margin: 6px 0 0; color: #c5d0e6; font: 500 16px/1.3 Inter, sans-serif; }
.fm-ring { position: relative; width: min(280px, 78vw); height: min(280px, 78vw); margin: 22px auto 8px; }
.fm-ring svg { width: 100%; height: 100%; }
.fm-track { fill: none; stroke: rgba(80, 140, 255, .22); stroke-width: 14; }
.fm-arc { fill: none; stroke: #3d8bff; stroke-width: 14; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 140px 140px; filter: drop-shadow(0 0 8px rgba(61, 139, 255, .85)); }
.fm-face { position: absolute; inset: 18%; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 40%, rgba(20, 50, 110, .35), rgba(4, 10, 24, .72) 70%); box-shadow: inset 0 0 0 1px rgba(120, 170, 255, .18); }
.fm-leaf { width: 36px; height: 36px; stroke: #7ec8ff; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.fm-time { margin: 4px 0 0; font: 800 clamp(36px, 12vw, 52px)/1 Inter, sans-serif; letter-spacing: -.03em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fm-caption { margin: 6px 0 0; color: #9eb6de; font: 700 12px/1 Inter, sans-serif; letter-spacing: .16em; }
.fm-task { display: flex; align-items: center; gap: 14px; margin: 8px 0 16px; min-width: 0; }
.fm-task > div { min-width: 0; }
.fm-badge, .fm-side, .fm-card-ico { width: 52px; height: 52px; border-radius: 16px; border: 1px solid rgba(150, 180, 255, .28); background: rgba(12, 24, 52, .72); display: inline-flex; align-items: center; justify-content: center; color: #d5e4ff; flex-shrink: 0; }
.fm-badge svg, .fm-card-ico svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.fm-task h2 { margin: 0; font: 800 22px/1.15 Inter, sans-serif; overflow-wrap: anywhere; }
.fm-task p { margin: 4px 0 0; color: #a9b8d4; font: 500 14px/1.3 Inter, sans-serif; overflow-wrap: anywhere; }
.fm-music { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; max-width: 100%; margin: 0 0 14px; min-height: 52px; padding: 10px 14px; border-radius: 16px; border: 1px solid rgba(140, 190, 255, .45); background: rgba(20, 50, 110, .55); color: #fff; font: 800 16px/1.2 Inter, sans-serif; }
.fm-music small { font: 600 12px/1.3 Inter, sans-serif; color: #c5d7ff; }
.fm-controls { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 16px; margin-bottom: 18px; }
.fm-side { width: 64px; height: 64px; flex-direction: column; gap: 2px; font: 600 12px/1 Inter, sans-serif; color: #d5e4ff; background: rgba(12, 24, 52, .72); }
.fm-side-ico { width: 14px; height: 14px; border-radius: 3px; background: currentColor; }
.fm-play { width: 0; height: 0; border-style: solid; border-width: 7px 0 7px 12px; border-color: transparent transparent transparent currentColor; margin-left: 2px; }
.fm-pause { min-width: 0; flex: 1 1 140px; max-width: 220px; height: 64px; border: 0; border-radius: 999px; color: #fff; font: 800 20px/1 Inter, sans-serif; display: inline-flex; align-items: center; justify-content: center; gap: 10px; }
  background: linear-gradient(180deg, #3d8bff, #1f5dff); box-shadow: 0 0 0 1px rgba(140, 190, 255, .45), 0 10px 28px rgba(40, 100, 255, .45); }
.fm-pause:disabled, .fm-side:disabled { opacity: .45; }
.fm-card { display: flex; gap: 12px; align-items: flex-start; margin: 0 0 12px; padding: 14px; border-radius: 22px; border: 1px solid rgba(140, 175, 255, .28); background: rgba(8, 16, 38, .72); min-width: 0; }
.fm-card-copy { flex: 1; min-width: 0; }
.fm-card h3 { margin: 0; font: 800 16px/1.2 Inter, sans-serif; }
.fm-card p { margin: 3px 0 8px; color: #a9b8d4; font: 500 13px/1.2 Inter, sans-serif; }
.fm-card strong { color: #3d8bff; font: 800 18px/1 Inter, sans-serif; }
.fm-bar { display: block; height: 6px; border-radius: 999px; background: rgba(80, 120, 190, .35); overflow: hidden; }
.fm-bar span { display: block; height: 100%; background: #3d8bff; border-radius: inherit; }
.fm-steps-head { display: flex; justify-content: space-between; align-items: baseline; }
.fm-steps-head span { color: #9eb0d0; font: 600 13px/1 Inter, sans-serif; }
.fm-steps ul { list-style: none; margin: 10px 0 0; padding: 0; }
.fm-steps li + li { border-top: 1px solid rgba(140, 175, 255, .16); }
.fm-steps button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 0; background: none; border: 0; color: #e8eefc; font: 600 15px/1.3 Inter, sans-serif; text-align: left; overflow-wrap: anywhere; min-width: 0; }
.fm-check { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(170, 200, 255, .55); flex-shrink: 0; }
.fm-check--on { border-color: #3d8bff; background: #3d8bff; box-shadow: inset 0 0 0 3px rgba(8, 16, 38, .9); }
button { cursor: pointer; }
</style>
