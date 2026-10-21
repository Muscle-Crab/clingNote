<template>
  <div class="drama" :class="'drama--' + variant" role="dialog" aria-modal="true" :aria-label="title" @click.self="$emit('close')">
    <div class="drama-flash" aria-hidden="true"></div>
    <div class="drama-card">
      <div class="drama-icon" aria-hidden="true">{{ icon }}</div>
      <h2 class="drama-title">{{ title }}</h2>
      <p v-if="subtitle" class="drama-sub">{{ subtitle }}</p>
      <slot />
      <button type="button" class="drama-btn" @click="$emit('close')">{{ button }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  variant: { type: String, default: 'lost' }, // lost | victory | levelup | reward
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  button: { type: String, default: 'Continue' },
});
defineEmits(['close']);
const icon = computed(() => ({ lost: '💀', victory: '⚔️', levelup: '⬆️', reward: '🎁' }[props.variant] || '✨'));
</script>

<style scoped>
.drama { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.85); }
.drama-flash { position: absolute; inset: 0; pointer-events: none; }
.drama--lost .drama-flash { background: #dc2626; animation: redflash 1.2s ease-out 2; opacity: 0; }
.drama--lost .drama-card { animation: shake .6s cubic-bezier(.36,.07,.19,.97) 3; border-color: #dc2626; }
.drama--victory .drama-card, .drama--levelup .drama-card, .drama--reward .drama-card { animation: pop .5s ease-out; border-color: #f59e0b; }
.drama-card { position: relative; max-width: 360px; width: 90%; text-align: center; padding: 28px 20px; border-radius: 16px; background: #111; color: #fff; border: 2px solid; }
.drama-icon { font-size: 4rem; }
.drama-title { font-size: 2rem; font-weight: 900; text-transform: uppercase; margin: 8px 0; letter-spacing: .04em; }
.drama--lost .drama-title { color: #f87171; }
.drama-sub { color: #d1d5db; margin-bottom: 16px; }
.drama-btn { margin-top: 12px; padding: 10px 20px; border-radius: 999px; background: #fff; color: #111; font-weight: 700; }
@keyframes shake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-8px); } 40%, 60% { transform: translateX(8px); } }
@keyframes redflash { 0% { opacity: .7; } 100% { opacity: 0; } }
@keyframes pop { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .drama-card, .drama-flash { animation: none !important; } }
</style>
