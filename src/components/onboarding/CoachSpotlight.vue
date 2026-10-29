<template>
  <!-- Interactive coach: dims everything except the one element to press (pulsing ring), one sergeant line + one-line
       caption in big plain text, and an always-visible Skip. Advances only when the parent sends the real action signal. -->
  <div v-if="step" class="coach" role="dialog" aria-modal="false" aria-live="polite" :aria-label="'Tip: ' + step.line" data-test="coach">
    <template v-if="rect">
      <div class="coach-pane" :style="{ left: 0, top: 0, right: 0, height: rect.top + 'px' }"></div>
      <div class="coach-pane" :style="{ left: 0, top: rect.bottom + 'px', right: 0, bottom: 0 }"></div>
      <div class="coach-pane" :style="{ left: 0, top: rect.top + 'px', width: rect.left + 'px', height: rect.h + 'px' }"></div>
      <div class="coach-pane" :style="{ left: rect.right + 'px', top: rect.top + 'px', right: 0, height: rect.h + 'px' }"></div>
      <div class="coach-ring" :style="{ left: rect.left + 'px', top: rect.top + 'px', width: rect.w + 'px', height: rect.h + 'px' }" aria-hidden="true"></div>
    </template>
    <div v-else class="coach-pane" style="inset: 0"></div>
    <div class="coach-say" :class="{ 'coach-say--top': below }" :style="sayStyle">
      <RobotCoach class="coach-bot" :size="44" :talking="true" :badge="true" />
      <div class="coach-text"><p class="coach-line">{{ step.line }}</p><p class="coach-cap">{{ step.caption }}</p></div>
    </div>
    <div class="coach-actions">
      <button type="button" class="coach-skip" data-test="coach-skip" @click="$emit('skip')">Skip</button>
      <button type="button" class="coach-skip coach-skip--all" data-test="coach-skip-all" @click="$emit('skip-all')">Skip all tips</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import RobotCoach from '@/components/robot/RobotCoach.vue';
const props = defineProps({ step: { type: Object, default: null } });
defineEmits(['skip', 'skip-all']);
const rect = ref(null); const PAD = 8;
const measure = () => {
  const el = props.step && document.querySelector(props.step.target);
  if (!el) { rect.value = null; return; }
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) { rect.value = null; return; }
  rect.value = { left: r.left - PAD, top: r.top - PAD, right: r.right + PAD, bottom: r.bottom + PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
};
// target in the lower half -> caption sits above it; otherwise below
const below = computed(() => !!rect.value && rect.value.top < window.innerHeight / 2);
const sayStyle = computed(() => {
  if (!rect.value) return { top: '30%' };
  return below.value ? { top: rect.value.bottom + 16 + 'px' } : { bottom: window.innerHeight - rect.value.top + 16 + 'px' };
});
let raf = 0; const loop = () => { measure(); raf = requestAnimationFrame(() => setTimeout(loop, 250)); };
watch(() => props.step, () => measure(), { flush: 'post' });
onMounted(loop); onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<style scoped>
/* the four panes dim and block everything except the hole, so only the taught element can be pressed */
.coach { position: fixed; inset: 0; z-index: 99; pointer-events: none; }
.coach-pane { position: fixed; background: rgba(4, 8, 18, .72); pointer-events: auto; }
.coach-ring { position: fixed; border-radius: 18px; box-shadow: 0 0 0 3px #5b9bff; animation: coach-pulse 1.6s ease-in-out infinite; pointer-events: none; }
@keyframes coach-pulse { 0%, 100% { box-shadow: 0 0 0 3px #5b9bff, 0 0 0 0 rgba(91, 155, 255, .55); } 50% { box-shadow: 0 0 0 3px #5b9bff, 0 0 0 12px rgba(91, 155, 255, 0); } }
.coach-say { position: fixed; left: 16px; right: 16px; max-width: 520px; margin: 0 auto; display: flex; gap: 12px; align-items: flex-start; pointer-events: none; }
.coach-text { flex: 1; }
.coach-line { margin: 0; font-size: 24px; line-height: 1.25; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.coach-cap { margin: 6px 0 0; font-size: 18px; line-height: 1.35; color: #dfe6f3; }
.coach-actions { position: fixed; top: calc(12px + env(safe-area-inset-top)); right: 12px; display: flex; gap: 8px; pointer-events: auto; z-index: 102; }
.coach-skip { min-height: 48px; padding: 0 20px; border-radius: 999px; border: 2px solid #fff; background: rgba(4, 8, 18, .6); color: #fff; font-size: 18px; font-weight: 800; cursor: pointer; }
.coach-skip--all { border-color: rgba(255,255,255,.5); font-weight: 600; font-size: 16px; }
@media (prefers-reduced-motion: reduce) { .coach-ring { animation: none; } }
</style>
