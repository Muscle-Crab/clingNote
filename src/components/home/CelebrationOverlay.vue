<template>
  <div class="fullscreen-celebration">
    <div class="celebration-inner">
      <div class="celebration-emoji">🎉</div>
      <h1 class="celebration-title">All done!</h1>
      <p class="celebration-streak">🔥 <span>{{ streak }}</span> day streak</p>
      <p class="celebration-sub">Every task complete. Take a breath — you earned it.</p>
      <button @click="$emit('close')" class="btn-primary btn-lg">Continue</button>
    </div>
  </div>
</template>

<script setup>
defineProps({ streak: { type: Number, default: 0 } });
defineEmits(['close']);
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
.btn-primary.btn-lg { padding: 12px 28px; font-size: 1rem; border-radius: 12px; }
.fullscreen-celebration {
  position: fixed; inset: 0;
  background: #0f0f11;
  display: flex; align-items: center; justify-content: center;
  z-index: 300;
}
.celebration-inner { text-align: center; }
.celebration-emoji { font-size: 4rem; animation: pop 0.5s ease; }
.celebration-title { font-size: 2.5rem; font-weight: 600; margin: 0.5rem 0; }
.celebration-streak { font-size: 1.2rem; color: #F59E0B; margin-bottom: 0.5rem; }
.celebration-streak span { font-weight: 700; }
.celebration-sub { color: #6b6a66; margin-bottom: 2rem; }
@keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
</style>
