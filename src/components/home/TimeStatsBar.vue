<template>
  <div class="stats-bar">
    <div class="stat"><i class="far fa-clock stat-icon" aria-hidden="true"></i><div><p class="stat-val">{{ stats.totalDayTime }}</p><p class="stat-label">tracked</p></div></div>
    <div class="stat"><i class="fas fa-bullseye stat-icon" aria-hidden="true"></i><div><p class="stat-val">{{ stats.productiveTime }}</p><p class="stat-label">focused</p></div></div>
    <div class="stat"><i class="far fa-check-circle stat-icon" aria-hidden="true"></i><div><p class="stat-val">{{ stats.missedTasks }}</p><p class="stat-label">missed</p></div></div>
    <button type="button" class="wrap-btn" :class="{ 'wrap-btn--suggest': suggest && !ended }" :title="suggest ? 'It\'s evening — wrap up the day' : 'Shutdown routine'" :disabled="ended" @click="$emit('wrap-up')">
      <span aria-hidden="true">🌙</span> {{ ended ? 'Day wrapped' : 'Wrap up day' }} <i v-if="!ended" class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({ stats: { type: Object, required: true }, ended: { type: Boolean, default: false }, suggest: { type: Boolean, default: false } });
defineEmits(['wrap-up']);
</script>

<style scoped>
.stats-bar { display: flex; align-items: center; gap: 4px; margin: 12px 0 16px; padding: 8px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); }
.stat { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
.stat + .stat { border-left: 1px solid var(--c-border); }
.stat-icon { color: var(--c-text-3); font-size: 18px; }
.stat-val { margin: 0; font-size: 16px; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; line-height: 20px; }
.stat-label { margin: 0; font-size: var(--fs-xs); color: var(--c-text-3); }
.wrap-btn { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--c-accent-line); background: var(--c-accent-soft); color: var(--c-text); font-weight: 600; font-size: var(--fs-sm); cursor: pointer; white-space: nowrap; }
.wrap-btn--suggest { background: linear-gradient(180deg, #2F7BFF, #1C5BE8); border-color: transparent; box-shadow: 0 0 0 3px rgba(47,111,255,.25); }
.wrap-btn:hover { filter: brightness(1.15); }
.wrap-btn:disabled { opacity: .6; cursor: default; }
.wrap-btn i { font-size: 10px; color: var(--c-text-3); }
@media (max-width: 380px) { .stat-icon { display: none; } .wrap-btn { padding: 0 10px; } }
</style>
