<template>
  <button type="button" class="vo-t" :class="{ off: muted, live: speaking && !muted }" data-test="vo-toggle"
    :aria-label="muted ? 'Unmute robot voice' : 'Mute robot voice'" :aria-pressed="!muted" @click.stop="toggle">
    <span aria-hidden="true">{{ muted ? '🔇' : '🔊' }}</span><small>{{ muted ? 'Voice off' : 'Voice on' }}</small>
  </button>
</template>
<script setup>
import { voMuted as muted, voSpeaking as speaking, setVoMuted, unlockVoice } from '@/composables/useVoiceover';
const emit = defineEmits(['unmuted']);
const toggle = () => { unlockVoice(); const m = !muted.value; setVoMuted(m); if (!m) emit('unmuted'); };
</script>
<style scoped>
.vo-t { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; border: 1px solid #2A3C66; background: rgba(18,32,63,.92); color: #F2F5FC; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.vo-t small { font-size: 12px; color: #A9B4CC; } .vo-t.off { opacity: .75; } .vo-t.live { border-color: #3C8CFF; box-shadow: 0 0 0 3px rgba(47,111,255,.22); }
</style>
