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

    <button type="button" class="fab fab-voice fab-assistant" :class="{ 'fab-voice--listening': assistantLive }" data-test="assistant-bubble" data-coach="sergeant"
        title="Assistant (hold for choices)" aria-label="Assistant. Tap to open, press and hold for choices" :aria-expanded="menuOpen ? 'true' : 'false'"
        @pointerdown="hold" @pointerup="release" @pointerleave="release" @pointercancel="release" @contextmenu.prevent @click="onClick">
      <RobotAvatar class="fab-robot" :live="assistantLive" />
    </button>
    <!-- Sergeant long-press menu: only exists while open (no permanent UI); anchored to the robot it came from. -->
    <div v-if="menuOpen" ref="menuEl" class="sg-menu" role="menu" aria-label="Robot choices" data-test="sergeant-menu" @keydown.esc="close">
      <button v-for="a in SERGEANT_ACTIONS" :key="a.id" type="button" role="menuitem" class="sg-item" :data-coach="'sg-' + a.id" :data-test="'sg-' + a.id" @click="choose(a.id)">
        <span class="sg-ic" aria-hidden="true">{{ a.icon }}</span><span class="sg-txt"><b>{{ a.label }}</b><small>{{ a.hint }}</small></span>
      </button>
      <button type="button" role="menuitem" class="sg-item sg-talk" data-test="sg-talk" @click="talk"><span class="sg-ic" aria-hidden="true">🎙️</span><span class="sg-txt"><b>Talk to me</b></span></button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import RobotAvatar from './RobotAvatar.vue';
import { SERGEANT_ACTIONS, HOLD_MS } from '@/utils/sergeantMenu';
// Bottom-left floating assistant button (replaces the old standalone mic FAB). Tap = open; long-press = open listening.
defineProps({
  userId: { type: String, default: null },
  assistantLive: { type: Boolean, default: false },
  showAdd: { type: Boolean, default: true },
});
const emit = defineEmits(['add', 'assistant', 'sergeant', 'menu-open']);
// Tap = open the assistant. Press and hold = the sergeant menu (What's next · Replan · I'm off · Make critical · Talk).
const menuOpen = ref(false); const menuEl = ref(null);
let t = null; let longed = false;
const close = () => { menuOpen.value = false; };
const choose = (id) => { menuOpen.value = false; emit('sergeant', id); };
const talk = () => { menuOpen.value = false; emit('assistant', true); };
const onDocDown = (e) => { if (menuEl.value && !menuEl.value.contains(e.target) && !e.target.closest('[data-coach="sergeant"], .coach-skip')) menuOpen.value = false; };
watch(menuOpen, (o) => { document.removeEventListener('pointerdown', onDocDown, true); if (o) { document.addEventListener('pointerdown', onDocDown, true); emit('menu-open'); nextTick(() => menuEl.value && menuEl.value.querySelector('button') && menuEl.value.querySelector('button').focus({ preventScroll: true })); } });
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocDown, true));
const hold = () => { longed = false; clearTimeout(t); t = setTimeout(() => { longed = true; menuOpen.value = true; try { navigator.vibrate && navigator.vibrate(15); } catch (e) { /* ignore */ } }, HOLD_MS); };
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
.fab-assistant { padding: 3px; overflow: visible; }
.fab-robot { width: 46px; height: 46px; }
/* sergeant menu: big plain text, large tap targets (older users); sits above the robot, gone when closed */
.sg-menu { position: fixed; left: max(12px, calc((100vw - 540px) / 2 + 12px)); max-width: calc(100vw - 24px); bottom: calc(96px + env(safe-area-inset-bottom)); z-index: 101; min-width: 250px; display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
.sg-item { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 12px; background: transparent; border: 0; border-radius: 12px; color: var(--c-text); text-align: left; cursor: pointer; }
.sg-item:hover, .sg-item:focus-visible { background: var(--c-surface); outline: none; }
.sg-ic { font-size: 24px; width: 30px; text-align: center; }
.sg-txt { display: flex; flex-direction: column; }
.sg-txt b { font-size: 19px; line-height: 1.2; }
.sg-txt small { font-size: 15px; color: var(--c-text-2); }
.sg-talk { border-top: 1px solid var(--c-border); border-radius: 0 0 12px 12px; }
.fab-assistant.fab-voice--listening { box-shadow: 0 0 0 2px #4aa8ff, 0 0 14px 2px rgba(74, 168, 255, .65); }
</style>
