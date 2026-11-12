<template>
  <!-- Session flow: 1) pick the session length (5..12 whole hours) 2) pick the apps to lock (seeded with the last session's apps) and Begin:
       the shield goes up at once. The AI sets the session's points goal at Begin (frozen on the session). -->
  <div class="dsp" role="dialog" aria-modal="true" aria-labelledby="dsp-t" data-test="day-prompt">
    <div class="dsp-card">
      <template v-if="step === 'pick'">
        <h2 id="dsp-t">How many hours will you dedicate today?</h2>
        <div class="dsp-pick">
          <button type="button" class="dsp-step" :disabled="idx <= 0" aria-label="One hour less" data-test="day-prompt-minus" @click="idx--">−</button>
          <select v-model.number="hours" class="dsp-sel" aria-label="Hours today" data-test="day-prompt-hours">
            <option v-for="h in SESSION_HOUR_OPTIONS" :key="h" :value="h">{{ h }} h</option>
          </select>
          <button type="button" class="dsp-step" :disabled="idx >= SESSION_HOUR_OPTIONS.length - 1" aria-label="One hour more" data-test="day-prompt-plus" @click="idx++">+</button>
        </div>
        <p class="dsp-sub">Ends around <b data-test="day-prompt-preview">{{ endLabel }}</b> if you start now.</p>
        <!-- Evening mode (split day): one compact row; tapping reveals a later block inline. The gap in between stays open. -->
        <button v-if="!split.on" type="button" class="dsp-split" data-test="day-prompt-split" @click="split.on = true">+ Split: add a later block</button>
        <div v-else class="dsp-later" data-test="day-prompt-later">
          <span>Later</span>
          <input v-model="split.time" type="time" required aria-label="Later block start" data-test="day-prompt-later-time">
          <select v-model.number="split.hours" aria-label="Later block hours" data-test="day-prompt-later-hours"><option v-for="h in BLOCK_HOUR_OPTIONS" :key="h" :value="h">{{ hoursLabel(h) }}h</option></select>
          <button type="button" class="dsp-x" aria-label="Remove later block" data-test="day-prompt-later-x" @click="split.on = false">✕</button>
        </div>
        <p v-if="tasks.length" class="dsp-sub" data-test="day-prompt-target">Session goal: about <b>{{ goalPreview }} pts</b>, set when you Begin <span class="dsp-of">({{ countable }} tasks)</span></p>
        <slot name="checkin" />
        <button type="button" class="dsp-btn dsp-btn--primary" data-test="day-prompt-next" @click="next">Continue</button>
        <button type="button" class="dsp-btn dsp-skip" data-test="day-prompt-skip-pick" @click="$emit('skip')">Skip lock-in today</button>
      </template>
      <template v-else>
        <h2 id="dsp-t">Are you sure?</h2>
        <p class="dsp-sub" data-test="day-prompt-confirm-text">Your day will end at <b data-test="day-prompt-end">{{ endLabel }}</b> and the app shuts down then.</p>
        <p v-if="tasks.length" class="dsp-sub" data-test="day-prompt-target-confirm">Apps unlock at about <b>{{ goalPreview }} pts</b> earned this session.</p>
        <p v-if="laterLabel" class="dsp-sub" data-test="day-prompt-later-text">Then again <b>{{ laterLabel }}</b>. Open in between.</p>
        <p class="dsp-fine">{{ hoursLabel(hours) }} hours, starting when you confirm. {{ laterLabel ? 'Blocks can\'t be shortened or removed today.' : 'This can\'t be changed today.' }}</p>
        <label v-if="canLock" class="dsp-fine dsp-lock" data-test="day-prompt-lock"><input v-model="lockApps" type="checkbox" /> <span class="dsp-lock-txt">🔒 Lock <b data-test="day-prompt-apps">{{ appsLabel(apps) }}</b> until the goal · <a href="#" class="dsp-edit" data-test="day-prompt-apps-edit" @click.prevent="$emit('pick-apps')">Edit</a></span></label>
        <p v-if="error" class="dsp-err" role="alert" data-test="day-prompt-error">{{ error }}</p>
        <div class="dsp-row">
          <button type="button" class="dsp-btn" :disabled="busy" data-test="day-prompt-change" @click="step = 'pick'">Change</button>
          <button type="button" class="dsp-btn dsp-btn--primary" :disabled="busy" data-test="day-prompt-confirm" @click="$emit('confirm', hours, { lock: canLock && lockApps, blocks: laterBlocks })">{{ busy ? 'Starting…' : 'Begin' }}</button>
          <button type="button" class="dsp-btn dsp-skip" :disabled="busy" data-test="day-prompt-skip" @click="$emit('skip')">Skip lock-in today</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onBeforeUnmount } from 'vue';
import { SESSION_HOUR_OPTIONS, BLOCK_HOUR_OPTIONS, hoursLabel, hoursMs, fmtClock, nextAt } from '@/utils/eightHour';
import core from '../../../netlify/functions/lib/eightHourCore.js';
import { appsLabel } from '@/utils/sessionApps';
import { taskPoints } from '@/utils/sessionGoal';

const props = defineProps({
  canLock: { type: Boolean, default: false }, /* iOS app lock available: offer the hard lock at day start */ initialHours: { type: Number, default: 8 }, nowMs: { type: Function, default: () => Date.now() }, tz: { type: String, default: '' }, busy: Boolean, error: { type: String, default: '' }, tasks: { type: Array, default: () => [] }, stats: { type: Object, default: () => ({}) }, earned: { type: Number, default: 0 }, apps: { type: Object, default: null } /* this session's picked app counts */ });
const emit = defineEmits(['confirm', 'skip', 'pick-apps']);
const lockApps = ref(true);
const step = ref('pick');
const seedH = Math.round(Number(props.initialHours)); const hours = ref(core.validSessionHours(seedH) ? seedH : 8);
const idx = computed({ get: () => Math.max(0, SESSION_HOUR_OPTIONS.indexOf(hours.value)), set: (i) => { hours.value = SESSION_HOUR_OPTIONS[Math.min(SESSION_HOUR_OPTIONS.length - 1, Math.max(0, i))]; } });
// Same number the server freezes when AI is off: fallback, then the 8 × average-of-unfinished floor.
const listed = computed(() => (props.tasks || []).filter((t) => t && t.title && t.status !== 'pending' && t.status !== 'wontdo' && !t.scheduledFuture && t.removed !== true));
const openRows = computed(() => listed.value.filter((t) => !t.completed));
const countable = computed(() => openRows.value.length);
const goalPreview = computed(() => {
  const pts = openRows.value.map((t) => Number(taskPoints(t)) || 0);
  const total = pts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return core.flooredGoal(core.fallbackGoal({ tasksBefore: listed.value.length, hours: hours.value, totalPoints: total }), pts, total);
});
// Step 2: on iOS the app picker opens (seeded with the last session's apps); the user keeps or edits it, then Begins.
const next = () => { step.value = 'confirm'; if (props.canLock) emit('pick-apps'); };
const tick = ref(0); const tickId = setInterval(() => { tick.value++; }, 15000); onBeforeUnmount(() => clearInterval(tickId));
const split = reactive({ on: false, time: '19:00', hours: 3 });
const laterBlocks = computed(() => (split.on && split.time ? [{ time: split.time, hours: split.hours }] : []));
const laterLabel = computed(() => { if (!laterBlocks.value.length) return ''; void tick.value; const tz = props.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const s = nextAt(split.time, tz, props.nowMs() + hoursMs(hours.value) - 1); return s ? `${fmtClock(s, tz)}–${fmtClock(s + split.hours * 3600000, tz)}` : ''; });
const endLabel = computed(() => { void tick.value; const tz = props.tz || Intl.DateTimeFormat().resolvedOptions().timeZone; return fmtClock(props.nowMs() + hoursMs(hours.value), tz); });
</script>

<style scoped>
.dsp { position: fixed; inset: 0; z-index: 9400; display: grid; place-items: center; padding: 16px; background: rgba(4,8,18,.82); backdrop-filter: blur(4px); }
.dsp-card { width: min(360px, 100%); background: var(--c-surface, #16181c); border: 1px solid var(--c-border, #2a2a2e); border-radius: 18px; padding: 20px; color: var(--c-text, #e6e6e6); text-align: center; }
.dsp-card h2 { font-size: 1.15rem; margin: 0 0 14px; }
.dsp-pick { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 6px 0 10px; }
.dsp-step { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-size: 20px; }
.dsp-sel { height: 44px; min-width: 110px; font-size: 1.2rem; font-weight: 700; text-align: center; border-radius: 12px; background: var(--c-surface-2, #22252a); color: inherit; border: 1px solid var(--c-border, #2a2a2e); }
.dsp-sub { margin: 4px 0 12px; color: var(--c-text-2, #b0b0b0); } .dsp-fine { font-size: .8rem; color: var(--c-text-3, #9aa3b5); margin: 0 0 12px; }
.dsp-err { color: #e05a5a; font-size: .85rem; }
.dsp-row { display: flex; gap: 10px; } .dsp-row .dsp-btn { flex: 1; }
.dsp-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-weight: 700; width: 100%; }
.dsp-btn--primary { background: #378ADD; border-color: #378ADD; color: #fff; }
.dsp-skip { flex-basis: 100%; background: transparent; border: 0; text-decoration: underline; opacity: .8; }
.dsp-split { background: none; border: 0; color: #9fb7e0; font-weight: 600; font-size: .9rem; min-height: 40px; margin: -6px 0 8px; cursor: pointer; }
.dsp-later { display: flex; align-items: center; justify-content: center; gap: 8px; margin: -4px 0 12px; font-size: .9rem; color: var(--c-text-2, #b0b0b0); }
.dsp-later input, .dsp-later select { height: 38px; border-radius: 10px; background: var(--c-surface-2, #22252a); color: inherit; border: 1px solid var(--c-border, #2a2a2e); padding: 0 8px; font-weight: 600; color-scheme: dark; }
.dsp-x { width: 36px; height: 38px; border: 0; background: none; color: inherit; opacity: .7; cursor: pointer; }
.dsp-lock { display: flex; gap: .5rem; align-items: center; font-size: 17px; min-height: 44px; cursor: pointer; }
.dsp-lock-txt { flex: 1; text-align: left; }
.dsp-edit { color: var(--c-accent, #4ea1ff); font-weight: 600; text-decoration: underline; padding: 8px 2px; }
</style>
