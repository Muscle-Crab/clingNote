<template>
  <div class="sgt" :class="{ 'sgt--still': !animate, 'sgt--yell': yelling, 'sgt--badge': badge }" :style="{ width: px, height: px }" role="img" :aria-label="label">
    <div class="sgt-rig">
      <img class="sgt-photo" :src="photo" alt="" draggable="false" />
      <!-- jaw layer: the lower face, clipped and nudged down in short pulses while he yells -->
      <img class="sgt-jaw" :src="photo" alt="" draggable="false" />
      <!-- eyelids for a natural blink -->
      <span class="sgt-lid sgt-lid--l" /><span class="sgt-lid sgt-lid--r" />
    </div>
  </div>
</template>

<script setup>
// Original photoreal drill sergeant (fictional person, generated artwork: src/assets/boss/sergeant.jpg, 320 px, ~9 KB).
// Pure CSS animation: breathing, head/shoulder sway, jaw "yell" pulse while yelling, periodic blink. Off under prefers-reduced-motion.
import { computed } from 'vue';
import photo from '@/assets/boss/sergeant.jpg';
const props = defineProps({ size: { type: [Number, String], default: 96 }, animate: { type: Boolean, default: true }, yelling: { type: Boolean, default: true },
  badge: { type: Boolean, default: true }, label: { type: String, default: 'Drill sergeant pointing at you and yelling' } });
const px = computed(() => (typeof props.size === 'number' || /^\d+$/.test(String(props.size)) ? `${props.size}px` : props.size));
</script>

<style scoped>
.sgt { position: relative; display: block; flex: none; overflow: hidden; border-radius: 22%; background: #4a4a40; }
.sgt--badge { border-radius: 50%; box-shadow: 0 0 0 2px rgba(91, 155, 255, .55); }
.sgt-rig { position: absolute; inset: 0; transform-origin: 50% 100%; animation: sgt-breathe 3.6s ease-in-out infinite, sgt-sway 7s ease-in-out infinite; }
.sgt-photo, .sgt-jaw { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; user-select: none; -webkit-user-drag: none; }
.sgt-jaw { clip-path: polygon(38% 53%, 62% 53%, 64% 66%, 58% 74%, 42% 74%, 36% 66%); opacity: 0; }
.sgt--yell .sgt-jaw { opacity: 1; animation: sgt-jaw .52s ease-in-out infinite; }
.sgt--yell .sgt-rig { animation: sgt-breathe 3.6s ease-in-out infinite, sgt-sway 7s ease-in-out infinite, sgt-bark 1.04s ease-in-out infinite; }
.sgt-lid { position: absolute; width: 9%; height: 4.5%; top: 34.5%; border-radius: 50%; background: radial-gradient(ellipse at 50% 40%, #a9806a 0%, #8e624e 70%, #6f4a3a 100%);
  transform: scaleY(0); transform-origin: 50% 0; animation: sgt-blink 4.8s infinite; }
.sgt-lid--l { left: 35.5%; } .sgt-lid--r { left: 53.5%; top: 33.8%; }
@keyframes sgt-breathe { 0%, 100% { scale: 1; } 50% { scale: 1.022; } }
@keyframes sgt-sway { 0%, 100% { rotate: -0.9deg; translate: -0.6% 0; } 50% { rotate: 0.9deg; translate: 0.6% 0; } }
@keyframes sgt-bark { 0%, 100% { transform: translateY(0); } 20% { transform: translateY(-1.2%); } 45% { transform: translateY(0.4%); } }
@keyframes sgt-jaw { 0%, 100% { transform: translateY(0) scaleY(1); } 40% { transform: translateY(2.2%) scaleY(1.05); } 60% { transform: translateY(1.4%) scaleY(1.03); } }
@keyframes sgt-blink { 0%, 93%, 100% { transform: scaleY(0); } 95.5% { transform: scaleY(1); } }
.sgt--still .sgt-rig, .sgt--still .sgt-jaw, .sgt--still .sgt-lid { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .sgt-rig, .sgt-jaw, .sgt-lid { animation: none !important; } }
</style>
