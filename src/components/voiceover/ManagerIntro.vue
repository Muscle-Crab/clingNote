<template>
  <div v-if="open" class="mi-wrap" data-test="manager-intro" @pointerdown.capture="onFirstTap">
    <section class="mi">
      <div class="mi-top"><div class="mi-dots"><i v-for="(s, k) in SLIDES" :key="s.id" :class="{ on: k <= i }"></i></div><VoToggle @unmuted="narrate" /></div>
      <div class="mi-ic">{{ SLIDES[i].icon }}</div>
      <p class="mi-k">Manager mode · {{ i + 1 }}/{{ SLIDES.length }}</p>
      <h2 class="mi-h">{{ SLIDES[i].title }}</h2>
      <p class="mi-p">{{ SLIDES[i].text }}</p>
      <p v-if="!voUnlocked && !muted" class="mi-hint">Tap anywhere to hear your robot 🔊</p>
      <div class="mi-foot">
        <button class="mi-skip" @click="done">Skip</button>
        <button class="mi-cta" data-test="mi-next" @click="next">{{ i === SLIDES.length - 1 ? 'Got it' : 'Next' }}</button>
      </div>
    </section>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { MANAGER_INTRO as SLIDES } from '@/voiceover/scripts';
import VoToggle from './VoToggle.vue';
import { playVoice, stopVoice, unlockVoice, voUnlocked, voMuted as muted } from '@/composables/useVoiceover';
const KEY = 'clingnote.managerIntroSeen.v1';
const open = ref(false); const i = ref(0);
onMounted(() => { try { open.value = localStorage.getItem(KEY) !== '1' || /[?&]intro=1/.test(location.href); } catch (e) { open.value = true; } if (open.value && voUnlocked.value) narrate(); });
const narrate = () => playVoice(SLIDES[i.value].id);
const onFirstTap = () => { if (voUnlocked.value) return; unlockVoice(); setTimeout(narrate, 60); };
watch(i, narrate);
const next = () => { if (i.value < SLIDES.length - 1) i.value++; else done(); };
const done = () => { stopVoice(); open.value = false; try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ } };
onBeforeUnmount(stopVoice);
</script>
<style scoped>
.mi-wrap { position: fixed; inset: 0; z-index: 8500; background: rgba(3,6,14,.72); display: flex; align-items: center; justify-content: center; padding: 16px; }
.mi { width: 100%; max-width: 440px; background: #070D1C; border: 1px solid #2A3C66; border-radius: 24px; padding: 18px 18px 16px; color: #F2F5FC; }
.mi-top { display: flex; align-items: center; gap: 10px; } .mi-dots { flex: 1; display: flex; gap: 5px; } .mi-dots i { flex: 1; height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); } .mi-dots i.on { background: linear-gradient(90deg,#1E5BFF,#3C8CFF); }
.mi-ic { font-size: 56px; text-align: center; margin: 18px 0 6px; } .mi-k { margin: 0; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #5E9BFF; font-weight: 600; }
.mi-h { margin: 4px 0 8px; font-size: 26px; font-weight: 800; } .mi-p { color: #A9B4CC; line-height: 1.5; margin: 0; } .mi-hint { color: #5E9BFF; font-size: 13px; margin: 10px 0 0; }
.mi-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; } .mi-skip { background: none; border: 0; color: #7180A0; font-weight: 600; cursor: pointer; }
.mi-cta { min-height: 48px; padding: 0 26px; border: 0; border-radius: 14px; font-weight: 800; color: #fff; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); cursor: pointer; }
</style>
