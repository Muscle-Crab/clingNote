<template>
  <section class="task-section day-not-started">
    <div class="empty-state">
      <div class="empty-icon">🌅</div>

      <h2 class="empty-title">
        Start Your Day
      </h2>

      <p class="empty-sub">
        Your tasks will appear after you press
        <strong>Start Day</strong>.
      </p>

      <button
          @click="$emit('start')"
          class="btn-primary"
      >
        🌅 Start Day
      </button>
    </div>
  </section>
</template>

<script setup>
defineEmits(['start']);
</script>

<style scoped>
.btn-primary {
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  background: #378ADD;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2a6db0; }
.task-section { }
.empty-state { text-align: center; padding: 4rem 1rem; }
.empty-icon { font-size: 3rem; color: #2a2a2e; margin-bottom: 1rem; }
.empty-title { font-size: 1.1rem; font-weight: 600; color: #6b6a66; margin: 0; }
.empty-sub { color: #4a4a4e; font-size: 0.875rem; margin-top: 0.5rem; }
</style>
