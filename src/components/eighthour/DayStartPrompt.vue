<template>
  <!-- Morning flow: 1) pick today's hours (3..12h, half hours) 2) "Are you sure?" with the exact end time. The countdown starts ONLY on Confirm. -->
  <div class="dsp" role="dialog" aria-modal="true" aria-labelledby="dsp-t" data-test="day-prompt">
    <div class="dsp-card">
      <template v-if="step === 'pick'">
        <h2 id="dsp-t">How many hours will you dedicate today?</h2>
        <div class="dsp-pick">
          <button type="button" class="dsp-step" :disabled="idx <= 0" aria-label="Half an hour less" data-test="day-prompt-minus" @click="idx--">−</button>
          <select v-model.number="hours" class="dsp-sel" aria-label="Hours today" data-test="day-prompt-hours">
            <option v-for="h in HOUR_OPTIONS" :key="h" :value="h">{{ hoursLabel(h) }} h</option>
          </select>
          <button type="button" class="dsp-step" :disabled="idx >= HOUR_OPTIONS.length - 1" aria-label="Half an hour more" data-test="day-prompt-plus" @click="idx++">+</button>
        </div>
        <p class="dsp-sub">Ends around <b data-test="day-prompt-preview">{{ endLabel }}</b> if you start now.</p>
        <p v-if="target.total" class="dsp-sub" data-test="day-prompt-target">Boss target: <b>{{ dayPtsLabel(earned, target.target) }}</b> <span class="dsp-of">({{ target.total }} available)</span></p>
        <button type="button" class="dsp-btn dsp-btn--primary" data-test="day-prompt-next" @click="step = 'confirm'">Continue</button>
        <button type="button" class="dsp-btn dsp-skip" data-test="day-prompt-skip-pick" @click="$emit('skip')">Skip lock-in today</button>
      </template>
      <template v-else>
        <h2 id="dsp-t">Are you sure?</h2>
        <p class="dsp-sub" data-test="day-prompt-confirm-text">Your day will end at <b data-test="day-prompt-end">{{ endLabel }}</b> and the app shuts down then.</p>
        <p v-if="target.total" class="dsp-sub" data-test="day-prompt-target-confirm">You need <b>{{ dayPtsLabel(earned, target.target) }}</b> today.</p>
        <p class="dsp-fine">{{ hoursLabel(hours) }} hours, starting when you confirm. This can't be changed today.</p>
        <p v-if="error" class="dsp-err" role="alert" data-test="day-prompt-error">{{ error }}</p>
        <div class="dsp-row">
          <button type="button" class="dsp-btn" :disabled="busy" data-test="day-prompt-change" @click="step = 'pick'">Change</button>
          <button type="button" class="dsp-btn dsp-btn--primary" :disabled="busy" data-test="day-prompt-confirm" @click="$emit('confirm', hours)">{{ busy ? 'Starting…' : 'Confirm' }}</button>
          <button type="button" class="dsp-btn dsp-skip" :disabled="busy" data-test="day-prompt-skip" @click="$emit('skip')">Skip lock-in today</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount } from 'vue';
import { HOUR_OPTIONS, hoursLabel, clampHours, hoursMs, fmtClock } from '@/utils/eightHour';
import { previewDayTarget, dayPtsLabel } from '@/utils/dayTarget';

const props = defineProps({ initialHours: { type: Number, default: 8 }, nowMs: { type: Function, default: () => Date.now() }, tz: { type: String, default: '' }, busy: Boolean, error: { type: String, default: '' }, tasks: { type: Array, default: () => [] }, stats: { type: Object, default: () => ({}) }, earned: { type: Number, default: 0 } });
defineEmits(['confirm', 'skip']);
const step = ref('pick');
const hours = ref(clampHours(props.initialHours));
const idx = computed({ get: () => Math.max(0, HOUR_OPTIONS.indexOf(hours.value)), set: (i) => { hours.value = HOUR_OPTIONS[Math.min(HOUR_OPTIONS.length - 1, Math.max(0, i))]; } });
const target = computed(() => previewDayTarget(props.tasks, hours.value, props.stats)); // recomputed as the user changes hours or tasks
const tick = ref(0); const tickId = setInterval(() => { tick.value++; }, 15000); onBeforeUnmount(() => clearInterval(tickId));
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
</style>
