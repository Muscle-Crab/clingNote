<template>
  <div class="rc" :class="{ 'rc--badge': badge, 'rc--talk': talking }" :style="{ width: px, height: px }" role="img" :aria-label="label">
    <RobotAvatar :live="talking" />
  </div>
</template>

<script setup>
// The robot coach: the one character in ClingNote (replaces the old drill-sergeant photo). Same art as the assistant
// (RobotAvatar / assistant-robot@{1,2,3}x). talking = faster glow pulse while the robot voice is speaking.
import { computed } from 'vue';
import RobotAvatar from '@/components/home/RobotAvatar.vue';
const props = defineProps({ size: { type: [Number, String], default: 96 }, talking: { type: Boolean, default: false },
  badge: { type: Boolean, default: false }, label: { type: String, default: 'Your robot coach' } });
const px = computed(() => (typeof props.size === 'number' || /^\d+$/.test(String(props.size)) ? `${props.size}px` : props.size));
</script>

<style scoped>
.rc { position: relative; display: block; flex: none; border-radius: 22%; background: radial-gradient(circle at 50% 40%, #16306a 0%, #0a1226 75%); box-sizing: border-box; overflow: hidden; }
/* definite box for the avatar (it sizes to 100% of its parent, which collapses inside some flex/menu layouts) */
.rc :deep(.robot) { position: absolute; inset: 8%; width: auto; height: auto; display: block; }
.rc--badge { border-radius: 50%; box-shadow: 0 0 0 2px rgba(91, 155, 255, .55); }
.rc--talk { box-shadow: 0 0 0 2px rgba(91, 155, 255, .8), 0 0 14px rgba(91, 155, 255, .45); }
</style>
