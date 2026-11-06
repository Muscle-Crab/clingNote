<template>
  <!-- Compact vault face: a rounded outline and a lock. The entry mark only, never an app icon. -->
  <svg class="vault-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" data-test="vault-mark">
    <rect x="3.2" y="4.8" width="17.6" height="14.8" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.6" />
    <rect x="9" y="11.3" width="6" height="4.7" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
    <path v-if="open" d="M10.1 11.2V8.4a1.9 1.9 0 0 1 3.8 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <path v-else d="M10.1 11.4V9.3a1.9 1.9 0 0 1 3.8 0v2.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <circle cx="12" cy="13.5" r="0.7" fill="currentColor" />
  </svg>
</template>

<script setup>
defineProps({ open: { type: Boolean, default: false } });
</script>

<style scoped>
.vault-mark { display: block; }
</style>
