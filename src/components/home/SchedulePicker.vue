<template>
  <div class="sp" data-test="schedule-picker">
    <label class="sp-switch-row">
      <span class="sp-label">Schedule</span>
      <button type="button" role="switch" :aria-checked="String(!!model.on)" class="sp-switch" :class="{ on: model.on }" data-test="schedule-switch" @click="toggle"><span class="sp-knob" /></button>
    </label>
    <template v-if="model.on">
      <div class="sp-grid">
        <input type="date" class="sp-input" v-model="model.date" :min="minDate" aria-label="Date" data-test="sched-date" />
        <input type="time" class="sp-input" v-model="model.time" aria-label="Time (optional)" data-test="sched-time" />
      </div>
      <span class="sp-label">Repeat</span>
      <div class="sp-seg" role="radiogroup" aria-label="Repeat">
        <button v-for="o in OPTS" :key="o.v" type="button" role="radio" :aria-checked="String(model.repeat === o.v)" class="sp-seg-btn" :class="{ on: model.repeat === o.v }" :data-test="'repeat-' + o.v" @click="setRepeat(o.v)">{{ o.l }}</button>
      </div>
      <div v-if="model.repeat === 'weekly'" class="sp-days" role="group" aria-label="Weekdays">
        <button v-for="(w, i) in WEEKDAYS" :key="w" type="button" class="sp-day" :class="{ on: (model.days || []).includes(i) }" :aria-pressed="String((model.days || []).includes(i))" :data-test="'wd-' + i" @click="toggleDay(i)">{{ w.slice(0, 2) }}</button>
      </div>
      <div v-if="model.repeat === 'monthly'" class="sp-row">
        <span class="sp-hint">Day of month</span>
        <input type="number" min="1" max="31" class="sp-input sp-num" v-model.number="model.dayOfMonth" :placeholder="String(dom)" aria-label="Day of month" data-test="sched-dom" />
      </div>
      <div v-if="model.repeat === AFTER" class="sp-row">
        <span class="sp-hint">Every</span>
        <input type="number" min="1" max="365" class="sp-input sp-num" v-model.number="model.everyDays" placeholder="3" aria-label="Days after I finish" data-test="sched-every" />
        <span class="sp-hint">days after I finish</span>
      </div>
      <div v-if="model.repeat !== 'never'" class="sp-row">
        <span class="sp-hint">Remind</span>
        <input type="time" class="sp-input" v-model="model.remindAt" aria-label="Daily reminder time (optional)" data-test="sched-remind" />
      </div>
      <div v-if="model.repeat !== 'never'" class="sp-row">
        <span class="sp-hint">Ends</span>
        <input type="date" class="sp-input" v-model="model.until" :min="model.date" aria-label="End date (optional)" data-test="sched-until" />
      </div>
      <p class="sp-hint">{{ summary }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { WEEKDAYS, describeRecurrence, fmtTime, formatScheduledDate, AFTER } from '@/utils/scheduling';

const model = defineModel({ type: Object, required: true });
const props = defineProps({ minDate: { type: String, default: '' } });
const OPTS = [{ v: 'never', l: 'Never' }, { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }, { v: AFTER, l: 'After done' }];
const dayOf = (s) => (s ? new Date(`${s}T12:00:00`) : new Date());
const dom = computed(() => dayOf(model.value.date).getDate());
const toggle = () => { model.value.on = !model.value.on; if (model.value.on && !model.value.date) model.value.date = props.minDate || new Date().toLocaleDateString('en-CA'); };
const setRepeat = (v) => { model.value.repeat = v; if (v === AFTER && !(Number(model.value.everyDays) >= 1)) model.value.everyDays = 3; if (v === 'weekly' && !(model.value.days || []).length) model.value.days = [dayOf(model.value.date).getDay()]; };
const toggleDay = (i) => { const d = new Set(model.value.days || []); d.has(i) ? d.delete(i) : d.add(i); model.value.days = [...d].sort(); };
const summary = computed(() => {
  const m = model.value; const t = m.time ? ` at ${fmtTime(m.time)}` : '';
  if (m.repeat === 'never') return `Once on ${formatScheduledDate(m.date)}${t}. Shows on that day${m.time ? ' and reminds you' : ''}.`;
  const r = describeRecurrence({ freq: m.repeat, days: m.days, dayOfMonth: m.dayOfMonth || dom.value, everyDays: m.everyDays });
  const rem = m.remindAt ? ` Reminder ${fmtTime(m.remindAt)} each repeat day.` : '';
  if (m.repeat === AFTER) return `${r}${t}, first on ${formatScheduledDate(m.date)}. Next one is set when you finish it.${rem}`;
  return `${r}${t}, from ${formatScheduledDate(m.date)}${m.until ? ` until ${formatScheduledDate(m.until)}` : ''}. Each occurrence is its own task.${rem}`;
});
</script>

<style scoped>
.sp { display: flex; flex-direction: column; gap: .55rem; }
.sp-switch-row { display: flex; align-items: center; justify-content: space-between; }
.sp-label { font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: var(--c-text-2, #a1a09b); }
.sp-switch { width: 42px; height: 24px; border-radius: 999px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #232327); position: relative; cursor: pointer; padding: 0; }
.sp-switch.on { background: var(--c-accent, #2F6FFF); border-color: var(--c-accent, #2F6FFF); }
.sp-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #f4f4f5; transition: transform .15s; }
.sp-switch.on .sp-knob { transform: translateX(18px); background: #fff; }
.sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
.sp-input { width: 100%; box-sizing: border-box; background: var(--c-surface-2, #232327); color: var(--c-text, #ededea); border: 1px solid var(--c-border, #2a2a2e); border-radius: var(--r, 3px); padding: .5rem .6rem; font: inherit; color-scheme: dark; }
.sp-num { width: 5rem; }
.sp-seg { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--c-border, #2a2a2e); border-radius: var(--r, 3px); overflow: hidden; }
.sp-seg-btn { background: transparent; color: var(--c-text-2, #a1a09b); border: 0; border-right: 1px solid var(--c-border, #2a2a2e); padding: .45rem 0; font: inherit; font-size: .74rem; white-space: nowrap; cursor: pointer; }
.sp-seg-btn:last-child { border-right: 0; }
.sp-seg-btn.on { background: var(--c-accent, #2F6FFF); color: #fff; font-weight: 600; }
.sp-days { display: flex; gap: .3rem; flex-wrap: wrap; }
.sp-day { width: 2.2rem; height: 2.2rem; border-radius: 50%; border: 1px solid var(--c-border, #2a2a2e); background: transparent; color: var(--c-text-2, #a1a09b); font: inherit; font-size: .75rem; cursor: pointer; }
.sp-day.on { background: var(--c-accent, #2F6FFF); color: #fff; border-color: var(--c-accent, #2F6FFF); }
.sp-row { display: flex; align-items: center; gap: .6rem; }
.sp-row .sp-input:not(.sp-num) { flex: 1; }
.sp-hint { font-size: .75rem; color: var(--c-text-3, #6b6a66); margin: 0; }
</style>
