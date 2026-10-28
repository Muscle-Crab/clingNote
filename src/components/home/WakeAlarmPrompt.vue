<template>
  <!-- one compact row (no card): the daily wake-up question, or the alarm that is set -->
  <section v-if="visible" class="wa" data-test="wake-alarm-prompt" role="region" aria-label="Wake-up alarm">
    <div v-if="!answeredYes || editing" class="wa-row">
      <span class="wa-ico" aria-hidden="true">⏰</span>
      <span class="wa-t" :title="wake.alarmKit ? 'Rings even on silent' : 'Keep the ringer on to hear it'"><b>Alarm</b> {{ shortDay }}?</span>
      <input v-model="time" type="time" class="wa-time" aria-label="Alarm time" data-test="wake-prompt-time-input" />
      <button type="button" class="wa-yes" :disabled="busy || !time" data-test="wake-prompt-set" @click="yes">Set</button>
      <button type="button" class="wa-x" :disabled="busy" data-test="wake-prompt-skip" aria-label="Not today" title="Not today" @click="no">✕</button>
    </div>
    <div v-else class="wa-row">
      <span class="wa-ico" aria-hidden="true">⏰</span>
      <button type="button" class="wa-t wa-link" :disabled="busy" aria-label="Change alarm time" @click="edit"><b data-test="wake-prompt-done">Alarm {{ fmt12(scheduledTime) }}</b> {{ shortDay }}<template v-if="fallback"> · ringer on</template></button>
      <button type="button" class="wa-x" :disabled="busy" data-test="wake-prompt-cancel" aria-label="Cancel alarm" title="Cancel alarm" @click="cancel">✕</button>
    </div>
    <p v-if="error" class="wa-err" role="alert">{{ error }}</p>
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

const shortDay = computed(() => (dayLabel.value === 'Tomorrow morning' ? 'tomorrow' : dayLabel.value === 'This morning' ? 'today' : dayLabel.value ? `on ${dayLabel.value}` : ''));
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
.wa { margin: 0 0 6px; }
.wa-row { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 2px; font-size: .82rem; color: var(--c-text-2, #a1a09b); }
.wa-ico { font-size: .95rem; }
.wa-t { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-t b { color: var(--c-text, #ecebe8); font-weight: 700; }
.wa-link { background: none; border: 0; padding: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; min-height: 40px; }
.wa-time { width: 120px; flex: 0 0 auto; height: 32px; padding: 0 4px; border-radius: 10px; border: 1px solid var(--c-border, #2a2a2e); background: none; color: var(--c-text, #ecebe8); font: inherit; font-size: .82rem; }
.wa-yes { flex: 0 0 auto; height: 32px; padding: 0 12px; border-radius: 10px; border: 0; background: var(--c-accent, #4aa8ff); color: #fff; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
.wa-x { width: 32px; height: 40px; flex: 0 0 auto; border: 0; background: none; color: var(--c-text-3, #6b6a66); font-size: .9rem; cursor: pointer; }
.wa-yes:disabled, .wa-x:disabled, .wa-link:disabled { opacity: .5; }
.wa-err { margin: 2px 0 0; font-size: .78rem; color: var(--c-danger, #ff8a8a); }
</style>
