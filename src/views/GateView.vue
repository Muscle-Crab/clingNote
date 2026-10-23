<template>
  <div class="gate" :class="'gate--' + state.mode">
    <div class="gate-card">
      <p class="gate-app">{{ appName }}</p>

      <template v-if="loading"><p>Checking…</p></template>

      <template v-else-if="state.mode === 'on-break'">
        <div class="gate-icon">☕</div>
        <h1>Break time</h1>
        <p class="gate-timer">{{ fmtCountdown(state.remainingMs) }}</p>
        <p class="muted">Enjoy it. When the timer ends, it's back to work.</p>
        <button class="gate-btn gate-btn--ghost" @click="stopBreak">End break early (refund unused)</button>
      </template>

      <template v-else-if="ended">
        <div class="gate-icon">⏰</div>
        <h1>Break's over</h1>
        <p class="muted">Back to work — close {{ appName }}.</p>
        <router-link to="/home" class="gate-btn">💪 Back to work</router-link>
      </template>

      <template v-else-if="state.mode === 'locked'">
        <div class="gate-icon">🔒</div>
        <h1>Locked: {{ state.left }}/{{ DAILY_STREAK_MIN }} tasks left</h1>
        <p v-if="settings.enabled" class="gate-timer">⏳ {{ fmtCountdown(state.msToDeadline) }} to your {{ settings.deadline }} deadline</p>
        <router-link to="/home" class="gate-btn">✅ Do a task</router-link>
        <template v-if="state.available > 0">
          <p class="muted">You've earned {{ state.available }} min of break so far.</p>
          <button class="gate-btn gate-btn--ghost" @click="beginBreak">Start {{ state.available }}-min break</button>
        </template>
      </template>

      <template v-else-if="state.mode === 'can-break'">
        <div class="gate-icon">🎉</div>
        <h1>Unlocked</h1>
        <p>{{ state.available }} min of break available.</p>
        <button class="gate-btn" @click="beginBreak">Start break ({{ state.available }} min)</button>
      </template>

      <template v-else>
        <div class="gate-icon">🚫</div>
        <h1>No break minutes left</h1>
        <p class="muted">Finish more tasks to earn more ({{ BREAK_PER_TASK }} min each).</p>
        <router-link to="/home" class="gate-btn">Back to work</router-link>
      </template>

      <p class="gate-earned">Earned today: {{ earned }} min · used {{ used }} min</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/firebaseConfig';
import { localDateStr, todayCount, DAILY_STREAK_MIN } from '@/utils/streak';
import { gateState, earnedBreakMinutes, fmtCountdown, BREAK_PER_TASK, defaultSettings } from '@/utils/discipline';
import { loadDisciplineSettings, loadDisciplineState, breaksToday, startBreak, endBreak, logDiscipline } from '@/composables/useDiscipline';
import { rewardsFor } from '@/utils/rewards';

const route = useRoute();
const appName = computed(() => { const a = String(route.query.app || 'this app').replace(/[^\w .-]/g, '').slice(0, 24); return a.toLowerCase() === 'tiktok' ? 'TikTok' : a; });
const uid = ref(null);
const loading = ref(true);
const settings = ref(defaultSettings());
const count = ref(0);
const streakNow = ref(0);
const extraBonus = ref(0);
const breaks = ref({ usedMin: 0, endsAt: 0 });
const now = ref(new Date());
const ended = ref(false);
let timer = null;

const earned = computed(() => earnedBreakMinutes(count.value, streakNow.value, extraBonus.value, DAILY_STREAK_MIN));
const used = computed(() => breaks.value.usedMin || 0);
const state = computed(() => gateState({ count: count.value, earned: earned.value, used: used.value, now: now.value, today: localDateStr(now.value), deadline: settings.value.deadline, breakEndsAt: breaks.value.endsAt, min: DAILY_STREAK_MIN }));

const load = async () => {
  const today = localDateStr();
  const [s, st, streakSnap] = await Promise.all([loadDisciplineSettings(uid.value), loadDisciplineState(uid.value), getDoc(doc(db, 'streaks', uid.value))]);
  settings.value = s;
  const sd = streakSnap.exists() ? streakSnap.data() : {};
  count.value = todayCount(sd, today);
  streakNow.value = Math.min(5, sd.streak || 0);
  extraBonus.value = rewardsFor(sd.bestStreak || sd.streak || 0).breakBonus;
  breaks.value = breaksToday(st, today);
  loading.value = false;
  if (state.value.mode === 'locked') logDiscipline(uid.value, 'gate-open-locked', today, `${appName.value} · ${state.value.left} tasks left`).catch(() => {});
};
const beginBreak = async () => { breaks.value = await startBreak(uid.value, localDateStr(), state.value.available); ended.value = false; };
const stopBreak = async () => { breaks.value = await endBreak(uid.value, localDateStr()); ended.value = true; };

onMounted(() => {
  timer = setInterval(() => {
    const wasOnBreak = state.value.mode === 'on-break';
    now.value = new Date();
    if (wasOnBreak && state.value.mode !== 'on-break') ended.value = true;
  }, 1000);
  onAuthStateChanged(auth, (u) => { uid.value = u ? u.uid : null; if (uid.value) load().catch((e) => { console.error('Gate load failed:', e); loading.value = false; }); });
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: #0f172a; color: #fff; }
.gate--locked { background: radial-gradient(circle at top, #7f1d1d, #0f172a 70%); }
.gate--on-break { background: radial-gradient(circle at top, #065f46, #0f172a 70%); }
.gate-card { max-width: 380px; width: 100%; text-align: center; }
.gate-app { text-transform: uppercase; letter-spacing: .2em; font-size: .75rem; opacity: .7; }
.gate-icon { font-size: 4rem; margin: 8px 0; }
.gate h1 { font-size: 1.8rem; font-weight: 900; margin: 0 0 8px; }
.gate-timer { font-size: 2.2rem; font-weight: 800; font-variant-numeric: tabular-nums; margin: 8px 0; }
.gate-btn { display: inline-block; margin-top: 14px; padding: 12px 22px; border-radius: 999px; background: #fff; color: #0f172a; font-weight: 800; text-decoration: none; border: none; }
.gate-btn--ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.5); font-weight: 600; }
.muted { opacity: .75; }
.gate-earned { margin-top: 24px; font-size: .8rem; opacity: .6; }
</style>
