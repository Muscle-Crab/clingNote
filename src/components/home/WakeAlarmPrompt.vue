<template>
  <section v-if="visible" class="wa-card" data-test="wake-alarm-prompt" role="region" aria-label="Wake-up alarm">
    <template v-if="!answeredYes || editing">
      <div class="wa-head"><span class="wa-ico" aria-hidden="true">⏰</span><div><h3 class="wa-h">Want a wake-up alarm?</h3><p class="wa-sub">{{ dayLabel }} · {{ wake.alarmKit ? 'rings even on silent' : 'keep the ringer on to hear it' }}</p></div></div>
      <div class="wa-row">
        <input v-model="time" type="time" class="wa-time" aria-label="Alarm time" data-test="wake-prompt-time-input" />
        <button type="button" class="wa-yes" :disabled="busy || !time" data-test="wake-prompt-set" @click="yes">Set alarm</button>
        <button type="button" class="wa-no" :disabled="busy" data-test="wake-prompt-skip" @click="no">Not today</button>
      </div>
      <p v-if="error" class="wa-err" role="alert">{{ error }}</p>
    </template>
    <template v-else>
      <div class="wa-head"><span class="wa-ico" aria-hidden="true">⏰</span><div><h3 class="wa-h" data-test="wake-prompt-done">Alarm set for {{ fmt12(scheduledTime) }}</h3>
        <p class="wa-sub">{{ dayLabel }}<template v-if="fallback"> · as notifications: keep the ringer on to hear it</template></p></div></div>
      <div class="wa-row"><button type="button" class="wa-no" :disabled="busy" @click="edit">Change</button><button type="button" class="wa-no" :disabled="busy" data-test="wake-prompt-cancel" @click="cancel">Cancel alarm</button></div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { wake, wakeSupported, acceptWake, declineWake, cancelWakeAlarm } from '@/composables/useWakeAlarm';
import { currentQuestion, fmt12, dateKey } from '@/utils/wakeAlarm';

const now = ref(new Date()); let tick = null;
onMounted(() => { tick = setInterval(() => { now.value = new Date(); }, 30000); });
onBeforeUnmount(() => { if (tick) clearInterval(tick); });

const q = computed(() => (wakeSupported() && wake.value.loaded ? currentQuestion(wake.value, now.value) : null));
const choice = computed(() => (q.value && wake.value.choice && wake.value.choice.date === q.value.date ? wake.value.choice.choice : ''));
const answeredYes = computed(() => choice.value === 'yes');
const visible = computed(() => !!q.value && choice.value !== 'no');
const scheduledTime = computed(() => (wake.value.scheduled && wake.value.scheduled.time) || wake.value.choice?.time || wake.value.time);
const fallback = computed(() => !!wake.value.scheduled && wake.value.scheduled.kind === 'notif');
const dayLabel = computed(() => {
  if (!q.value) return '';
  const t = new Date(now.value); t.setDate(t.getDate() + 1);
  if (q.value.date === dateKey(now.value)) return 'This morning';
  if (q.value.date === dateKey(t)) return 'Tomorrow morning';
  return q.value.alarmAt.toLocaleDateString(undefined, { weekday: 'long' });
});

const time = ref(wake.value.time); const editing = ref(false); const busy = ref(false); const error = ref('');
watch(() => wake.value.time, (t) => { if (!editing.value) time.value = t; });
const yes = async () => {
  busy.value = true; error.value = '';
  try { const r = await acceptWake(time.value); if (!r.ok) error.value = 'Could not set the alarm. Allow Alarms and Notifications for ClingNote in iOS Settings.'; else editing.value = false; } catch (e) { error.value = 'Could not set the alarm.'; }
  busy.value = false;
};
const no = async () => { busy.value = true; try { await declineWake(); } catch (e) { /* ignore */ } busy.value = false; };
const edit = () => { time.value = scheduledTime.value; editing.value = true; };
const cancel = async () => { busy.value = true; try { await cancelWakeAlarm(); } catch (e) { /* ignore */ } busy.value = false; };
</script>

<style scoped>
.wa-card { margin: 10px 0; padding: 14px 16px; border-radius: 16px; background: var(--c-surface, #17191d); border: 1px solid var(--c-border, #2a2a2e); color: var(--c-text, #fff); }
.wa-head { display: flex; gap: 12px; align-items: center; }
.wa-ico { font-size: 26px; }
.wa-h { margin: 0; font-size: 16px; font-weight: 700; }
.wa-sub { margin: 2px 0 0; font-size: 13px; color: var(--c-text-3, #9aa3b5); }
.wa-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.wa-time { min-height: 44px; padding: 0 10px; border-radius: 12px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-size: 16px; }
.wa-yes, .wa-no { min-height: 44px; padding: 0 16px; border-radius: 12px; font-weight: 700; font-size: 15px; border: 1px solid transparent; cursor: pointer; }
.wa-yes { background: #4aa8ff; color: #06121f; }
.wa-no { background: transparent; border-color: var(--c-border, #2a2a2e); color: inherit; }
.wa-yes:disabled, .wa-no:disabled { opacity: .5; }
.wa-err { margin: 8px 0 0; font-size: 13px; color: #ff8a8a; }
</style>
