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
          <p v-if="streakStatus === 'at-risk'" class="streak-sub streak-at-risk">⚠️ {{ streak ? 'Streak at risk' : 'Building today' }} — {{ streakProgress }}/{{ streakMin }} today<span v-if="bestStreak"> · Best {{ bestStreak }}</span></p>
          <p v-else-if="streak === 0" class="streak-sub streak-none">Complete {{ streakMin }} tasks to start your streak<span v-if="bestStreak"> · Best {{ bestStreak }}</span></p>
          <p v-else class="streak-sub">{{ motivationalMessage }}<span v-if="bestStreak"> · Best {{ bestStreak }}</span></p>
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
  bestStreak: { type: Number, default: 0 },
  streakStatus: { type: String, default: 'none' },
  streakProgress: { type: Number, default: 0 },
  streakMin: { type: Number, default: 5 },
  motivationalMessage: { type: String, default: '' },
  pointsAccumulated: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  daySession: { type: Object, required: true },
});
defineEmits(['shutdown', 'end-day']);
</script>

<style scoped>
.header-card { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3) var(--sp-4); padding: var(--sp-4); margin: var(--sp-4) 0 0; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); box-shadow: var(--shadow-1); }
.header-left { display: flex; align-items: center; gap: var(--sp-3); flex: 1 1 auto; min-width: 0; }
.streak-badge { display: none; }
.streak-count { font-size: var(--fs-lg); font-weight: 700; margin: 0; color: var(--c-text); }
.streak-count span { color: var(--c-warn); }
.streak-sub { font-size: var(--fs-xs); color: var(--c-text-3); margin: 0; }
.streak-at-risk { color: var(--c-warn-text, #B45309) !important; font-weight: 600; }
.streak-none { color: var(--c-text-3) !important; }
.header-cold .streak-count, .header-warm .streak-count, .header-hot .streak-count { color: var(--c-text); }
.header-center { flex: 0 0 auto; margin-left: auto; }
.points-pill { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-sm); font-weight: 700; padding: 4px 10px; border-radius: var(--r-pill); background: var(--c-surface-2); border: 1px solid var(--c-border); white-space: nowrap; }
.points-needed { color: var(--c-warn); }
.points-ready { color: var(--c-success); }
.header-right { flex: 1 0 100%; padding-top: var(--sp-3); border-top: 1px solid var(--c-border); display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: var(--sp-2); flex-wrap: wrap; }
.day-controls { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
.btn-day { font-family: inherit; font-size: var(--fs-md); font-weight: 600; min-height: 40px; padding: 0 var(--sp-4); border-radius: var(--r); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; transition: background .15s, border-color .15s; }
.btn-day:hover { background: var(--c-surface-2); border-color: var(--c-border-strong); }
.btn-day:disabled { opacity: .4; cursor: default; }
.btn-end { color: var(--c-text); }
.btn-shutdown { color: var(--c-accent-text); border-color: var(--c-accent-line); }
.session-times { display: flex; gap: var(--sp-3); }
.session-time { font-size: var(--fs-sm); color: var(--c-text-2); font-family: 'JetBrains Mono', monospace; }
</style>
