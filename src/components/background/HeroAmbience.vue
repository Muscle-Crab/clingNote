<template>
  <div class="hero-amb" aria-hidden="true">
    <canvas ref="cv" class="hero-amb-cv" :data-img="img" :data-anim="anim" :data-frames="frames"></canvas>
    <div v-if="shade" class="hero-amb-shade" :style="{ backgroundImage: shade }"></div>
  </div>
</template>

<script setup>
// Calm "alive" layer for the Home header picture, sized exactly to .hero-scene (absolute inset 0, clipped, cover-fit math identical to the CSS).
// Built-in forest art: the picture is redrawn and its tree region mesh-warped so the pines sway from their base in a slow wind
// (stronger, still gentle, with rain). Plus slow cloud wisps, soft star twinkle, moon glow, rain mist / snow haze.
// ~30 fps, paused while hidden, one still frame with prefers-reduced-motion (unless "Play anyway"). pointer-events none, no layout.
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { makeAmbience, stepAmbience, drawAmbience, sceneFor, treeMaskFor } from '@/utils/heroAmbience';
import forestSrc from '@/assets/hero-forest.jpg';

const props = defineProps({ img: { type: String, default: 'forest' }, anim: { type: String, default: 'none' }, forceMotion: { type: Boolean, default: false } });
const cv = ref(null); const frames = ref(0); const shade = ref('');
const reduced = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let ctx = null; let amb = null; let raf = 0; let last = 0; let acc = 0; let image = null; let ro = null; let mask = null;

// The picture's own CSS gradient (theme-aware) must stay on top of the redrawn picture: copy the first gradient layer of the parent's background.
const firstGradient = (bg) => { const i = bg.indexOf('gradient('); if (i < 0) return ''; let s = bg.lastIndexOf(' ', i) + 1; let d = 0; for (let j = i; j < bg.length; j++) { if (bg[j] === '(') d++; else if (bg[j] === ')' && --d === 0) return bg.slice(s, j + 1); } return ''; };
const usesImage = () => props.img === 'forest' && !!sceneFor('forest').trees;
const size = () => {
  const c = cv.value; const host = c && c.parentElement && c.parentElement.parentElement; if (!c || !host) return false;
  const w = host.clientWidth; const h = host.clientHeight; if (!w || !h) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const iw = image ? image.naturalWidth : 1024; const ih = image ? image.naturalHeight : 576;
  const t = amb ? amb.t : 0; amb = makeAmbience(props.img, props.anim, w, h, iw, ih); amb.t = t; if (usesImage() && image && image.complete) { if (!mask) mask = treeMaskFor('forest', image); amb.mask = mask; }
  shade.value = usesImage() ? firstGradient(getComputedStyle(host).backgroundImage || '') : '';
  return true;
};
const draw = () => { if (ctx && amb) { drawAmbience(ctx, amb, usesImage() && image && image.complete ? image : null); frames.value++; } };
const frame = (ts) => {
  raf = 0; if (document.hidden || !amb) return;
  const dt = last ? (ts - last) / 1000 : 0.033; last = ts; acc += dt;
  if (acc >= 1 / 31) { stepAmbience(amb, acc); acc = 0; draw(); } // ~30 fps is plenty for slow motion and halves the cost
  raf = requestAnimationFrame(frame);
};
const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; acc = 0; };
const start = () => { stop(); if (!amb) return; if (reduced && reduced.matches && !props.forceMotion) { draw(); return; } raf = requestAnimationFrame(frame); };
const setup = async () => {
  stop(); await nextTick();
  if (usesImage() && !image) { image = new window.Image(); image.decoding = 'async'; image.onload = () => { size(); start(); }; image.src = forestSrc; }
  if (size()) start();
};
const onVis = () => { if (document.hidden) stop(); else start(); };
onMounted(() => {
  setup(); document.addEventListener('visibilitychange', onVis);
  if (window.ResizeObserver && cv.value) { ro = new ResizeObserver(() => { if (size()) { if (!raf) start(); } }); ro.observe(cv.value.parentElement.parentElement); } else window.addEventListener('resize', setup);
});
onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', setup); if (ro) ro.disconnect(); });
watch(() => [props.img, props.anim], setup);
watch(() => props.forceMotion, start);
</script>

<style scoped>
.hero-amb, .hero-amb-cv, .hero-amb-shade { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; border-radius: inherit; }
.hero-amb { overflow: hidden; contain: strict; }
.hero-amb-cv { display: block; }
</style>
