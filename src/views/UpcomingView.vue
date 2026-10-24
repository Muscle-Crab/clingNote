<template>
  <div class="up-page">
    <header class="up-head">
      <router-link to="/home" class="up-back">← Home</router-link>
      <h1>📅 Upcoming</h1>
    </header>
    <p class="muted">Tasks due after this week (through {{ weekEndLabel }}). They show up in your daily list from the Monday of their week.</p>
    <p v-if="error" class="up-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Loading…</p>

    <section class="up-card cal" data-test="calendar">
      <h2 class="up-h">📅 Calendar</h2>
      <div class="cal-nav">
        <button type="button" class="up-btn" :disabled="weekOffset === 0" aria-label="Previous week" data-test="cal-prev" @click="weekOffset--">‹</button>
        <strong class="cal-range" data-test="cal-range">{{ rangeLabel }}</strong>
        <button type="button" class="up-btn" :disabled="weekOffset >= 11" aria-label="Next week" data-test="cal-next" @click="weekOffset++">›</button>
      </div>
      <p v-if="loading" class="muted">Loading…</p>
      <ul v-else class="cal-days">
        <li v-for="d in weekDays" :key="d.date" class="cal-day" :class="{ 'cal-day--today': d.date === today, 'cal-day--empty': !d.items.length }" :data-date="d.date">
          <div class="cal-date"><span class="cal-dow">{{ d.dow }}</span><span class="cal-dom">{{ d.dom }}</span></div>
          <ul class="cal-items">
            <li v-for="it in d.items" :key="it.key" class="cal-item" :class="{ 'cal-item--done': it.done }" data-test="cal-item">
              <span class="cal-state" :aria-label="it.done ? 'Done' : 'Not done'">{{ it.done ? '✓' : '○' }}</span>
              <span class="cal-title">{{ it.title }}</span>
              <span v-if="it.time" class="cal-time">{{ it.time }}</span>
              <span v-if="it.recurring" class="cal-rec" title="Repeats" aria-label="Repeats">🔁</span>
            </li>
            <li v-if="!d.items.length" class="cal-none">Nothing scheduled</li>
          </ul>
        </li>
      </ul>
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
import { futureOf, groupByDate, formatScheduledDate, isTemplate, describeRecurrence, nextOccurrences, sundayOf, addDaysStr, visibleFrom, removeScheduled, rescheduleEntry, WEEKDAYS, isValidDate } from '@/utils/scheduling';
import { loadScheduled, mutateScheduled } from '@/composables/useScheduledTasks';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { agendaForRange, datedFutureOnly, weekStartOf, dowOf } from '@/utils/agenda';

const uid = ref(null);
const list = ref([]);
const dayLists = ref({});
const weekOffset = ref(0);
const loading = ref(true);
const error = ref('');
const editing = ref(null);
const draft = ref({});
const today = localDateStr();
const weekEnd = sundayOf(today);
const weekEndLabel = formatScheduledDate(weekEnd, today);

// Native calendar: tasks by date (scheduled, recurring occurrences, this week's lists) for the selected week.
const weekStart = computed(() => addDaysStr(weekStartOf(today), weekOffset.value * 7));
const weekEndDate = computed(() => addDaysStr(weekStart.value, 6));
const agenda = computed(() => datedFutureOnly(agendaForRange({ scheduled: list.value, dayLists: dayLists.value, today, from: weekStart.value, to: weekEndDate.value }), today)); // dated, future tasks only
const mdLabel = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const rangeLabel = computed(() => `${mdLabel(weekStart.value)} – ${mdLabel(weekEndDate.value)}`);
const weekDays = computed(() => Object.keys(agenda.value).map((date) => ({ date, dow: WEEKDAYS[dowOf(date)], dom: Number(date.slice(8)), items: agenda.value[date] })));

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
    try { const ls = await Promise.all(WEEKDAYS.map((n) => loadDayTasks(uid.value, n))); dayLists.value = Object.fromEntries(WEEKDAYS.map((n, i) => [n, ls[i]])); } catch (e) { console.error(e); }
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
.cal-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.cal-nav .up-btn { min-width: 44px; min-height: 40px; font-size: 1.2rem; }
.cal-days { list-style: none; margin: 0; padding: 0; }
.cal-day { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid var(--c-border, #e2e8f0); }
.cal-day--today .cal-date { color: var(--c-accent, #6366f1); font-weight: 700; }
.cal-day--empty { opacity: .6; }
.cal-date { flex: 0 0 44px; display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.cal-dow { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
.cal-dom { font-size: 1.3rem; font-weight: 700; }
.cal-items { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 0; }
.cal-item { display: flex; align-items: baseline; gap: 6px; padding: 3px 0; font-size: .95rem; }
.cal-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cal-item--done .cal-title { text-decoration: line-through; opacity: .6; }
.cal-state { width: 16px; flex: 0 0 16px; text-align: center; }
.cal-item--done .cal-state { color: #16a34a; }
.cal-time { font-size: .8rem; color: var(--c-text-3, #64748b); }
.cal-none { font-size: .85rem; color: var(--c-text-3, #64748b); padding: 3px 0; }
.muted { color: var(--c-text-3, #64748b); font-size: .85rem; }
</style>
