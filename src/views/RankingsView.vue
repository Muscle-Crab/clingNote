<template>
  <div class="rank-page">
    <header class="rank-head">
      <router-link to="/home" class="rank-back" aria-label="Back to home">← Home</router-link>
      <h1>🏆 Rankings</h1>
      <div class="rank-toggle" role="tablist">
        <button type="button" :class="{ on: view === 'current' }" @click="view = 'current'">This month</button>
        <button type="button" :class="{ on: view === 'last' }" @click="view = 'last'">Last month</button>
      </div>
    </header>

    <div v-if="view === 'current' && finalDay" class="rank-banner" role="status">⏳ Final day — ranking locks tonight at 11:59 PM</div>
    <div v-if="view === 'last'" class="rank-banner rank-banner--final">Final results · {{ monthLabel(shownMonth) }}</div>

    <section v-if="view === 'current'" class="rank-card">
      <div class="rank-me-row">
        <div><strong>{{ my.points }}</strong> pts · <span class="tier" :class="'tier--' + my.tier.toLowerCase()">{{ tierIcon(my.tier) }} {{ my.tier }}</span></div>
        <div v-if="next" class="rank-next">{{ next.need }} pts to {{ next.name }}</div>
        <div v-else class="rank-next">Top tier reached 💎</div>
      </div>
      <div class="bar" :aria-label="'Tier progress'"><div class="bar-fill bar-fill--tier" :style="{ width: tierPct + '%' }"></div></div>

      <div class="rank-me-row">
        <div>Monthly goal: <strong>{{ my.count }}</strong> / {{ my.goal }} tasks <span v-if="my.goalReached">✅ +{{ POINTS_GOAL_BONUS }}</span></div>
        <form class="goal-form" @submit.prevent="saveGoal">
          <input v-model.number="goalInput" type="number" min="1" step="1" aria-label="Monthly goal" />
          <button type="submit" :disabled="busy">Set goal</button>
        </form>
      </div>
      <div class="bar" aria-label="Goal progress"><div class="bar-fill" :style="{ width: goalPct + '%' }"></div></div>

      <p class="rank-rules">{{ POINTS_PER_TASK }} pts per task · +{{ POINTS_STREAK_DAY }} per day with {{ DAILY_STREAK_MIN }}+ tasks · +{{ POINTS_GOAL_BONUS }} for hitting your goal</p>
      <label class="optin"><input type="checkbox" :checked="optIn" @change="toggleOptIn($event.target.checked)" /> Show me on the leaderboard</label>
    </section>

    <section class="rank-card">
      <p v-if="loading" class="muted">Loading…</p>
      <p v-else-if="!board.length" class="muted">No results yet.</p>
      <ol v-else class="board">
        <li v-for="r in board" :key="r.uid" :class="{ me: r.me }">
          <span class="pos">{{ medal(r.rank) }}</span>
          <span class="name">{{ r.displayName }}<em v-if="r.me"> (you{{ r.optIn ? '' : ', hidden' }})</em></span>
          <span class="tier" :class="'tier--' + r.tier.toLowerCase()">{{ tierIcon(r.tier) }} {{ r.tier }}</span>
          <span class="pts">{{ r.points }} pts</span>
        </li>
      </ol>
      <p v-if="view === 'last' && awards.length" class="awards">Badges: <span v-for="a in awards" :key="a">{{ badgeLabel(a) }}</span></p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { localDateStr, DAILY_STREAK_MIN } from '@/utils/streak';
import { monthKey, prevMonthKey, isFinalDay, nextTier, tierFor, computeStats, TIERS, POINTS_PER_TASK, POINTS_STREAK_DAY, POINTS_GOAL_BONUS } from '@/utils/ranking';
import { monthlyBadges } from '@/utils/gamification';
import { loadMyMonth, loadLeaderboard, setMonthlyGoal, setOptIn, awardFinishedMonth } from '@/composables/useMonthlyStats';

const uid = ref(null);
const today = ref(localDateStr());
const view = ref('current');
const board = ref([]);
const loading = ref(false);
const busy = ref(false);
const optIn = ref(true);
const goalInput = ref(100);
const my = ref(computeStats(null));
const awards = ref([]);

const curMonth = computed(() => monthKey(today.value));
const shownMonth = computed(() => (view.value === 'current' ? curMonth.value : prevMonthKey(curMonth.value)));
const finalDay = computed(() => isFinalDay(today.value));
const next = computed(() => nextTier(my.value.points));
const tierPct = computed(() => { const cur = tierFor(my.value.points); return next.value ? Math.min(100, ((my.value.points - cur.min) / (next.value.min - cur.min)) * 100) : 100; });
const goalPct = computed(() => Math.min(100, (my.value.count / my.value.goal) * 100));

const tierIcon = (name) => TIERS.find((t) => t.name === name)?.icon || '';
const medal = (n) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[n] || `#${n}`);
const monthLabel = (mk) => new Date(`${mk}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const badgeLabel = (id) => { const b = monthlyBadges.find((x) => x.id === id.split(':')[0]); return b ? `${b.icon} ${b.name}` : id; };

const load = async () => {
  if (!uid.value) return;
  loading.value = true;
  today.value = localDateStr();
  try {
    const mine = await loadMyMonth(uid.value, curMonth.value);
    my.value = mine.stats; goalInput.value = mine.stats.goal; optIn.value = mine.pub ? mine.pub.optIn !== false : true;
    board.value = await loadLeaderboard(shownMonth.value, uid.value);
    if (view.value === 'last') awards.value = (await awardFinishedMonth(uid.value, shownMonth.value)).filter((a) => a.endsWith(shownMonth.value));
  } catch (e) { console.error('Rankings load failed:', e); }
  loading.value = false;
};

const saveGoal = async () => {
  busy.value = true;
  try { my.value = await setMonthlyGoal(uid.value, curMonth.value, goalInput.value); await load(); } catch (e) { console.error(e); }
  busy.value = false;
};
const toggleOptIn = async (v) => { optIn.value = v; try { await setOptIn(uid.value, curMonth.value, v); await load(); } catch (e) { console.error(e); } };

watch(view, load);
onMounted(() => onAuthStateChanged(auth, (u) => { uid.value = u ? u.uid : null; load(); }));
</script>

<style scoped>
.rank-page { max-width: 640px; margin: 0 auto; padding: 16px; }
.rank-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rank-head h1 { font-size: 1.4rem; font-weight: 700; margin: 0; flex: 1; }
.rank-back { color: var(--c-text-3, #64748b); text-decoration: none; }
.rank-toggle button { padding: 4px 10px; border: 1px solid var(--c-border, #e2e8f0); background: transparent; border-radius: 999px; margin-left: 4px; }
.rank-toggle button.on { background: var(--c-primary, #6366f1); color: #fff; border-color: transparent; }
.rank-banner { margin: 12px 0; padding: 8px 12px; border-radius: 8px; background: var(--c-warn-soft, #fef3c7); color: var(--c-warn-text, #92400e); font-weight: 600; }
.rank-banner--final { background: var(--c-success-soft, #dcfce7); color: var(--c-success, #166534); }
.rank-card { margin-top: 12px; padding: 14px; border-radius: 12px; background: var(--c-surface, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.rank-me-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.rank-next { color: var(--c-text-3, #64748b); font-size: .9rem; }
.bar { height: 8px; border-radius: 999px; background: var(--c-border, #e2e8f0); overflow: hidden; margin: 6px 0 4px; }
.bar-fill { height: 100%; background: var(--c-success, #22c55e); transition: width .3s; }
.bar-fill--tier { background: var(--c-warn, #f59e0b); }
.goal-form input { width: 80px; padding: 2px 6px; border: 1px solid var(--c-border, #e2e8f0); border-radius: 6px; }
.goal-form button { margin-left: 4px; padding: 2px 8px; border-radius: 6px; background: var(--c-primary, #6366f1); color: #fff; }
.rank-rules { font-size: .8rem; color: var(--c-text-3, #64748b); margin: 8px 0; }
.optin { font-size: .9rem; display: flex; gap: 6px; align-items: center; }
.board { list-style: none; padding: 0; margin: 0; }
.board li { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 8px; align-items: center; padding: 8px; border-radius: 8px; }
.board li.me { background: var(--c-primary-soft, #eef2ff); font-weight: 700; outline: 2px solid var(--c-primary, #6366f1); }
.name em { font-weight: 400; font-style: normal; color: var(--c-text-3, #64748b); }
.tier { font-size: .8rem; }
.pts { font-variant-numeric: tabular-nums; }
.muted { color: var(--c-text-3, #64748b); }
.awards span { margin-right: 8px; }
</style>
