<template>
  <!-- Plan my day: 1) the user picks a start time AND a number of hours (both required, nothing pre-filled)
       2) the robot lays today's open tasks into that window and shows a preview 3) nothing is saved until Confirm. -->
  <Teleport to="body">
  <div class="dsp" role="dialog" aria-modal="true" aria-labelledby="pds-t" data-test="plan-day" @click.self="$emit('close')">
    <div class="dsp-card">
      <div class="pds-head"><span class="pds-bot"><RobotAvatar :live="step === 'preview'" /></span>
        <h2 id="pds-t">{{ step === 'pick' ? 'Plan my day' : 'Here is your plan' }}</h2></div>
      <template v-if="step === 'pick'">
        <p class="dsp-sub">When do you start, and for how long? I'll fit today's tasks in.</p>
        <label class="pds-field">Start time
          <input v-model="start" type="time" class="pds-input" required data-test="plan-start" aria-label="Start time" />
        </label>
        <label class="pds-field">Hours
          <select v-model="hours" class="pds-input" required data-test="plan-hours" aria-label="Number of hours">
            <option value="" disabled>Choose…</option>
            <option v-for="h in PLAN_HOUR_OPTIONS" :key="h" :value="String(h)">{{ fmtHours(h) }} h</option>
          </select>
        </label>
        <p v-if="pickError" class="dsp-err" role="alert" data-test="plan-error">{{ pickError }}</p>
        <button type="button" class="dsp-btn dsp-btn--primary" :disabled="!start || !hours" data-test="plan-layout" @click="layout">Lay it out</button>
        <button type="button" class="dsp-btn dsp-skip" data-test="plan-cancel" @click="$emit('close')">Cancel</button>
      </template>
      <template v-else>
        <p class="dsp-sub" data-test="plan-window">{{ plan.start }} – {{ plan.end }} · {{ plan.slots.length }} task{{ plan.slots.length === 1 ? '' : 's' }}</p>
        <ol class="pds-list" data-test="plan-preview">
          <li v-for="(x, i) in plan.slots" :key="i" class="pds-row" :class="{ 'pds-row--kept': !x.changed }">
            <span class="pds-time">{{ x.start }}–{{ x.end }}</span><span class="pds-title">{{ x.task.title }}</span><span v-if="!x.changed" class="pds-tag">kept</span>
          </li>
        </ol>
        <p v-if="plan.unplaced.length" class="dsp-err" data-test="plan-unplaced">Didn't fit: {{ plan.unplaced.map((t) => t.title).join(', ') }}. Pick more hours or move them to tomorrow.</p>
        <p v-else-if="plan.spareMin >= 15" class="dsp-fine">{{ plan.spareMin }} min to spare.</p>
        <p class="dsp-fine">Nothing is saved until you confirm. Only start times change.</p>
        <p v-if="error" class="dsp-err" role="alert">{{ error }}</p>
        <div class="dsp-row">
          <button type="button" class="dsp-btn" :disabled="busy" data-test="plan-change" @click="step = 'pick'">Change</button>
          <button type="button" class="dsp-btn dsp-btn--primary" :disabled="busy || !plan.slots.length" data-test="plan-confirm" @click="$emit('confirm', plan)">{{ busy ? 'Saving…' : 'Confirm' }}</button>
        </div>
        <button type="button" class="dsp-btn dsp-skip" :disabled="busy" data-test="plan-cancel-2" @click="$emit('close')">Cancel</button>
      </template>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import RobotAvatar from '@/components/home/RobotAvatar.vue';
import { planDay, PLAN_HOUR_OPTIONS, fmtHours } from '@/utils/dayPlan';

const props = defineProps({ tasks: { type: Array, default: () => [] }, busy: Boolean, error: { type: String, default: '' } });
const emit = defineEmits(['confirm', 'close', 'previewed']);
const step = ref('pick');
const start = ref(''); // never pre-filled: the user always chooses
const hours = ref('');
const pickError = ref('');
const plan = ref(null);
const layout = () => {
  const r = planDay(props.tasks, { start: start.value, hours: hours.value });
  if (!r.ok) { pickError.value = r.error; return; }
  pickError.value = ''; plan.value = r; step.value = 'preview'; emit('previewed', r);
};
</script>

<style scoped>
.dsp { /* teleported to <body>, outside .app-shell: carry the navy theme tokens */ --c-surface: #0C1630; --c-surface-2: #12203F; --c-border: #1A2846; --c-text: #F2F5FC; --c-text-2: #A9B4CC; --c-text-3: #7180A0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: fixed; inset: 0; z-index: 9400; padding-top: max(16px, env(safe-area-inset-top)) !important; display: grid; place-items: center; padding: 16px; background: rgba(4,8,18,.82); backdrop-filter: blur(4px); }
.dsp-card { width: min(380px, 100%); max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; background: var(--c-surface, #16181c); border: 1px solid var(--c-border, #2a2a2e); border-radius: 18px; padding: 20px; color: var(--c-text, #e6e6e6); text-align: center; }
.dsp-card h2 { font-size: 1.15rem; margin: 0; }
.pds-head { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; }
.pds-bot { width: 40px; height: 40px; flex: none; }
.pds-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; font-weight: 600; text-align: left; }
.pds-input { height: 44px; min-width: 140px; font-size: 16px; font-weight: 700; text-align: center; border-radius: 12px; background: var(--c-surface-2, #22252a); color: inherit; border: 1px solid var(--c-border, #2a2a2e); padding: 0 10px; }
.pds-list { list-style: none; margin: 0 0 10px; padding: 0; text-align: left; }
.pds-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--c-surface-2, #22252a); margin-bottom: 6px; }
.pds-row--kept { opacity: .85; }
.pds-time { font-variant-numeric: tabular-nums; font-weight: 700; color: #378ADD; white-space: nowrap; font-size: .9rem; }
.pds-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pds-tag { font-size: .7rem; color: var(--c-text-3, #9aa3b5); border: 1px solid var(--c-border, #2a2a2e); border-radius: 6px; padding: 1px 5px; }
.dsp-sub { margin: 4px 0 12px; color: var(--c-text-2, #b0b0b0); } .dsp-fine { font-size: .8rem; color: var(--c-text-3, #9aa3b5); margin: 0 0 12px; }
.dsp-err { color: #e05a5a; font-size: .85rem; }
.dsp-row { display: flex; gap: 10px; margin-bottom: 6px; } .dsp-row .dsp-btn { flex: 1; }
.dsp-btn { min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-weight: 700; width: 100%; }
.dsp-btn--primary { background: #378ADD; border-color: #378ADD; color: #fff; }
.dsp-btn:disabled { opacity: .5; }
.dsp-skip { background: transparent; border: 0; text-decoration: underline; opacity: .8; margin-top: 6px; }
</style>
