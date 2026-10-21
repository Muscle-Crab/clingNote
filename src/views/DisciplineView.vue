<template>
  <div class="disc-page">
    <header class="disc-head">
      <router-link to="/home" class="disc-back">← Home</router-link>
      <h1>⚔️ Discipline Mode</h1>
    </header>

    <section class="disc-card">
      <label class="disc-row"><input type="checkbox" :checked="settings.enabled" @change="update({ enabled: $event.target.checked })" /> <strong>Discipline Mode</strong></label>
      <p class="muted">Finish {{ DAILY_STREAK_MIN }} tasks (not pending) by your deadline every day. Miss it: {{ MISSED_DEADLINE_PENALTY }} pts, streak dies, tier can drop.</p>
      <label class="disc-row">Daily deadline <input type="time" :value="settings.deadline" @change="update({ deadline: $event.target.value })" /></label>
      <button v-if="canNotify" type="button" class="disc-btn" @click="askNotify">🔔 Enable deadline notifications</button>
      <p v-if="saved" class="muted">Saved ✓</p>
    </section>
    <section class="disc-card">
      <h2 class="disc-h">👹 Evening boss</h2>
      <p class="muted">Open a task on today's list and tap “Make this the evening boss”. Subtasks drain its HP. With Discipline Mode on, your day won't count toward the streak until the boss is cleared. Clearing it: +{{ BOSS_BONUS }} pts.</p>
    </section>
    <section class="disc-card">
      <h2 class="disc-h">☕ Earned breaks</h2>
      <p class="muted">{{ BREAK_PER_TASK }} min per completed task, +{{ BREAK_ALL_DONE }} min for hitting {{ DAILY_STREAK_MIN }}, +5 at a 7-day streak, +10 at 30 days.</p>
      <router-link to="/gate?app=tiktok" class="disc-btn">Open break gate</router-link>
      <p class="muted">Want it in front of TikTok? See the iPhone Shortcuts setup in <code>docs/tiktok-gate.md</code>: automation “When TikTok is opened → Open URL https://clingnot.netlify.app/gate?app=tiktok”, Run Immediately.</p>
    </section>
    <section class="disc-card">
      <h2 class="disc-h">⭐ Level {{ lv.level }}</h2>
      <div class="xp-bar"><div class="xp-fill" :style="{ width: lv.pct + '%' }"></div></div>
      <p class="muted">{{ lv.xp }} XP (lifetime points) · {{ lv.toNext }} XP to level {{ lv.level + 1 }}</p>
      <h3 class="disc-h">🎁 Streak rewards (best {{ best }} days)</h3>
      <ul class="rewards">
        <li v-for="m in MILESTONES" :key="m.days" :class="{ got: best >= m.days }">{{ best >= m.days ? '✅' : '🔒' }} {{ m.days }} days — {{ m.label }}</li>
      </ul>
      <p class="muted">Streak freezes: {{ Math.max(0, rw.freezes - (dstate.freezesUsed || 0)) }} available (auto-used for one missed deadline).</p>
      <label v-if="rw.themes.length" class="disc-row">Theme
        <select :value="dstate.theme || ''" @change="pickTheme($event.target.value)">
          <option value="">Default</option>
          <option v-for="t in rw.themes" :key="t" :value="t">{{ t }}</option>
        </select></label>
    </section>
    <!-- phase-sections -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/firebaseConfig';
import { DAILY_STREAK_MIN } from '@/utils/streak';
import { MISSED_DEADLINE_PENALTY, BOSS_BONUS, BREAK_PER_TASK, BREAK_ALL_DONE, defaultSettings } from '@/utils/discipline';
import { loadDisciplineSettings, saveDisciplineSettings, loadDisciplineState, patchDisciplineState } from '@/composables/useDiscipline';
import { levelFor, rewardsFor, MILESTONES } from '@/utils/rewards';
import { doc, getDoc } from 'firebase/firestore';
/* phase-imports */

const uid = ref(null);
const settings = ref(defaultSettings());
const saved = ref(false);
const canNotify = ref(typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default');

const update = async (patch) => {
  settings.value = { ...settings.value, ...patch };
  try { settings.value = await saveDisciplineSettings(uid.value, settings.value); saved.value = true; setTimeout(() => { saved.value = false; }, 1500); } catch (e) { console.error('Save discipline failed:', e); }
};
const askNotify = async () => { try { await Notification.requestPermission(); } catch (e) { /* unsupported */ } canNotify.value = false; };
const dstate = ref({});
const best = ref(0);
const lv = computed(() => levelFor(dstate.value.xp || 0));
const rw = computed(() => rewardsFor(best.value));
const pickTheme = async (t) => { dstate.value = { ...dstate.value, theme: t }; try { await patchDisciplineState(uid.value, { theme: t }); } catch (e) { console.error(e); } };
/* phase-setup */

onMounted(() => onAuthStateChanged(auth, async (u) => {
  uid.value = u ? u.uid : null;
  if (!uid.value) return;
  settings.value = await loadDisciplineSettings(uid.value);
  dstate.value = await loadDisciplineState(uid.value);
  const sd = await getDoc(doc(db, 'streaks', uid.value));
  best.value = sd.exists() ? (sd.data().bestStreak || sd.data().streak || 0) : 0;
  /* phase-load */
}));
</script>

<style scoped>
.disc-page { max-width: 640px; margin: 0 auto; padding: 16px; }
.disc-head { display: flex; align-items: center; gap: 12px; }
.disc-head h1 { font-size: 1.4rem; font-weight: 700; margin: 0; }
.disc-back { color: var(--c-text-3, #64748b); text-decoration: none; }
.disc-card { margin-top: 12px; padding: 14px; border-radius: 12px; background: var(--c-surface, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.disc-row { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
.disc-row input[type=time] { border: 1px solid var(--c-border, #e2e8f0); border-radius: 6px; padding: 2px 6px; }
.disc-btn { display: inline-block; text-decoration: none;
}
.disc-btn { margin-top: 8px; padding: 6px 12px; border-radius: 8px; background: var(--c-primary, #6366f1); color: #fff; }
.disc-h { font-size: 1.05rem; font-weight: 700; margin: 0 0 6px; }
.xp-bar { height: 10px; border-radius: 999px; background: var(--c-border, #e2e8f0); overflow: hidden; }
.xp-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6, #ec4899); }
.rewards { list-style: none; padding: 0; margin: 4px 0; }
.rewards li { padding: 2px 0; opacity: .6; }
.rewards li.got { opacity: 1; font-weight: 600; }
.muted { color: var(--c-text-3, #64748b); font-size: .9rem; }
</style>
