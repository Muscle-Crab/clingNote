<template>
  <teleport to="body">
    <div v-if="open" class="bgp-backdrop" data-test="bg-backdrop" @click.self="$emit('close')">
      <section class="bgp" role="dialog" aria-modal="true" aria-label="Background" data-test="bg-panel" :data-playing="bg.playing.value ? '1' : '0'" :data-anim="bg.prefs.anim" :data-level="level.toFixed(3)">
        <header class="bgp-head"><h2>🎧 Background</h2><button type="button" class="bgp-x" aria-label="Close" data-test="bg-close" @click="$emit('close')">✕</button></header>

        <h3 class="bgp-h">Animation</h3>
        <div class="bgp-anims" role="radiogroup" aria-label="Background animation">
          <button v-for="a in ANIMS" :key="a.id" type="button" role="radio" class="bgp-chip" :class="{ on: bg.prefs.anim === a.id }" :aria-checked="bg.prefs.anim === a.id" :data-test="'bg-anim-' + a.id" @click="bg.setAnim(a.id)"><span aria-hidden="true">{{ a.icon }}</span>{{ a.label }}</button>
        </div>
        <p v-if="reduced && bg.prefs.anim !== 'none'" class="bgp-note">Your device asks for reduced motion, so the animation is shown as a still picture.</p>

        <h3 class="bgp-h">Music <small>(plays only when you tap Play)</small></h3>
        <div class="bgp-tracks" role="radiogroup" aria-label="Music">
          <button v-for="t in TRACKS" :key="t.id" type="button" role="radio" class="bgp-track" :class="{ on: bg.prefs.track === t.id }" :aria-checked="bg.prefs.track === t.id" :data-test="'bg-track-' + t.id" @click="bg.setTrack(t.id)"><b>{{ t.label }}</b><small>{{ t.hint }}</small></button>
        </div>
        <div class="bgp-play">
          <button type="button" class="bgp-playbtn" data-test="bg-play" :disabled="!bg.audioSupported" @click="bg.toggle()">{{ bg.playing.value ? '⏸ Pause music' : '▶ Play music' }}</button>
          <label class="bgp-vol">🔈<input type="range" min="0" max="1" step="0.05" :value="bg.prefs.volume" aria-label="Volume" data-test="bg-volume" @input="bg.setVolume($event.target.value)" /></label>
        </div>
        <p v-if="bg.audioError.value" class="bgp-note bgp-err" role="alert">{{ bg.audioError.value }}</p>
        <p class="bgp-note">Music and animation are separate: use either, both, or neither. Saved on this device.</p>
        <button type="button" class="bgp-reset" data-test="bg-reset" @click="bg.reset()">Reset to default look</button>
      </section>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useBackground } from '@/composables/useBackground';
import { ANIMS, TRACKS } from '@/utils/bgPrefs';

const props = defineProps({ open: { type: Boolean, default: false } });
defineEmits(['close']);
const bg = useBackground();
const level = ref(0);
const reduced = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
let iv = 0;
watch(() => props.open, (o) => { clearInterval(iv); if (o) iv = setInterval(() => { level.value = bg.level(); }, 400); });
onBeforeUnmount(() => clearInterval(iv));
</script>

<style>
.bgp-backdrop { position: fixed; inset: 0; z-index: 400; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; justify-content: center; }
.bgp { width: 100%; max-width: 520px; max-height: 85vh; max-height: 85dvh; overflow-y: auto; overscroll-behavior: contain; background: #12141c; color: #e8eaf2; border-radius: 18px 18px 0 0; padding: 14px 16px calc(18px + env(safe-area-inset-bottom)); box-shadow: 0 -10px 40px rgba(0,0,0,.5); font-family: inherit; }
.bgp-head { display: flex; align-items: center; justify-content: space-between; }
.bgp-head h2 { margin: 0; font-size: 1.1rem; }
.bgp-x { min-width: 44px; min-height: 44px; border: 0; background: transparent; color: inherit; font-size: 1.1rem; cursor: pointer; }
.bgp-h { margin: 10px 0 6px; font-size: .85rem; text-transform: uppercase; letter-spacing: .06em; color: #9aa3b8; }
.bgp-h small { text-transform: none; letter-spacing: 0; font-weight: 400; }
.bgp-anims { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.bgp-chip { min-height: 64px; border-radius: 12px; border: 1.5px solid #2a2f3f; background: #1a1d29; color: inherit; font-size: .8rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; }
.bgp-chip span { font-size: 1.4rem; }
.bgp-chip.on, .bgp-track.on { border-color: #6b8cff; background: #232a47; }
.bgp-tracks { display: grid; gap: 8px; }
.bgp-track { text-align: left; min-height: 48px; padding: 8px 12px; border-radius: 12px; border: 1.5px solid #2a2f3f; background: #1a1d29; color: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.bgp-track small { color: #9aa3b8; }
.bgp-play { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.bgp-playbtn { flex: 1; min-height: 48px; border: 0; border-radius: 12px; background: #4f6ff0; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
.bgp-playbtn:disabled { opacity: .5; }
.bgp-vol { flex: 1; display: flex; align-items: center; gap: 6px; }
.bgp-vol input { flex: 1; min-height: 44px; }
.bgp-note { margin: 8px 0 0; font-size: .78rem; color: #9aa3b8; }
.bgp-err { color: #ff8c8c; }
.bgp-reset { margin-top: 12px; width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid #2a2f3f; background: transparent; color: inherit; cursor: pointer; }
</style>
