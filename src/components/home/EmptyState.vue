<template>
  <div class="empty-state">
    <div class="empty-icon">✦</div>
    <h2 class="empty-title">Nothing here yet</h2>
    <p class="empty-sub">Tap the + button below to add your first task.</p>
  </div>
</template>

<script setup>
// presentational only
</script>

<style scoped>
.empty-state { text-align: center; padding: 4rem 1rem; }
.empty-icon { font-size: 3rem; color: #2a2a2e; margin-bottom: 1rem; }
.empty-title { font-size: 1.1rem; font-weight: 600; color: #6b6a66; margin: 0; }
.empty-sub { color: #4a4a4e; font-size: 0.875rem; margin-top: 0.5rem; }
</style>
