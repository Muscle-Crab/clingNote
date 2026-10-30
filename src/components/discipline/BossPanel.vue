<template>
  <section class="boss" :class="'boss--' + tone" role="status" aria-live="polite" aria-label="Strict Coach">
    <header class="boss-head">
      <button type="button" class="boss-sgt-tap" data-test="boss-roll" aria-label="What's next? Tap the robot to roll your next task" title="Tap: what's next" @click="$emit('roll')"><RobotCoach class="boss-sgt" :size="40" :talking="tone === 'alert' || tone === 'fail' || tone === 'warn'" label="Your robot coach" /></button><span class="boss-icon" aria-hidden="true">{{ icon }}</span>
      <p class="boss-title">Your robot <span class="boss-chip">{{ chip }}</span></p>
      <button type="button" class="boss-btn" :aria-expanded="open ? 'true' : 'false'" :aria-label="open ? 'Collapse robot coach panel' : 'Expand robot coach panel'" @click="open = !open">{{ open ? '▾' : '▸' }}</button>
      <button type="button" class="boss-btn" aria-label="Hide robot coach panel for now" @click="$emit('dismiss')">✕</button>
    </header>
    <p v-if="!open && (verdict || lines.length)" class="boss-peek" @click="open = true">{{ verdict ? (verdict.v.passed ? 'PASSED' : 'FAILED') + ' · grade ' + verdict.v.grade : lines[0].text }}</p>
    <div v-show="open" class="boss-body">
      <div v-if="verdict" class="boss-verdict" :class="verdict.v.passed ? 'is-pass' : 'is-fail'">
        <div class="boss-grade" :aria-label="'Grade ' + verdict.v.grade">{{ verdict.v.grade }}</div>
        <div class="boss-verdict-main">
          <p class="boss-verdict-title">{{ verdict.v.passed ? 'PASSED' : 'FAILED' }} · {{ verdict.v.done }}/{{ verdict.v.min }} tasks</p>
          <p class="boss-line">{{ verdict.text }}</p>
        </div>
        <button type="button" class="boss-ack" @click="$emit('ack-verdict')">{{ verdict.v.passed ? 'Thanks!' : "I'll get it tomorrow" }}</button>
      </div>
      <p v-for="(l, i) in lines" :key="i" class="boss-line" :class="'boss-line--' + l.kind">
        <span v-if="lines.length > 1" aria-hidden="true">{{ ICONS[l.kind] || "🗣️" }}</span> {{ l.text }}
        <button v-if="l.dismissible" type="button" class="boss-mini" aria-label="Dismiss nudge" @click="$emit('dismiss-line', l.kind)">✕</button>
      </p>
    </div>
  </section>
</template>

<script setup>
// Inline, non-blocking Strict Boss panel: lives in the page flow above the task list (no fixed overlay).
import { ref, computed } from 'vue';
import RobotCoach from '@/components/robot/RobotCoach.vue';
const props = defineProps({
  lines: { type: Array, default: () => [] }, // [{ kind, text, dismissible }]
  verdict: { type: Object, default: null }, // { v, text, date }
});
defineEmits(['dismiss', 'dismiss-line', 'ack-verdict', 'roll']); // roll = tap the robot face: "what's next" (no long-press here: hold is the FAB menu)
const open = ref(!!props.verdict); // compact by default; a verdict opens expanded
const ICONS = { morning: '📋', midday: '📢', evening: '🚨', idle: '👀', watching: '👁️' };
const tone = computed(() => {
  if (props.verdict) return props.verdict.v.passed ? 'pass' : 'fail';
  const k = props.lines.map((l) => l.kind);
  return k.includes('evening') || k.includes('watching') ? 'alert' : k.includes('midday') ? 'warn' : 'info';
});
const icon = computed(() => ({ pass: '✅', fail: '❌', alert: '🚨', warn: '📢', info: '📋' }[tone.value]));
const chip = computed(() => ({ pass: 'Verdict', fail: 'Verdict', alert: 'Watching', warn: 'Midday check', info: 'Orders' }[tone.value]));
</script>

<style scoped>
.boss { margin: 0; border-radius: var(--r-lg, 16px); background: var(--c-surface, #12151C); border: 1px solid var(--c-border, #252B38); border-left: 3px solid var(--c-text-3, #8791A5); color: var(--c-text, #E6E9EF); overflow: hidden; }
.boss--warn { border-left-color: var(--c-warn, #F5B83D); }
.boss--alert, .boss--fail { border-left-color: var(--c-danger, #F87171); }
.boss--pass { border-left-color: var(--c-success, #3DDC97); }
.boss-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
.boss-icon { font-size: 16px; line-height: 1; }
.boss-sgt { flex: none; margin: -6px 0; }
/* the robot face itself is the tap target: no visible box, just the existing avatar */
.boss-sgt-tap { all: unset; flex: none; cursor: pointer; border-radius: 22%; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.boss-sgt-tap:focus-visible { outline: 2px solid var(--c-accent, #4F6FF0); outline-offset: 2px; }
.boss-sgt-tap:active { transform: scale(.94); }
.boss-title { margin: 0; flex: 1; font-weight: 700; font-size: var(--fs-md, 14px); display: flex; align-items: center; gap: 8px; }
.boss-chip { font-size: var(--fs-xs, 11px); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3, #8791A5); background: var(--c-surface-2, #1A1E28); padding: 2px 8px; border-radius: 999px; }
.boss-btn { width: 28px; height: 28px; border-radius: 8px; border: 0; background: transparent; color: var(--c-text-3, #8791A5); cursor: pointer; font-size: 13px; }
.boss-btn:hover { background: var(--c-surface-2, #1A1E28); color: var(--c-text, #E6E9EF); }
.boss-peek { margin: -4px 0 0; padding: 0 12px 10px 36px; font-size: 13px; color: var(--c-text-2, #B4BCCB); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.boss-body { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.boss-line { margin: 0; font-size: var(--fs-md, 14px); line-height: 20px; color: var(--c-text-2, #B4BCCB); display: flex; gap: 6px; align-items: flex-start; }
.boss-mini { margin-left: auto; border: 0; background: none; color: var(--c-text-3, #8791A5); cursor: pointer; }
.boss-verdict { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px; border-radius: var(--r, 10px); background: var(--c-surface-2, #1A1E28); }
.boss-grade { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-size: 22px; font-weight: 800; }
.is-pass .boss-grade { background: var(--c-success-soft, #10261D); color: var(--c-success, #3DDC97); }
.is-fail .boss-grade { background: var(--c-danger-soft, #2E1517); color: var(--c-danger, #F87171); }
.boss-verdict-main { flex: 1; min-width: 160px; }
.boss-verdict-title { margin: 0 0 2px; font-weight: 800; letter-spacing: .04em; }
.boss-ack { padding: 8px 14px; border-radius: var(--r, 10px); border: 1px solid var(--c-border-strong, #3A4253); background: transparent; color: var(--c-text, #E6E9EF); font-weight: 600; cursor: pointer; }
.boss-ack:hover { background: var(--c-surface, #12151C); }
</style>
