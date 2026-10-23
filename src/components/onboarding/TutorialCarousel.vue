<template>
  <div class="tc" data-test="tour">
    <div class="tc-track" ref="track" @scroll.passive="onScroll" role="list" aria-label="App tour">
      <figure v-for="(s, i) in slides" :key="s.id" class="tc-slide" role="listitem" :aria-label="`${i + 1} of ${slides.length}: ${s.title}`">
        <div class="tc-phone">
          <i class="tc-notch" aria-hidden="true"></i>
          <img :src="s.img" :alt="`${s.title}: screenshot of ClingNot`" width="600" height="1298" :loading="i < 2 ? 'eager' : 'lazy'" decoding="async" draggable="false" />
        </div>
        <figcaption class="tc-cap"><b>{{ s.title }}</b><span>{{ s.text }}</span></figcaption>
      </figure>
    </div>
    <div class="tc-dots" aria-hidden="true"><i v-for="(s, i) in slides" :key="s.id" :class="{ on: i === index }"></i></div>
    <p class="tc-count" data-test="tour-count">{{ index + 1 }} / {{ slides.length }}</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { TOUR_SLIDES } from '@/assets/tour/slides';

const props = defineProps({ slides: { type: Array, default: () => TOUR_SLIDES }, modelValue: { type: Number, default: 0 } });
const emit = defineEmits(['update:modelValue', 'last']);
const track = ref(null);
const index = ref(props.modelValue);
let autoUntil = 0; // while the buttons scroll the track programmatically, ignore the intermediate scroll positions

const onScroll = () => {
  const el = track.value; if (!el || !el.clientWidth) return;
  if (Date.now() < autoUntil) return;
  const i = Math.max(0, Math.min(props.slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
  if (i !== index.value) { index.value = i; emit('update:modelValue', i); }
  if (i === props.slides.length - 1) emit('last');
};
const goTo = (i, smooth = true) => {
  const el = track.value; if (!el) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  autoUntil = Date.now() + (smooth && !reduce ? 700 : 150);
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' });
};
watch(() => props.modelValue, (v) => { if (v !== index.value) { index.value = v; goTo(v); } });
watch(index, (i) => { if (i === props.slides.length - 1) emit('last'); });
onMounted(() => { if (index.value) goTo(index.value, false); });
defineExpose({ goTo });
</script>

<style scoped>
.tc { display: flex; flex-direction: column; align-items: center; width: 100%; }
.tc-track { display: flex; width: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; touch-action: pan-x; }
.tc-track::-webkit-scrollbar { display: none; }
.tc-slide { flex: 0 0 100%; scroll-snap-align: center; scroll-snap-stop: always; margin: 0; display: flex; flex-direction: column; align-items: center; }
.tc-phone { position: relative; width: min(58vw, 236px); aspect-ratio: 600 / 1298; border-radius: 34px; padding: 7px; background: linear-gradient(160deg, #3b4766, #141c33 55%, #2a3550); box-shadow: 0 22px 50px rgba(0, 0, 0, .55), 0 0 0 1px rgba(255, 255, 255, .08) inset, 0 0 40px rgba(47, 111, 255, .22); }
.tc-phone img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 28px; background: #070D1C; user-select: none; -webkit-user-drag: none; }
.tc-notch { position: absolute; top: 12px; left: 50%; width: 30%; height: 14px; transform: translateX(-50%); border-radius: 10px; background: #05080f; z-index: 1; }
.tc-cap { display: flex; flex-direction: column; gap: 4px; text-align: center; margin-top: 16px; padding: 0 12px; min-height: 66px; }
.tc-cap b { font-size: 20px; font-weight: 800; letter-spacing: -.01em; color: #fff; }
.tc-cap span { color: #A9B4CC; font-size: 14px; line-height: 1.45; }
.tc-dots { display: flex; gap: 6px; margin-top: 10px; }
.tc-dots i { width: 6px; height: 6px; border-radius: 6px; background: rgba(255, 255, 255, .18); transition: width .2s, background .2s; }
.tc-dots i.on { width: 18px; background: #3C8CFF; }
.tc-count { margin: 6px 0 0; font-size: 12px; color: #7180A0; }
@media (prefers-reduced-motion: reduce) { .tc-dots i { transition: none; } }
@media (max-height: 700px) { .tc-phone { width: min(46vw, 190px); } }
</style>
