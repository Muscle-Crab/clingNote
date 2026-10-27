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

    <button type="button" class="fab fab-voice fab-assistant" :class="{ 'fab-voice--listening': assistantLive }" data-test="assistant-bubble"
        title="Assistant (hold to talk)" aria-label="Assistant. Tap to open, press and hold to talk"
        @pointerdown="hold" @pointerup="release" @pointerleave="release" @pointercancel="release" @contextmenu.prevent @click="onClick">
      <i class="fas fa-robot fab-icon" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script setup>
// Bottom-left floating assistant button (replaces the old standalone mic FAB). Tap = open; long-press = open listening.
defineProps({
  userId: { type: String, default: null },
  assistantLive: { type: Boolean, default: false },
  showAdd: { type: Boolean, default: true },
});
const emit = defineEmits(['add', 'assistant']);
let t = null; let longed = false;
const hold = () => { longed = false; clearTimeout(t); t = setTimeout(() => { longed = true; emit('assistant', true); }, 550); };
const release = (e) => { clearTimeout(t); if (longed && e) e.preventDefault(); };
const onClick = () => { if (longed) { longed = false; return; } emit('assistant', false); };
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
.fab-assistant { touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.fab-assistant .fab-icon { font-size: 22px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
</style>
