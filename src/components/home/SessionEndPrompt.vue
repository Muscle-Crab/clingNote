<template>
  <div v-if="running || prompt" class="sep">
    <button v-if="running && !prompt" type="button" class="sep-end" data-test="end-session-any" @click="$emit('end')">End session</button>
    <div v-if="prompt" class="sep-card" role="dialog" aria-labelledby="sep-t" data-test="session-end-prompt">
      <p id="sep-t" class="sep-title" data-test="session-end-title">Session goal reached</p>
      <p class="sep-copy" data-test="session-end-copy">{{ points }} / {{ goal }} points. End this session now, or keep it running until the timer ends?</p>
      <div class="sep-row">
        <button type="button" data-test="session-end-now" @click="$emit('end')">End session</button>
        <button type="button" data-test="session-end-keep" @click="$emit('keep')">Keep going</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  running: { type: Boolean, default: false },
  prompt: { type: Boolean, default: false },
  points: { type: Number, default: 0 },
  goal: { type: Number, default: 0 },
});
defineEmits(['end', 'keep']);
</script>

<style scoped>
.sep { margin: 8px 0; }
.sep-end, .sep-row button { font: 700 14px/1 system-ui, -apple-system, sans-serif; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(159, 183, 224, .45); background: transparent; color: #e6e9ef; cursor: pointer; }
.sep-card { padding: 12px 14px; border-radius: 14px; background: #121a2e; border: 1px solid rgba(55, 138, 221, .45); color: #e6e9ef; }
.sep-title { margin: 0 0 4px; font-weight: 800; }
.sep-copy { margin: 0 0 10px; font-size: 14px; line-height: 1.35; }
.sep-row { display: flex; flex-wrap: wrap; gap: 8px; }
.sep-row button:first-child { background: #378ADD; border-color: transparent; color: #fff; }
</style>
