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
  background: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 16px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.header-cold { border-left: 3px solid #6366f1; }
.header-warm { border-left: 3px solid #F59E0B; }
.header-hot  { border-left: 3px solid #ef4444; }
.header-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 140px; }
.streak-badge {
  width: 40px; height: 40px;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem;
}
.streak-info {}
.streak-count { font-size: 0.9rem; font-weight: 600; margin: 0; }
.streak-count span { color: #F59E0B; }
.streak-sub { font-size: 0.75rem; color: #6b6a66; margin: 0; }
.streak-none { color: #ef4444 !important; }
.header-center { flex: 1; min-width: 140px; }
.points-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
}
.points-needed { background: #1e1e22; color: #F59E0B; border: 1px solid #3a3a1a; }
.points-ready  { background: #0d2217; color: #4ade80; border: 1px solid #14432a; }
.header-right { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end; }
.day-controls { display: flex; gap: 0.5rem; }
.btn-day {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-day:disabled { opacity: 0.35; cursor: default; }
.btn-end   { background: #3b0d0d; color: #f87171; }
.session-times { display: flex; gap: 0.75rem; }
.session-time { font-size: 0.72rem; color: #6b6a66; font-family: 'JetBrains Mono', monospace; }
.btn-shutdown { background: #1e2a3a; color: #9cc7f7; }
.btn-shutdown:hover, .btn-day:hover { opacity: 0.85; }
</style>
