<template>
  <div v-if="mode !== 'hidden'" class="bkp" data-test="break-indicator" :data-mode="mode">
    <div v-if="mode === 'popup'" class="bkp-pop" role="status" data-test="break-popup">
      <span>🎁 Break available · {{ min }} min</span>
      <button type="button" class="gp-chip" data-test="break-popup-take" @click="$emit('take'); $emit('collapse')">Take it</button>
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
.bkp-pop { display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 12px; border-radius: 16px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface, #16161a); color: var(--c-text, #ecebe8); font-size: .78rem; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
.gp-chip { min-height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface, #16161a); color: var(--c-text, #ecebe8); font: inherit; font-size: .72rem; cursor: pointer; }
.bkp-pill { box-shadow: 0 2px 10px rgba(0,0,0,.3); font-variant-numeric: tabular-nums; }
.bkp-pill:disabled { cursor: default; opacity: 1; }
.bkp-x { background: none; border: 0; color: inherit; opacity: .7; font-size: .8rem; cursor: pointer; padding: 0 4px; }
</style>
