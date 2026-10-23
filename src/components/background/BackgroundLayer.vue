<template>
  <canvas v-if="anim !== 'none'" ref="cv" class="bg-layer" :data-anim="anim" :data-frames="frames" aria-hidden="true"></canvas>
</template>

<script setup>
// Decorative animated background (snow / rain / fireplace). Drawn as a click-through overlay (fixed, pointer-events none, below modals/menus,
// no layout impact) so it is actually visible over the page's opaque cards. Pauses while the tab is hidden; with prefers-reduced-motion it draws one still frame and never animates.
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { makeScene, stepScene, drawScene } from '@/utils/bgScenes';

const props = defineProps({ anim: { type: String, default: 'none' }, forceMotion: { type: Boolean, default: false } });
const cv = ref(null); const frames = ref(0);
const reduced = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let ctx = null; let scene = null; let raf = 0; let last = 0; let dpr = 1;

const size = () => {
  const c = cv.value; if (!c) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth; const h = window.innerHeight;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene = makeScene(props.anim, w, h);
};
const frame = (ts) => {
  raf = 0;
  if (document.hidden || !scene) return;
  const dt = last ? (ts - last) / 1000 : 0.016; last = ts;
  stepScene(scene, dt); drawScene(ctx, scene); frames.value++;
  raf = requestAnimationFrame(frame);
};
const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; };
const start = () => {
  stop(); if (!scene) return;
  if (reduced && reduced.matches && !props.forceMotion) { stepScene(scene, 0.5); drawScene(ctx, scene); frames.value = 1; return; } // still frame only
  raf = requestAnimationFrame(frame);
};
const onVis = () => { if (document.hidden) stop(); else start(); };
const setup = async () => { stop(); await nextTick(); if (!cv.value) { scene = null; return; } size(); start(); };

onMounted(() => { setup(); document.addEventListener('visibilitychange', onVis); window.addEventListener('resize', setup); });
onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', setup); });
watch(() => props.anim, setup);
watch(() => props.forceMotion, () => { start(); });
</script>

<style scoped>
.bg-layer { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 60; pointer-events: none; contain: strict; }
</style>
