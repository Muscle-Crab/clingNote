<template>
  <!-- Always-present ClingNote wordmark (UI only; not stamped on images). Never intercepts taps. -->
  <div class="brand-mark" :class="{ inline }" aria-hidden="true" data-test="brand-mark"><span class="bm-dot"></span>ClingNote</div>
</template>
<script setup>
defineProps({ inline: Boolean });
</script>
<style scoped>
.brand-mark { position: fixed; left: max(10px, env(safe-area-inset-left)); bottom: calc(env(safe-area-inset-bottom) + 4px); z-index: 50;
  pointer-events: none; user-select: none; display: inline-flex; align-items: center; gap: 5px;
  font: 700 11px/1 system-ui, -apple-system, sans-serif; letter-spacing: .04em; color: #fff; opacity: .38; }
.brand-mark.inline { position: static; opacity: .45; }
.bm-dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg, #f97316, #facc15); }
</style>
