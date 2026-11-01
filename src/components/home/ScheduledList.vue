<template>
  <section class="sched" :class="{ 'sched--empty': !count && !error }">
    <button type="button" class="sched-toggle" :aria-expanded="open ? 'true' : 'false'" @click="open = !open">
      <i class="fas fa-calendar-alt sched-ico"></i>
      <span class="sched-label">Scheduled</span>
      <span class="sched-count">{{ count }}</span>
      <span v-if="!count && !error && !open" class="sched-hint" data-test="sched-empty-hint">Nothing scheduled</span>
      <i class="fas sched-chev" :class="open ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
    </button>
    <div v-if="open" class="sched-body">
      <p v-if="error" class="sched-empty sched-error" role="alert">{{ error }}</p>
      <p v-else-if="!groups.length && !series.length" class="sched-empty">Nothing scheduled. Turn on “Schedule” when adding a task.</p>
      <div v-if="series.length" class="sched-group" data-test="series-list">
        <h3 class="sched-date">Repeating</h3>
        <div v-for="t in series" :key="t.id" class="sched-row">
          <div class="sched-main">
            <span class="sched-title">{{ t.title }}</span>
            <span class="sched-time" data-test="sched-label">{{ scheduleLabel(t) }}<template v-if="t.recurrence.until"> · until {{ formatScheduledDate(t.recurrence.until) }}</template></span>
          </div>
          <button type="button" class="sched-more" aria-label="Repeating task actions" @click="toggleMenu(t)"><i class="fas fa-ellipsis-h"></i></button>
          <div v-if="menuId === t.id" class="sched-menu">
            <SchedulePicker v-model="edit" />
            <div class="sched-edit"><button type="button" class="sched-btn sched-btn--primary" data-test="save-series" @click="saveEdit(t, 'future')">Save all future</button></div>
            <button type="button" class="sched-btn sched-btn--danger" @click="$emit('delete', t.id); menuId = null">Delete series</button>
          </div>
        </div>
      </div>
      <div v-for="g in groups" :key="g.date" class="sched-group">
        <h3 class="sched-date">{{ formatScheduledDate(g.date, todayStr) }}</h3>
        <div v-for="t in g.tasks" :key="t.id" class="sched-row">
          <div class="sched-main">
            <span class="sched-title">{{ t.title }}</span>
            <span v-if="t.scheduledTime" class="sched-time">{{ formatClock(toMinutes(t.scheduledTime)) }}</span>
            <span v-if="t.templateId" class="sched-time" data-test="sched-label">🔁 {{ t.repeatText || 'Repeats' }}</span>
          </div>
          <button type="button" class="sched-more" aria-label="Scheduled task actions" title="Actions" :aria-expanded="menuId === t.id ? 'true' : 'false'" @click="toggleMenu(t)">
            <i class="fas fa-ellipsis-h"></i>
          </button>
          <div v-if="menuId === t.id" class="sched-menu">
            <SchedulePicker v-model="edit" :min-date="minDate" />
            <div class="sched-edit">
              <template v-if="t.templateId">
                <button type="button" class="sched-btn sched-btn--primary" data-test="save-this" @click="saveEdit(t, 'this')">Save this one</button>
                <button type="button" class="sched-btn sched-btn--primary" data-test="save-future" @click="saveEdit(t, 'future')">Save all future</button>
              </template>
              <button v-else type="button" class="sched-btn sched-btn--primary" data-test="save-sched" @click="saveEdit(t, 'future')">Save</button>
            </div>
            <button type="button" class="sched-btn" @click="$emit('move-today', t.id); menuId = null">Move to today</button>
            <button type="button" class="sched-btn sched-btn--danger" @click="$emit('delete', t.id); menuId = null">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import { groupByDate, formatScheduledDate, scheduleLabel } from '@/utils/scheduling';
import { scheduleOfEntry } from '@/utils/schedEdit';
import SchedulePicker from './SchedulePicker.vue';
import { formatClock, toMinutes } from '@/utils/taskPlanning';

const props = defineProps({
  tasks: { type: Array, default: () => [] }, // already filtered/sorted future entries
  todayStr: { type: String, default: '' },
  error: { type: String, default: '' },
  series: { type: Array, default: () => [] }, // recurring templates
});
const emit = defineEmits(['move-today', 'update', 'delete', 'edit']);
const edit = ref(scheduleOfEntry(null));
const saveEdit = (t, scope) => { emit('edit', { id: t.id, sched: { ...edit.value }, scope }); menuId.value = null; };

const open = ref(false);
const menuId = ref(null);
const editDate = ref('');
const editTime = ref('');
const count = computed(() => props.tasks.length + props.series.length);
const groups = computed(() => groupByDate(props.tasks));
const minDate = computed(() => props.todayStr);

const toggleMenu = (t) => {
  if (menuId.value === t.id) { menuId.value = null; return; }
  menuId.value = t.id; editDate.value = t.scheduledDate; editTime.value = t.scheduledTime || ''; edit.value = scheduleOfEntry(t);
};
</script>

<style scoped>
.sched { margin-top: var(--sp-2); }
.sched-toggle { display: flex; align-items: center; gap: var(--sp-2); width: 100%; min-height: 44px; padding: 0 var(--sp-1); background: none; border: none; color: var(--c-text-2); cursor: pointer; font-size: var(--fs-md); text-align: left; border-radius: var(--r); }
.sched-toggle:hover { color: var(--c-text); }
.sched-label { flex: 0 0 auto; font-weight: 500; }
.sched-count { font-family: 'JetBrains Mono', monospace; font-size: var(--fs-xs); font-weight: 700; background: var(--c-accent-soft); color: var(--c-accent-text); padding: 1px 8px; border-radius: var(--r-pill); }
.sched-chev { margin-left: auto; font-size: var(--fs-sm); }
.sched-hint { margin-left: auto; font-size: var(--fs-xs); color: var(--c-text-3); }
.sched-hint + .sched-chev { margin-left: 6px; }
.sched--empty .sched-toggle { min-height: 40px; }
.sched-body { padding: var(--sp-1) 0 var(--sp-2); }
.sched-empty { margin: 0; padding: var(--sp-2) var(--sp-1); font-size: var(--fs-sm); color: var(--c-text-3); }
.sched-date { margin: var(--sp-3) 0 var(--sp-1); font-size: var(--fs-xs); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--c-text-3); }
.sched-row { position: relative; display: flex; align-items: center; gap: var(--sp-2); padding: 0 0 0 var(--sp-3); margin-bottom: var(--sp-1); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); }
.sched-main { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: var(--sp-2); padding: var(--sp-2) 0; }
.sched-title { font-weight: 600; font-size: var(--fs-md); word-break: break-word; }
.sched-time { font-family: 'JetBrains Mono', monospace; font-size: var(--fs-xs); color: var(--c-text-3); white-space: nowrap; }
.sched-more { width: 40px; height: 40px; background: none; border: none; color: var(--c-text-2); cursor: pointer; border-radius: var(--r); }
.sched-more:hover { background: var(--c-surface-2); color: var(--c-text); }
.sched-menu { position: absolute; right: var(--sp-2); top: calc(100% - 2px); z-index: 20; min-width: 240px; display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-2); background: var(--c-surface-2); border: 1px solid var(--c-border-strong); border-radius: var(--r-lg); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.sched-edit { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
.sched-input { flex: 1 1 110px; min-height: 40px; box-sizing: border-box; background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r); color: var(--c-text); padding: 0 var(--sp-2); font: inherit; color-scheme: dark; }
.sched-btn { min-height: 40px; padding: 0 var(--sp-3); text-align: left; background: none; border: 1px solid transparent; border-radius: var(--r); color: var(--c-text); font: inherit; cursor: pointer; }
.sched-btn:hover { background: var(--c-border); }
.sched-btn:disabled { opacity: .5; cursor: default; }
.sched-btn--primary { flex: 1 0 100%; background: var(--c-accent); color: var(--c-on-accent); text-align: center; font-weight: 600; }
.sched-btn--primary:hover { background: var(--c-accent-hover); }
.sched-btn--danger { color: var(--c-danger-text); }
.sched-error { color: var(--c-danger-text); }
</style>
