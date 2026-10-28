<template>
  <button type="button" class="afab" data-test="assistant-fab" aria-label="Assistant (tap to type, hold to talk)" title="Assistant"
    @pointerdown="down" @pointerup="up" @pointerleave="cancel" @contextmenu.prevent>✨</button>
</template>

<script setup>
// Quick-add from any main screen: opens Home's assistant (tap) or starts listening (long-press), same as the Home bubble.
import { useRouter } from 'vue-router';
import { HOLD_MS, askQuery } from '@/utils/assistantFab';
const router = useRouter();
let timer = null; let held = false;
const go = (listen) => router.push({ path: '/home', query: askQuery(listen) });
const down = () => { held = false; clearTimeout(timer); timer = setTimeout(() => { held = true; go(true); }, HOLD_MS); };
const up = () => { clearTimeout(timer); if (!held) go(false); };
const cancel = () => clearTimeout(timer);
</script>

<style scoped>
.afab { position: fixed; right: max(16px, calc((100vw - 540px) / 2 + 16px)); bottom: calc(var(--tabbar-h, 64px) + 76px + env(safe-area-inset-bottom)); z-index: 85;
  width: 46px; height: 46px; border-radius: 23px; border: 0; font-size: 20px; color: #fff; background: #111827; box-shadow: 0 8px 22px rgba(0,0,0,.35); cursor: pointer;
  touch-action: manipulation; -webkit-user-select: none; user-select: none; }
.afab:active { filter: brightness(.9); }
</style>
