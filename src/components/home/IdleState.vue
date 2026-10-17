<template>
  <div class="idle-state">
    <img src="@/assets/free.svg" alt="Idle time" class="idle-img" />
    <h2 class="idle-title">Idle time 🧘</h2>
    <p class="idle-sub">All done. Rest well.</p>
  </div>
</template>

<script setup>
// presentational only
</script>

<style scoped>
.idle-state { text-align: center; padding: 3rem 1rem; }
.idle-img { width: 160px; height: 160px; opacity: 0.5; }
.idle-title { font-size: 1.25rem; font-weight: 600; color: #6b6a66; margin: 0; }
.idle-sub { color: #4a4a4e; font-size: 0.875rem; margin-top: 0.5rem; }
.chip--high { background: #3b0d0d; color: #fca5a5; }
.chip--medium { background: #3a2d0a; color: #fcd34d; }
.load-summary--over { border-color: #7f1d1d; }
</style>
