<template>
  <button type="button" class="afab" data-test="assistant-fab" aria-label="Assistant (tap to type, hold to talk)" title="Assistant"
    @pointerdown="lp.down" @pointermove="lp.move" @pointerup="lp.up" @pointercancel="lp.cancel" @contextmenu.prevent @selectstart.prevent @click="onClick">✨</button>
</template>

<script setup>
// Quick-add from any main screen: opens Home's assistant (tap) or starts listening (long-press), same as the Home bubble.
import { onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { createLongPress } from '@/utils/longPress';
import { HOLD_MS, askQuery } from '@/utils/assistantFab';
const router = useRouter();
const go = (listen) => router.push({ path: '/home', query: askQuery(listen) });
// Shared press-and-hold (pointer capture + movement tolerance). Tap goes through click so keyboard/VoiceOver work too.
const lp = createLongPress({ ms: HOLD_MS, onLong: () => go(true) });
onBeforeUnmount(() => lp.dispose());
const onClick = () => { if (lp.wasLong()) { lp.dispose(); return; } go(false); };
</script>

<style scoped>
.afab { position: fixed; right: max(16px, calc((100vw - 540px) / 2 + 16px)); bottom: calc(var(--tabbar-h, 64px) + 76px + env(safe-area-inset-bottom)); z-index: 85;
  width: 46px; height: 46px; border-radius: 23px; border: 0; font-size: 20px; color: #fff; background: #111827; box-shadow: 0 8px 22px rgba(0,0,0,.35); cursor: pointer;
  touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.afab:active { filter: brightness(.9); }
</style>
