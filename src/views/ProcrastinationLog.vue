<template>
  <div class="log-page">
    <header class="log-head">
      <router-link to="/discipline" class="log-back">← Discipline</router-link>
      <h1>🐌 Procrastination log</h1>
    </header>
    <div class="log-filter">
      <button v-for="f in filters" :key="f.value" type="button" :class="{ on: filter === f.value }" @click="filter = f.value">{{ f.label }} ({{ countOf(f.value) }})</button>
    </div>
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="!shown.length" class="muted">Nothing here. Keep it that way. 💪</p>
    <ul v-else class="log-list">
      <li v-for="(e, i) in shown" :key="i">
        <span class="log-type">{{ LOG_LABELS[e.type] || e.type }}</span>
        <span class="log-detail">{{ e.detail }}</span>
        <time class="log-at" :datetime="e.at">{{ fmt(e) }}</time>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { loadDisciplineState } from '@/composables/useDiscipline';
import { LOG_LABELS } from '@/utils/shareCard';

const log = ref([]);
const loading = ref(true);
const filter = ref('all');
const filters = [{ value: 'all', label: 'All' }, ...Object.entries(LOG_LABELS).map(([value, label]) => ({ value, label }))];
const countOf = (v) => (v === 'all' ? log.value.length : log.value.filter((e) => e.type === v).length);
const shown = computed(() => [...log.value].reverse().filter((e) => filter.value === 'all' || e.type === filter.value));
// Shown in the browser's local time zone (e.g. EDT).
const fmt = (e) => `${new Date(e.at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}${e.date ? ' · for ' + e.date : ''}`;

onMounted(() => onAuthStateChanged(auth, async (u) => {
  if (!u) return;
  try { log.value = (await loadDisciplineState(u.uid)).log || []; } catch (e) { console.error('Log load failed:', e); }
  loading.value = false;
}));
</script>

<style scoped>
.log-page { max-width: 640px; margin: 0 auto; padding: 16px; }
.log-head { display: flex; align-items: center; gap: 12px; }
.log-head h1 { font-size: 1.4rem; font-weight: 700; margin: 0; }
.log-back { color: var(--c-text-3, #64748b); text-decoration: none; }
.log-filter { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.log-filter button { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--c-border, #e2e8f0); font-size: .8rem; }
.log-filter button.on { background: var(--c-primary, #6366f1); color: #fff; border-color: transparent; }
.log-list { list-style: none; padding: 0; }
.log-list li { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 10px; border-bottom: 1px solid var(--c-border, #e2e8f0); }
.log-type { font-weight: 700; }
.log-detail { grid-column: 1; color: var(--c-text-3, #64748b); font-size: .9rem; }
.log-at { grid-column: 2; grid-row: 1 / span 2; font-size: .8rem; color: var(--c-text-3, #64748b); align-self: center; text-align: right; }
.muted { color: var(--c-text-3, #64748b); }
</style>
