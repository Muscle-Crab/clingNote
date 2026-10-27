<template>
  <span class="robot" :class="{ 'robot--live': live }" aria-hidden="true">
    <span class="robot-bob">
      <picture>
        <source type="image/webp" :srcset="`${w1} 1x, ${w2} 2x, ${w3} 3x`" />
        <img class="robot-img" :src="p1" :srcset="`${p1} 1x, ${p2} 2x, ${p3} 3x`" alt="" draggable="false" />
      </picture>
      <span class="robot-blink"></span>
    </span>
  </span>
</template>

<script setup>
// Assistant robot avatar (CSS-only idle bob, blue glow pulse, periodic blink; off under prefers-reduced-motion).
import w1 from '@/assets/assistant-robot@1x.webp'; import w2 from '@/assets/assistant-robot@2x.webp'; import w3 from '@/assets/assistant-robot@3x.webp';
import p1 from '@/assets/assistant-robot@1x.png'; import p2 from '@/assets/assistant-robot@2x.png'; import p3 from '@/assets/assistant-robot@3x.png';
defineProps({ live: Boolean });
</script>

<style scoped>
.robot { display: inline-block; width: 100%; height: 100%; pointer-events: none; }
.robot-bob { position: relative; display: block; width: 100%; height: 100%; animation: robot-bob 3s ease-in-out infinite; }
.robot-img { display: block; width: 100%; height: 100%; object-fit: contain; animation: robot-glow 3s ease-in-out infinite; }
/* thin face-screen-coloured lid over the eye band; squashes closed briefly every ~4.5s */
.robot-blink { position: absolute; left: 27%; right: 27%; top: 41%; height: 13%; background: #0a1226; border-radius: 40%; transform: scaleY(0); transform-origin: 50% 50%; animation: robot-blink 4.5s infinite; }
.robot--live .robot-img { animation-duration: 1.2s; }
@keyframes robot-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes robot-glow { 0%, 100% { filter: drop-shadow(0 0 1px rgba(80, 170, 255, .35)); } 50% { filter: drop-shadow(0 0 4px rgba(80, 170, 255, .8)); } }
@keyframes robot-blink { 0%, 92%, 100% { transform: scaleY(0); } 95% { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .robot-bob, .robot-img, .robot-blink { animation: none; } }
</style>
