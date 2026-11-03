<template>
  <div class="pc-wrap" data-test="points-celebration" :data-kind="item.kind" role="status" aria-live="polite" @click="$emit('close')">
    <div class="pc-burst" aria-hidden="true"><span v-for="i in 18" :key="i" class="pc-dot" :style="dot(i)"></span></div>
    <div class="pc-card">
      <p class="pc-title">{{ item.title }}</p>
      <p v-if="item.points" class="pc-pts" data-test="points-celebration-gain">+{{ shown }} pts</p>
      <p v-if="item.sub" class="pc-sub">{{ item.sub }}</p>
      <p v-if="item.cheer" class="pc-cheer" data-test="points-celebration-cheer">{{ item.cheer }}</p>
    </div>
  </div>
</template>
<script setup>
// Full-screen celebration: a task completion (animated count-up of the points just earned + session N/8 cheer) or a vault app unlock.
import { ref, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['close']);
const shown = ref(0); let raf = 0; let t = 0;
const dot = (i) => ({ transform: `rotate(${i * 20}deg) translateY(-${90 + (i % 3) * 25}px)`, background: ['#facc15', '#60a5fa', '#34d399', '#f472b6'][i % 4] });
onMounted(() => { const to = Number(props.item.points) || 0; const t0 = window.performance.now(); const dur = 700;
  const step = (now) => { const k = Math.min(1, (now - t0) / dur); shown.value = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = window.requestAnimationFrame(step); };
  raf = window.requestAnimationFrame(step); t = setTimeout(() => emit('close'), props.item.ms || 1800); });
onBeforeUnmount(() => { window.cancelAnimationFrame(raf); clearTimeout(t); });
</script>
<style scoped>
.pc-wrap { position: fixed; inset: 0; z-index: 320; display: flex; align-items: center; justify-content: center; background: rgba(5, 10, 25, 0.72); animation: pcIn 0.18s ease-out; }
.pc-card { text-align: center; color: #fff; padding: 24px 28px; border-radius: 24px; background: linear-gradient(160deg, #1e3a8a, #0f172a); box-shadow: 0 0 60px rgba(96, 165, 250, 0.5); animation: pcPop 0.35s cubic-bezier(.2,1.6,.4,1); }
.pc-title { font-size: 26px; font-weight: 800; margin: 0 0 6px; }
.pc-pts { font-size: 48px; font-weight: 900; color: #facc15; margin: 0; }
.pc-sub { opacity: 0.85; margin: 6px 0 0; }
.pc-cheer { margin: 10px 0 0; font-weight: 700; color: #86efac; }
.pc-burst { position: absolute; left: 50%; top: 50%; }
.pc-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; animation: pcFly 0.9s ease-out forwards; }
@keyframes pcIn { from { opacity: 0; } }
@keyframes pcPop { from { transform: scale(0.6); opacity: 0; } }
@keyframes pcFly { from { opacity: 1; } to { opacity: 0; } }
</style>
