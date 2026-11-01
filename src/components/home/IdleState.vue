<template>
  <div class="idle-state" data-test="idle-state" role="status">
    <div class="idle-badge" aria-hidden="true">
      <RobotAvatar class="idle-robot" />
      <span class="idle-check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></span>
    </div>
    <h2 class="idle-title">{{ wrapped ? 'Day wrapped' : 'All done' }}<span v-if="count"> · {{ count }}/{{ count }}</span></h2>
    <p class="idle-sub">All done. Rest well.</p>
  </div>
</template>

<script setup>
// Celebratory done state (replaces the old off-brand "free.svg" idle illustration): the robot mascot with a check badge.
import RobotAvatar from './RobotAvatar.vue';
defineProps({ wrapped: { type: Boolean, default: false }, count: { type: Number, default: 0 } });
</script>

<style scoped>
.idle-state { position: relative; text-align: center; padding: 1.75rem 1rem 1.25rem; }
.idle-badge { position: relative; display: inline-grid; place-items: center; width: 96px; height: 96px; border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, rgba(74,168,255,.22), rgba(30,91,255,.08) 62%, transparent 72%); }
.idle-robot { width: 72px; height: 72px; }
.idle-robot :deep(img) { width: 72px; height: 72px; }
.idle-check { position: absolute; right: 2px; bottom: 4px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(180deg, #34c37a, #1f9d5c); box-shadow: 0 0 0 3px #0a1226, 0 6px 16px rgba(31,157,92,.45); }
.idle-check svg { width: 18px; height: 18px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.idle-title { margin: .75rem 0 0; font-size: 1.25rem; font-weight: 700; color: var(--c-text, #e6e9ef); }
.idle-title span { color: #6fd39b; font-variant-numeric: tabular-nums; }
.idle-sub { margin: .35rem 0 0; font-size: .95rem; font-weight: 500; color: var(--c-text-2, #B4BCCB); }
</style>
