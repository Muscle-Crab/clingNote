<template>
  <div v-if="mode !== 'hidden'" class="bkp" data-test="break-indicator" :data-mode="mode">
    <div v-if="mode === 'popup'" class="bkp-pop" role="status" data-test="break-popup">
      <span class="bkp-gift" aria-hidden="true">🎁</span>
      <span class="bkp-txt"><b>Break earned</b><small>{{ min }} min · all apps open</small></span>
      <button type="button" class="gp-chip bkp-take" data-test="break-popup-take" @click="$emit('take'); $emit('collapse')">Take it</button>
      <button type="button" class="bkp-x" aria-label="Dismiss" data-test="break-popup-dismiss" @click="$emit('collapse')">✕</button>
    </div>
    <button v-else-if="mode === 'pill'" type="button" class="gp-chip bkp-pill" data-test="break-pill" aria-label="Break available: take it" @click="$emit('take')">🎁 {{ min }}m</button>
    <button v-else type="button" class="gp-chip bkp-pill" data-test="break-pill-running" aria-label="Break running: time left" disabled>☕ {{ left }}</button>
  </div>
</template>
<script setup>
defineProps({ mode: { type: String, default: 'hidden' }, min: { type: Number, default: 20 }, left: { type: String, default: '' } });
defineEmits(['take', 'collapse']);
</script>
<style scoped>
.bkp { position: fixed; right: 8px; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); z-index: 60; }
.bkp-pop { display: flex; align-items: center; gap: 8px; max-width: min(300px, calc(100vw - 16px)); padding: 8px 6px 8px 10px; border-radius: 14px; border: 1.5px solid rgba(255, 196, 80, .75); background: var(--c-surface, #16161a); color: var(--c-text, #ecebe8); font-size: .8rem; box-shadow: 0 0 0 3px rgba(255, 196, 80, .15), 0 8px 24px rgba(0,0,0,.45); animation: bkp-in .35s ease-out; }
.bkp-gift { font-size: 1.25rem; line-height: 1; } .bkp-txt { display: grid; line-height: 1.2; } .bkp-txt b { font-weight: 700; } .bkp-txt small { font-size: .7rem; opacity: .75; }
.bkp-take { background: rgba(255, 196, 80, .95); color: #1b1404; border-color: transparent; font-weight: 700; }
@keyframes bkp-in { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .bkp-pop { animation: none; } }
.gp-chip { min-height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface, #16161a); color: var(--c-text, #ecebe8); font: inherit; font-size: .72rem; cursor: pointer; }
.bkp-pill { box-shadow: 0 2px 10px rgba(0,0,0,.3); font-variant-numeric: tabular-nums; }
.bkp-pill:disabled { cursor: default; opacity: 1; }
.bkp-x { background: none; border: 0; color: inherit; opacity: .7; font-size: .8rem; cursor: pointer; padding: 0 4px; }
</style>
