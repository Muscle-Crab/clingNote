<template>
  <button type="button" class="ctf" data-test="create-task-fab" aria-label="Create task" @click="create">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Create task</span>
  </button>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
const route = useRoute(); const router = useRouter();
// Reuses Home's add-task flow (limits/paywall handled there): on Home fire the event, elsewhere go Home with ?new=1.
const create = () => { if (route.name === 'home') window.dispatchEvent(new CustomEvent('cn:create-task')); else router.push({ path: '/home', query: { new: '1' } }); };
</script>

<style scoped>
.ctf { position: fixed; right: max(16px, calc((100vw - 540px) / 2 + 16px)); bottom: calc(var(--tabbar-h, 64px) + 14px + env(safe-area-inset-bottom)); z-index: 85;
  height: 52px; min-width: 52px; padding: 0 18px 0 14px; display: flex; align-items: center; gap: 8px; border-radius: 26px; border: 0; color: #fff; font: 700 15px/1 Inter, ui-sans-serif, system-ui, sans-serif;
  background: linear-gradient(90deg, #1E5BFF, #2F7BFF 60%, #3C8CFF); box-shadow: 0 10px 28px rgba(30, 91, 255, .45), 0 1px 0 rgba(255,255,255,.25) inset; cursor: pointer; }
.ctf svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
.ctf:active { filter: brightness(.92); } /* no scale-on-tap */
</style>
