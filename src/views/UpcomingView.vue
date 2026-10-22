<template>
  <div class="up-page">
    <header class="up-head">
      <router-link to="/home" class="up-back">← Home</router-link>
      <h1>📅 Upcoming</h1>
    </header>
    <p class="muted">Tasks due after this week (through {{ weekEndLabel }}). They show up in your daily list from the Monday of their week.</p>
    <p v-if="error" class="up-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Loading…</p>

    <section class="up-card">
      <h2 class="up-h">📆 Calendar feed</h2>
      <p class="muted">Subscribe in Apple Calendar or Google Calendar to see scheduled, repeating and due-dated tasks. Read-only, refreshes about hourly. Anyone with the link can see your task titles, so keep it private; rotate it if it leaks.</p>
      <template v-if="feed">
        <input class="up-input up-feed" readonly :value="feed.https" aria-label="Calendar feed URL" @focus="$event.target.select()" />
        <div class="up-actions">
          <a :href="feed.webcal" class="up-btn up-btn--primary">Subscribe (Apple)</a>
          <button type="button" class="up-btn" @click="copyFeed">{{ copied ? 'Copied ✓' : 'Copy URL' }}</button>
          <button type="button" class="up-btn" @click="rotate">New link</button>
          <button type="button" class="up-btn up-btn--danger" @click="revoke">Revoke</button>
        </div>
        <p class="muted">Google Calendar: Other calendars → + → From URL → paste the link.</p>
      </template>
      <button v-else type="button" class="up-btn up-btn--primary" :disabled="feedBusy" @click="rotate">Create private feed link</button>
    </section>

    <section v-if="templates.length" class="up-card">
      <h2 class="up-h">🔁 Repeating</h2>
      <div v-for="t in templates" :key="t.id" class="up-row">
        <div class="up-main">
          <strong>{{ t.title }}</strong>
          <span class="muted">{{ describeRecurrence(t.recurrence) }}{{ t.stopped ? ' · stopped' : '' }}</span>
          <span v-if="!t.stopped" class="muted">Next: {{ nextOccurrences(t, weekEnd, 3).map((d) => formatScheduledDate(d, today)).join(' · ') || '—' }}</span>
        </div>
        <div class="up-actions">
          <button type="button" class="up-btn" @click="editing = editing === t.id ? null : t.id">Edit</button>
          <button v-if="!t.stopped" type="button" class="up-btn" @click="stopTemplate(t)">Stop</button>
          <button type="button" class="up-btn up-btn--danger" @click="remove(t.id)">Delete</button>
        </div>
        <div v-if="editing === t.id" class="up-edit">
          <input v-model="draft[t.id].title" class="up-input" aria-label="Title" />
          <select v-model="draft[t.id].freq" class="up-input" aria-label="Repeat">
            <option value="weekly">Weekly</option><option value="daily">Daily</option><option value="monthly">Monthly</option>
          </select>
          <span v-if="draft[t.id].freq === 'weekly'" class="up-wd">
            <label v-for="(w, i) in WEEKDAYS" :key="w"><input type="checkbox" :value="i" v-model="draft[t.id].days" /> {{ w }}</label>
          </span>
          <input v-if="draft[t.id].freq === 'monthly'" v-model.number="draft[t.id].dayOfMonth" type="number" min="1" max="31" class="up-input" aria-label="Day of month" />
          <button type="button" class="up-btn up-btn--primary" @click="saveTemplate(t)">Save</button>
        </div>
      </div>
    </section>

    <section class="up-card">
      <h2 class="up-h">🗓 Scheduled</h2>
      <p v-if="!loading && !groups.length" class="muted">Nothing scheduled after this week.</p>
      <div v-for="g in groups" :key="g.date" class="up-group">
        <h3 class="up-date">{{ formatScheduledDate(g.date, today) }} <span class="muted">· shows from {{ formatScheduledDate(visibleFrom(g.date), today) }}</span></h3>
        <div v-for="e in g.tasks" :key="e.id" class="up-row">
          <div class="up-main"><strong>{{ e.title }}</strong><span v-if="e.templateId" class="muted">repeating</span></div>
          <div class="up-actions">
            <input type="date" class="up-input" :value="e.scheduledDate" :min="today" aria-label="Change date" @change="move(e, $event.target.value)" />
            <button type="button" class="up-btn up-btn--danger" @click="remove(e.id)">Delete</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { localDateStr } from '@/utils/streak';
import { futureOf, groupByDate, formatScheduledDate, isTemplate, describeRecurrence, nextOccurrences, sundayOf, visibleFrom, removeScheduled, rescheduleEntry, WEEKDAYS, isValidDate } from '@/utils/scheduling';
import { loadScheduled, mutateScheduled } from '@/composables/useScheduledTasks';
import { useRouter as _useRouter } from 'vue-router';
import { requirePro } from '@/composables/usePro';
import { loadFeedToken, rotateFeedToken, revokeFeedToken, feedUrls } from '@/composables/useCalendarFeed';

const uid = ref(null);
const feed = ref(null);
const feedBusy = ref(false);
const copied = ref(false);
const _proRouter = _useRouter();
const rotate = async () => { if (!(await requirePro(_proRouter, 'calendarFeed'))) return; feedBusy.value = true; try { feed.value = feedUrls(await rotateFeedToken(uid.value)); } catch (e) { console.error(e); error.value = 'Could not create the feed link (rules?).'; } feedBusy.value = false; };
const revoke = async () => { if (!confirm('Revoke the calendar link? Subscribed calendars will stop updating.')) return; try { await revokeFeedToken(uid.value); feed.value = null; } catch (e) { console.error(e); error.value = 'Could not revoke.'; } };
const copyFeed = async () => { try { await navigator.clipboard.writeText(feed.value.https); copied.value = true; setTimeout(() => { copied.value = false; }, 1500); } catch (e) { /* select manually */ } };
const list = ref([]);
const loading = ref(true);
const error = ref('');
const editing = ref(null);
const draft = ref({});
const today = localDateStr();
const weekEnd = sundayOf(today);
const weekEndLabel = formatScheduledDate(weekEnd, today);

// Upcoming = one-off entries (and generated recurring instances) due after the current week.
const groups = computed(() => groupByDate(futureOf(list.value, today)));
const templates = computed(() => list.value.filter(isTemplate));

const run = async (fn) => { try { list.value = await mutateScheduled(uid.value, fn); error.value = ''; } catch (e) { console.error(e); error.value = 'Could not save (permissions?).'; } };
const remove = (id) => { if (confirm('Delete this scheduled task?')) run((l) => removeScheduled(l, id)); };
const move = (e, date) => { if (isValidDate(date) && date >= today) run((l) => rescheduleEntry(l, e.id, date, e.scheduledTime || '')); };
const stopTemplate = (t) => run((l) => l.map((x) => (x.id === t.id ? { ...x, stopped: true } : x)));
const saveTemplate = (t) => {
  const d = draft.value[t.id];
  const r = { freq: d.freq };
  if (d.freq === 'weekly') r.days = [...new Set(d.days.map(Number))].sort();
  if (d.freq === 'weekly' && !r.days.length) { error.value = 'Pick at least one weekday.'; return; }
  if (d.freq === 'monthly') r.dayOfMonth = Math.min(31, Math.max(1, Number(d.dayOfMonth) || 1));
  // Already-generated instances keep their own state; changes apply to future occurrences.
  run((l) => l.map((x) => (x.id === t.id ? { ...x, title: d.title.trim() || x.title, recurrence: r, stopped: false } : x)));
  editing.value = null;
};

onMounted(() => onAuthStateChanged(auth, async (u) => {
  uid.value = u ? u.uid : null;
  if (!uid.value) return;
  try {
    list.value = await loadScheduled(uid.value);
    loadFeedToken(uid.value).then((t) => { feed.value = feedUrls(t); }).catch(() => {});
    draft.value = Object.fromEntries(list.value.filter(isTemplate).map((t) => [t.id, { title: t.title, freq: t.recurrence.freq, days: [...(t.recurrence.days || [])], dayOfMonth: t.recurrence.dayOfMonth || 1 }]));
  } catch (e) { console.error(e); error.value = 'Scheduled tasks could not be loaded.'; }
  loading.value = false;
}));
</script>

<style scoped>
.up-page { max-width: 640px; margin: 0 auto; padding: 16px; }
.up-head { display: flex; align-items: center; gap: 12px; }
.up-head h1 { font-size: 1.4rem; font-weight: 700; margin: 0; }
.up-back { color: var(--c-text-3, #64748b); text-decoration: none; }
.up-card { margin-top: 12px; padding: 14px; border-radius: 12px; background: var(--c-surface, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.up-h { font-size: 1.05rem; font-weight: 700; margin: 0 0 8px; }
.up-date { font-size: .95rem; font-weight: 700; margin: 10px 0 4px; }
.up-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--c-border, #e2e8f0); }
.up-main { display: flex; flex-direction: column; }
.up-actions { display: flex; gap: 6px; align-items: center; }
.up-edit { width: 100%; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.up-wd { display: flex; gap: 6px; font-size: .8rem; }
.up-input { border: 1px solid var(--c-border, #e2e8f0); border-radius: 6px; padding: 2px 6px; }
.up-btn { padding: 3px 10px; border-radius: 6px; border: 1px solid var(--c-border, #e2e8f0); font-size: .85rem; }
.up-btn--primary { background: var(--c-primary, #6366f1); color: #fff; border-color: transparent; }
.up-btn--danger { color: #b91c1c; border-color: #fca5a5; }
.up-error { color: #b91c1c; }
.up-feed { width: 100%; margin: 6px 0; font-size: .8rem; }
.muted { color: var(--c-text-3, #64748b); font-size: .85rem; }
</style>
