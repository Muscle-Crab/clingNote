<template>
  <div class="fab-group">
    <router-link
        :to="userId ? '#' : '/login'"
        @click.native.prevent="userId && $emit('add')"
        class="fab fab-add"
        title="Add task"
    >
      <svg class="fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
      </svg>
    </router-link>

    <button @click="$emit('voice')" class="fab fab-voice" :class="{ 'fab-voice--listening': listening }" title="Voice input">
      <span v-if="listening" class="fab-pulse"></span>
      <svg xmlns="http://www.w3.org/2000/svg" class="fab-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
defineProps({
  userId: { type: String, default: null },
  listening: { type: Boolean, default: false },
});
defineEmits(['add', 'voice']);
</script>

<style scoped>
.fab-group {
  position: fixed;
  bottom: 28px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  z-index: 100;
}
.fab {
  width: 56px; height: 56px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  border: none;
  text-decoration: none;
  position: relative;
}
.fab:hover { transform: scale(1.08); }
.fab:active { transform: scale(0.95); }
.fab-add { background: var(--c-accent, #378ADD); color: white; box-shadow: 0 4px 20px rgba(55, 138, 221, 0.4); }
.fab-voice { background: var(--c-surface, #18181b); border: 2px solid var(--c-border, #2a2a2e); color: var(--c-text-3, #6b6a66); }
.fab-voice--listening { border-color: var(--c-success, #4ade80); color: var(--c-success, #4ade80); }
.fab-icon { width: 22px; height: 22px; z-index: 1; position: relative; }
.fab-pulse {
  position: absolute; inset: -2px;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.25);
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.chip--high { background: var(--c-danger-soft, #3b0d0d); color: var(--c-danger-text, #fca5a5); }
.chip--medium { background: var(--c-warn-soft, #3a2d0a); color: var(--c-warn-text, #fcd34d); }
.load-summary--over { border-color: var(--c-danger-line, #7f1d1d); }
@keyframes ping { 75% { transform: scale(1.5); opacity: 0; } }
.fab { box-shadow: var(--shadow-2); }
.fab-add { background: var(--c-accent); box-shadow: var(--shadow-2); }
.fab-add:hover { background: var(--c-accent-hover); }
.fab-voice { border-width: 1px; }
</style>
