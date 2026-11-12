<template>
  <!-- Mechanical vault face for the opened room. Spokes and rings are geometry, not a new logo. -->
  <span class="vd" :class="{ 'vd--open': unlocked, 'vd--live': live }" data-test="vault-medallion" aria-hidden="true">
    <svg class="vd-svg" viewBox="0 0 80 80" width="64" height="64">
      <defs>
        <radialGradient id="vd-face" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stop-color="#3a4d73" />
          <stop offset="55%" stop-color="#1a2744" />
          <stop offset="100%" stop-color="#0c1428" />
        </radialGradient>
        <linearGradient id="vd-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f3e6c0" />
          <stop offset="45%" stop-color="#d6b25e" />
          <stop offset="100%" stop-color="#8a6a32" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="37" fill="none" stroke="url(#vd-gold)" stroke-width="2.2" />
      <circle cx="40" cy="40" r="31" fill="url(#vd-face)" stroke="rgba(214,178,94,.55)" stroke-width="1" />
      <g class="vd-rotor">
        <rect v-for="n in 8" :key="n" x="38.2" y="12" width="3.6" height="16" rx="1.2" fill="url(#vd-gold)" :transform="`rotate(${n * 45} 40 40)`" />
      </g>
      <circle cx="40" cy="40" r="14" fill="#10192e" stroke="url(#vd-gold)" stroke-width="1.4" />
      <circle cx="40" cy="40" r="11.5" fill="none" stroke="rgba(214,178,94,.35)" stroke-width="0.6" />
    </svg>
    <img class="vd-robot" src="/app-icon-robot.png" alt="" width="22" height="22" />
  </span>
</template>

<script setup>
defineProps({ unlocked: { type: Boolean, default: false }, live: { type: Boolean, default: false } });
</script>

<style scoped>
.vd { position: relative; width: 44px; height: 44px; flex: none; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .45)); }
.vd-svg { display: block; width: 44px; height: 44px; }
.vd-rotor { transform-origin: 40px 40px; }
.vd--open .vd-rotor { animation: vd-turn 14s linear infinite; }
.vd--live { filter: drop-shadow(0 0 8px rgba(214, 178, 94, .45)); }
.vd-robot { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 4px; object-fit: cover; }
@keyframes vd-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .vd-rotor { animation: none; }
}
</style>
