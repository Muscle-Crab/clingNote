<template>
  <!-- Safe-dial entry. Geometry only, not an app icon. -->
  <svg class="vault-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" data-test="vault-mark">
    <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6" />
    <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.4" />
    <path d="M12 3.4v3.1M12 17.5V20.6M3.4 12h3.1M17.5 12H20.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    <rect x="10.6" y="10.6" width="2.8" height="2.8" rx="0.4" fill="currentColor" />
  </svg>
</template>

<script setup>
defineProps({ open: { type: Boolean, default: false } });
</script>

<style scoped>
.vault-mark { display: block; }
</style>
