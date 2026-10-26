<template>
  <svg class="sgt" :class="{ 'sgt--still': !animate, 'sgt--yell': yelling }" :width="size" :height="size" viewBox="0 0 120 120"
       role="img" :aria-label="label" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient :id="uid + 'bg'" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#1A2D5C" /><stop offset="1" stop-color="#0C1630" /></radialGradient>
      <linearGradient :id="uid + 'kh'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9B27C" /><stop offset="1" stop-color="#9C8650" /></linearGradient>
      <linearGradient :id="uid + 'hat'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A6A3E" /><stop offset="1" stop-color="#5E4526" /></linearGradient>
      <clipPath :id="uid + 'c'"><circle cx="60" cy="60" r="58" /></clipPath>
    </defs>
    <circle v-if="badge" cx="60" cy="60" r="58" :fill="`url(#${uid}bg)`" stroke="#5B9BFF" stroke-opacity=".55" stroke-width="2" />
    <g :clip-path="badge ? `url(#${uid}c)` : null">
      <g class="sgt-body">
        <!-- torso: khaki shirt, collar, chevrons -->
        <path d="M18 122 C20 96 34 86 60 84 C86 86 100 96 102 122 Z" :fill="`url(#${uid}kh)`" />
        <path d="M48 85 L60 100 L72 85 L66 83 L60 92 L54 83 Z" fill="#B49D66" />
        <path d="M60 92 L60 122" stroke="#8C7745" stroke-width="1.4" />
        <circle cx="60" cy="104" r="1.6" fill="#6E5C33" /><circle cx="60" cy="114" r="1.6" fill="#6E5C33" />
        <g fill="none" stroke="#5B9BFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M24 103 l6 -5 l6 5" /><path d="M24 109 l6 -5 l6 5" /><path d="M24 115 l6 -5 l6 5" />
        </g>
        <!-- neck + head -->
        <rect x="52" y="72" width="16" height="14" rx="5" fill="#C98E66" />
        <g class="sgt-head">
          <ellipse cx="60" cy="58" rx="19" ry="21" fill="#D9A07A" />
          <ellipse cx="41.5" cy="60" rx="3.2" ry="5" fill="#C98E66" /><ellipse cx="78.5" cy="60" rx="3.2" ry="5" fill="#C98E66" />
          <!-- furious brows + eyes -->
          <path d="M46 50 L57 54" stroke="#3A2A1C" stroke-width="3.4" stroke-linecap="round" />
          <path d="M74 50 L63 54" stroke="#3A2A1C" stroke-width="3.4" stroke-linecap="round" />
          <ellipse cx="52" cy="58" rx="2.6" ry="2" fill="#1B1410" /><ellipse cx="68" cy="58" rx="2.6" ry="2" fill="#1B1410" />
          <path d="M60 58 q-3 7 0 9" stroke="#B57B55" stroke-width="1.6" fill="none" stroke-linecap="round" />
          <path d="M50 66 q10 -4 20 0" stroke="#6B4A33" stroke-width="2.2" fill="none" stroke-linecap="round" />
          <!-- yelling mouth -->
          <g class="sgt-mouth"><ellipse cx="60" cy="72" rx="7" ry="5.5" fill="#4A1616" /><path d="M54 69.5 h12" stroke="#F4EDE4" stroke-width="2" stroke-linecap="round" />
            <ellipse cx="60" cy="74.6" rx="3.6" ry="1.8" fill="#C4555A" /></g>
          <!-- campaign hat: wide flat brim + pinched "Montana peak" crown -->
          <g class="sgt-hat">
            <ellipse cx="60" cy="42" rx="37" ry="7.5" :fill="`url(#${uid}hat)`" />
            <ellipse cx="60" cy="41" rx="37" ry="6.5" fill="none" stroke="#3E2D18" stroke-width="1.2" />
            <path d="M43 41 C43 30 48 21 53 17 L60 24 L67 17 C72 21 77 30 77 41 Z" :fill="`url(#${uid}hat)`" />
            <path d="M53 17 L60 24 L67 17" fill="none" stroke="#3E2D18" stroke-width="1.4" stroke-linejoin="round" />
            <path d="M60 24 L60 38" stroke="#4A3620" stroke-width="1.2" />
            <rect x="43.5" y="36" width="33" height="4.5" rx="1.5" fill="#2E2214" />
            <circle cx="60" cy="38.2" r="2.2" fill="#5B9BFF" />
          </g>
        </g>
      </g>
      <!-- pointing arm, foreshortened toward the viewer -->
      <g class="sgt-arm">
        <path d="M104 122 C104 110 100 104 95 100 L84 104 C88 108 90 114 90 122 Z" :fill="`url(#${uid}kh)`" />
        <g class="sgt-hand">
          <!-- fist with index finger aimed straight at the viewer -->
          <rect x="80" y="86" width="20" height="17" rx="7" fill="#D9A07A" />
          <path d="M82 92 h16 M82 97 h16" stroke="#B57B55" stroke-width="1.1" />
          <circle cx="86" cy="87" r="7" fill="#E6B08B" /><circle cx="86" cy="87" r="4" fill="#F0C4A3" /><ellipse cx="86" cy="86" rx="2.2" ry="1.6" fill="#F7DCC6" />
        </g>
      </g>
    </g>
  </svg>
</template>

<script setup>
// Original drill-sergeant mascot (hand-built SVG). Pure CSS animation, disabled under prefers-reduced-motion.
let n = 0;
defineProps({ size: { type: [Number, String], default: 96 }, animate: { type: Boolean, default: true }, yelling: { type: Boolean, default: true },
  badge: { type: Boolean, default: true }, label: { type: String, default: 'Drill sergeant pointing at you and yelling' } });
const uid = `sgt${++n}${Math.random().toString(36).slice(2, 6)}`;
</script>

<style scoped>
.sgt { display: block; overflow: visible; }
.sgt-body { transform-origin: 60px 120px; animation: sgt-bounce 1.6s ease-in-out infinite; }
.sgt-hat { transform-origin: 60px 42px; animation: sgt-hat 1.6s ease-in-out infinite; }
.sgt-arm { transform-origin: 98px 120px; animation: sgt-jab .8s cubic-bezier(.3,1.6,.5,1) infinite; }
.sgt-hand { transform-origin: 88px 92px; animation: sgt-finger .8s cubic-bezier(.3,1.6,.5,1) infinite; }
.sgt-mouth { transform-origin: 60px 70px; animation: sgt-yell .4s steps(2, jump-none) infinite; }
.sgt:not(.sgt--yell) .sgt-mouth { animation: none; transform: scaleY(.35); }
@keyframes sgt-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1.6px) scaleY(.99); } }
@keyframes sgt-hat { 0%,100% { transform: rotate(0); } 30% { transform: translateY(-1.4px) rotate(-2deg); } 60% { transform: rotate(1deg); } }
@keyframes sgt-jab { 0%,100% { transform: scale(1); } 40% { transform: scale(1.14) translate(-2px,-2px); } }
@keyframes sgt-finger { 0%,100% { transform: scale(1); } 40% { transform: scale(1.22); } }
@keyframes sgt-yell { 0% { transform: scaleY(1); } 100% { transform: scaleY(.45); } }
.sgt--still *, .sgt--still { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .sgt *, .sgt { animation: none !important; } }
</style>
