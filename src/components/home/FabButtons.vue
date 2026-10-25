<template>
  <div class="fab-group" :class="{ 'fab-group--voice-only': !showAdd }">
    <router-link v-if="showAdd"
        :to="userId ? '#' : '/login'"
        @click.native.prevent="userId && $emit('add')"
        class="fab fab-add"
        title="Add task"
    >
      <svg class="fab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
      </svg>
      <span>Add Task</span>
    </router-link>

    <button v-if="showVoice" @click="$emit('voice')" class="fab fab-voice" :class="{ 'fab-voice--listening': listening }" title="Voice input">
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
  showVoice: { type: Boolean, default: true },
  showAdd: { type: Boolean, default: true },
});
defineEmits(['add', 'voice']);
</script>

<style scoped>
.fab-group { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; display: flex; gap: var(--sp-3); justify-content: center; padding: var(--sp-5) max(var(--sp-3), calc((100vw - 540px) / 2)) calc(var(--sp-3) + env(safe-area-inset-bottom)); background: linear-gradient(to top, var(--c-bg) 55%, transparent); pointer-events: none; }
.fab-group > * { pointer-events: auto; }
.fab { height: 52px; display: flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer; transition: transform .15s, background .15s; border: 1px solid transparent; text-decoration: none; position: relative; border-radius: 14px; font-size: var(--fs-lg); font-weight: 700; }
.fab:active { transform: scale(.97); }
.fab-add { flex: 1; background: var(--c-accent); color: var(--c-on-accent); box-shadow: 0 6px 20px rgba(79, 111, 240, .35); }
.fab-add:hover { background: var(--c-accent-hover); }
.fab-voice { width: 52px; flex: 0 0 52px; background: var(--c-surface); border-color: var(--c-border-strong); color: var(--c-text); }
.fab-voice:hover { background: var(--c-surface-2); }
.fab-voice--listening { border-color: var(--c-success); color: var(--c-success); }
.fab-icon { width: 22px; height: 22px; z-index: 1; position: relative; }
.fab-pulse { position: absolute; inset: -2px; border-radius: 14px; background: rgba(61, 220, 151, .25); animation: ping 1s cubic-bezier(0, 0, .2, 1) infinite; }
@keyframes ping { 75% { transform: scale(1.3); opacity: 0; } }
</style>
