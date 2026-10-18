<template>
    <header class="header-card" :class="{
      'header-cold': streak < 3,
      'header-warm': streak >= 3 && streak < 7,
      'header-hot': streak >= 7
    }">
      <div class="header-left">
        <div class="streak-badge">
          <span class="streak-icon-wrap">{{ getStreakIcon(streak) }}</span>
        </div>
        <div class="streak-info">
          <p class="streak-count">🔥 <span>{{ streak }}</span> day streak</p>
          <p v-if="streak === 0" class="streak-sub streak-none">Start your streak today</p>
          <p v-else class="streak-sub">{{ motivationalMessage }}</p>
        </div>
      </div>

      <div class="header-center">
        <div v-if="pointsAccumulated < totalPoints && !isNaN(pointsAccumulated) && !isNaN(totalPoints)" class="points-pill points-needed">
          💰 {{ totalPoints - pointsAccumulated }} pts to idle time
        </div>
        <div v-else class="points-pill points-ready">
          🎉 Idle time unlocked!
        </div>
      </div>

      <div class="header-right">

        <div class="day-controls">
          <button type="button" class="btn-day btn-shutdown" @click="$emit('shutdown')">🌙 Shutdown</button>

          <button
              v-if="daySession.started && !daySession.ended"
              @click="$emit('end-day')"
              class="btn-day btn-end"
          >
            🌙 End Day
          </button>

        </div>

        <div class="session-times">

  <span
      v-if="daySession.startedAtText"
      class="session-time started"
  >
    ▶ {{ daySession.startedAtText }}
  </span>

          <span
              v-if="daySession.endedAtText"
              class="session-time ended"
          >
    ■ {{ daySession.endedAtText }}
  </span>

        </div>

      </div>
    </header>
</template>

<script setup>
import { getStreakIcon } from '@/utils/gamification';

defineProps({
  streak: { type: Number, default: 0 },
  motivationalMessage: { type: String, default: '' },
  pointsAccumulated: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  daySession: { type: Object, required: true },
});
defineEmits(['shutdown', 'end-day']);
</script>

<style scoped>
.header-card {
  background: var(--c-surface, #18181b);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.header-cold { border-left: 3px solid var(--c-accent, #6366f1); }
.header-warm { border-left: 3px solid var(--c-warn, #F59E0B); }
.header-hot  { border-left: 3px solid var(--c-danger, #ef4444); }
.header-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 140px; }
.streak-badge {
  width: 40px; height: 40px;
  background: var(--c-surface-2, #1e1e22);
  border: 1px solid var(--c-border, #2a2a2e);
  border-radius: var(--r, 3px);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem;
}
.streak-info {}
.streak-count { font-size: 0.9rem; font-weight: 600; margin: 0; }
.streak-count span { color: var(--c-warn, #F59E0B); }
.streak-sub { font-size: 0.75rem; color: var(--c-text-3, #6b6a66); margin: 0; }
.streak-none { color: var(--c-danger, #ef4444) !important; }
.header-center { flex: 1; min-width: 140px; }
.points-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--r, 3px);
}
.points-needed { background: var(--c-surface-2, #1e1e22); color: var(--c-warn, #F59E0B); border: 1px solid var(--c-warn-line, #3a3a1a); }
.points-ready  { background: var(--c-success-soft, #0d2217); color: var(--c-success, #4ade80); border: 1px solid var(--c-success-soft, #14432a); }
.header-right { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end; }
.day-controls { display: flex; gap: 0.5rem; }
.btn-day {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: var(--r, 3px);
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-day:disabled { opacity: 0.35; cursor: default; }
.btn-end   { background: var(--c-danger-soft, #3b0d0d); color: var(--c-danger-text, #f87171); }
.session-times { display: flex; gap: 0.75rem; }
.session-time { font-size: 0.72rem; color: var(--c-text-3, #6b6a66); font-family: 'JetBrains Mono', monospace; }
.btn-shutdown { background: var(--c-accent-soft, #1e2a3a); color: var(--c-accent-text, #9cc7f7); }
.btn-shutdown:hover, .btn-day:hover { opacity: 0.85; }
.header-card { box-shadow: var(--shadow-1); padding: var(--sp-3) var(--sp-4); gap: var(--sp-3); }
.streak-badge { width: 32px; height: 32px; }
.streak-count { font-size: var(--fs-md); }
.btn-day { height: 32px; padding: 0 12px; font-size: var(--fs-md); border: 1px solid transparent; }
.btn-end { border-color: var(--c-danger-line); }
.btn-shutdown { border-color: var(--c-accent-line); }
.points-pill { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; padding: 0 6px; line-height: 18px; }
@media (max-width: 480px) { .header-right { align-items: stretch; width: 100%; } .day-controls { flex-wrap: wrap; } .day-controls .btn-day { flex: 1; } }
</style>
