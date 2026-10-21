<template>
  <div class="boss-banner" :class="'boss-banner--' + kind" role="status" aria-live="polite">
    <span class="boss-icon" aria-hidden="true">{{ icon }}</span>
    <p class="boss-text"><strong>Boss:</strong> {{ text }}</p>
    <button v-if="dismissible" type="button" class="boss-x" aria-label="Dismiss" @click="$emit('dismiss')">×</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  kind: { type: String, default: 'morning' }, // morning | midday | evening | idle | watching
  text: { type: String, required: true },
  dismissible: { type: Boolean, default: false },
});
defineEmits(['dismiss']);
const icon = computed(() => ({ morning: '📋', midday: '📢', evening: '🚨', idle: '👀', watching: '👁️' }[props.kind] || '🗣️'));
</script>

<style scoped>
.boss-banner { display: flex; gap: .6rem; align-items: flex-start; margin: .5rem 1rem; padding: .7rem .9rem; border-radius: 10px; background: #1f2937; color: #f3f4f6; border-left: 4px solid #9ca3af; }
.boss-banner--midday { border-color: #f59e0b; }
.boss-banner--evening, .boss-banner--watching { border-color: #ef4444; background: #2a1215; }
.boss-banner--idle { border-color: #60a5fa; }
.boss-icon { font-size: 1.3rem; line-height: 1.2; }
.boss-text { margin: 0; flex: 1; font-size: .95rem; }
.boss-x { background: none; border: 0; color: inherit; font-size: 1.3rem; cursor: pointer; }
</style>
