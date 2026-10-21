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
    <!-- phase-sections -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { DAILY_STREAK_MIN } from '@/utils/streak';
import { MISSED_DEADLINE_PENALTY, BOSS_BONUS, defaultSettings } from '@/utils/discipline';
import { loadDisciplineSettings, saveDisciplineSettings } from '@/composables/useDiscipline';
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
/* phase-setup */

onMounted(() => onAuthStateChanged(auth, async (u) => {
  uid.value = u ? u.uid : null;
  if (!uid.value) return;
  settings.value = await loadDisciplineSettings(uid.value);
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
.disc-btn { margin-top: 8px; padding: 6px 12px; border-radius: 8px; background: var(--c-primary, #6366f1); color: #fff; }
.disc-h { font-size: 1.05rem; font-weight: 700; margin: 0 0 6px; }
.muted { color: var(--c-text-3, #64748b); font-size: .9rem; }
</style>
