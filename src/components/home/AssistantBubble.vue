<template>
  <button type="button" class="toggle-visibility asst-bubble" :class="{ 'asst-bubble--live': live }" data-test="assistant-bubble" aria-label="Open assistant" title="Assistant"
          @click="onClick" @contextmenu.prevent="$emit('open', true)" @pointerdown="hold" @pointerup="release" @pointercancel="release">
    <i class="fas fa-comment-dots" aria-hidden="true"></i>
    <span v-if="dot" class="asst-dot" aria-hidden="true"></span>
  </button>
</template>
<script setup>
// ClingNote assistant entry point: takes the old speaker slot in TaskListHeader (.header-actions). Tap = open; long-press = open listening.
const props = defineProps({ live: Boolean, dot: Boolean });
const emit = defineEmits(['open']);
let t = null; let longed = false;
const hold = () => { longed = false; clearTimeout(t); t = setTimeout(() => { longed = true; emit('open', true); }, 550); };
const release = (e) => { clearTimeout(t); if (longed && e) e.preventDefault(); };
const onClick = () => { if (longed) { longed = false; return; } emit('open', false); };
void props;
</script>
<style scoped>
.asst-bubble { position: relative; min-width: 44px; min-height: 44px; border-radius: 50%; }
.asst-bubble--live { animation: asst-pulse 1.2s ease-in-out infinite; }
.asst-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; background: #ff5a5a; }
@keyframes asst-pulse { 50% { box-shadow: 0 0 0 6px rgba(80,160,255,.25); } }
@media (prefers-reduced-motion: reduce) { .asst-bubble--live { animation: none; } }
</style>
