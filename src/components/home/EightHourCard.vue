<template>
  <section class="eh" :class="'eh--' + view" data-test="eight-hour-card" aria-label="Your 8-hour day">
    <!-- loading / offline -->
    <p v-if="view === 'loading'" class="eh-muted" data-test="eh-loading">Loading your 8-hour day…</p>
    <div v-else-if="view === 'error'" class="eh-line"><p class="eh-muted">Couldn't reach your 8-hour day<span v-if="eh.st.error"> ({{ eh.st.error }})</span>.</p><button class="eh-btn" @click="$emit('retry')">Retry</button></div>

    <p v-if="view !== 'error' && view !== 'loading' && eh.st.data && eh.st.data.offline" class="eh-muted" data-test="eh-offline">Offline mode: the countdown lock starts once the server is reachable. <button class="eh-btn" @click="$emit('retry')">Retry</button></p>
    <!-- no plan yet: one compact row (wake time + task count), then it is locked when the day starts -->
    <template v-else-if="view === 'setup'">
      <div class="eh-line"><b class="eh-title">⏱ Set your 8-hour day</b><button class="eh-btn eh-btn--primary" :disabled="busy || !wake" @click="save" data-test="eh-save">Lock in</button></div>
      <div class="eh-ctrl">
        <label class="eh-mini">Wake <input type="time" v-model="wake" data-test="eh-wake" /></label>
        <span class="eh-mini">Tasks <span class="eh-stepper"><button type="button" :disabled="count <= 1" @click="count--" aria-label="Fewer tasks">−</button><strong data-test="eh-count">{{ count }}</strong><button type="button" :disabled="count >= max" @click="count++" aria-label="More tasks">+</button></span></span>
      </div>
      <p v-if="msg" class="eh-err" role="alert">{{ msg }}</p>
    </template>

    <!-- planned: waiting for the wake time (or for the tasks) -->
    <template v-else-if="view === 'planned'">
      <div class="eh-line">
        <p class="eh-big" data-test="eh-starts">{{ phase === 'before' ? 'Starts ' + fmtWake : 'Ready' }}<small> · Ends {{ ends }}</small></p>
        <button v-if="phase === 'ready' && taskTotal === plan.taskCount && taskTotal > 0" class="eh-btn eh-btn--primary" data-test="eh-start" @click="$emit('start')">Start</button>
        <span v-else class="eh-badge">Not started</span>
      </div>
      <p class="eh-muted" v-if="phase === 'ready' && needMore <= 0" data-test="eh-all-added">All {{ plan.taskCount }} task{{ plan.taskCount === 1 ? '' : 's' }} added.</p>
      <p class="eh-muted" v-else-if="phase === 'ready'" data-test="eh-needs-tasks">Add {{ needMore }} more task{{ needMore === 1 ? '' : 's' }} to start the countdown ({{ taskTotal }}/{{ plan.taskCount }}).</p>
      <p class="eh-muted" v-else>Add {{ plan.taskCount }} task{{ plan.taskCount === 1 ? '' : 's' }} ({{ taskTotal }}/{{ plan.taskCount }}). Countdown starts at wake time.</p>
      <div class="eh-ctrl">
        <label class="eh-mini" v-if="phase === 'before'">Wake <input type="time" v-model="wake" data-test="eh-wake" /></label>
        <button v-if="phase === 'before' && wake !== plan.wakeTime" class="eh-btn" :disabled="busy" @click="save">Save</button>
        <span class="eh-mini">Tasks <span class="eh-stepper"><button type="button" :disabled="busy || count <= 1" @click="count--; save()" aria-label="Fewer tasks">−</button><strong data-test="eh-count">{{ count }}</strong><button type="button" :disabled="busy || count >= max" @click="count++; save()" aria-label="More tasks">+</button></span></span>
        <span class="eh-fine">Locked once started</span>
      </div>
      <p v-if="taskTotal > plan.taskCount" class="eh-err" data-test="eh-over" role="alert">You have {{ taskTotal }} tasks but planned {{ plan.taskCount }}. Raise the count to {{ taskTotal }} to start.</p>
      <p v-if="startError" class="eh-err" role="alert">{{ startError }}</p>
      <p v-if="msg" class="eh-err" role="alert">{{ msg }}</p>
    </template>

    <!-- running: the strict, locked day. One slim row: big countdown + times + points (the progress card below shows done/total) -->
    <template v-else-if="view === 'running'">
      <div class="eh-line eh-line--run">
        <span class="eh-lock" data-test="eh-lock" title="Locked: window, tasks, points and target cannot change" aria-label="Locked">🔒</span>
        <p class="eh-clock" data-test="eh-countdown" role="timer">{{ countdown }}</p>
        <div class="eh-meta">
          <span data-test="eh-times">{{ starts }} → <span data-test="eh-ends">Ends {{ ends }}</span></span>
          <span data-test="eh-points">{{ progress.earned }}/{{ lock.target }} pts</span>
        </div>
      </div>
      <p v-if="stats.notice" class="eh-note" data-test="eh-notice">{{ stats.notice }}</p>
    </template>

    <!-- ended -->
    <template v-else-if="view === 'ended'">
      <div class="eh-line">
        <span class="eh-badge" :class="met ? 'eh-badge--ok' : 'eh-badge--miss'" data-test="eh-result">{{ met ? 'Goal met' : 'Goal missed' }}</span>
        <div class="eh-meta eh-meta--end"><span data-test="eh-points">{{ progress.earned }}/{{ lock.target }} pts</span><span>🔥 {{ stats.streak }} day streak</span></div>
      </div>
      <p v-if="met && reward" class="eh-note eh-note--ok" data-test="eh-reward">{{ reward }}</p>
      <p v-if="stats.notice" class="eh-note" data-test="eh-notice">{{ stats.notice }}</p>
      <div class="eh-ctrl"><label class="eh-mini">Tomorrow's wake <input type="time" v-model="wake" /></label><button v-if="wake !== plan.wakeTime" class="eh-btn" :disabled="busy" @click="save">Save</button></div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useEightHour } from '@/composables/useEightHour';
import { MAX_TASKS_PER_DAY, progressOf, countableIndexes, fmtWakeLabel } from '@/utils/eightHour';

// tasks = today's stored task array (all of it; hidden recurring copies are excluded by progressOf/countable logic)
const props = defineProps({ tasks: { type: Array, default: () => [] }, startError: { type: String, default: '' } });
defineEmits(['retry', 'start']);
const eh = useEightHour();
const { phase, plan, lock, stats, reward, countdown } = eh;
const starts = computed(() => eh.startsLabel.value);
const max = MAX_TASKS_PER_DAY;
const wake = ref('07:00'); const count = ref(3); const msg = ref('');
const busy = computed(() => eh.st.busy);
watch(plan, (p) => { if (p) { wake.value = p.wakeTime; count.value = p.taskCount; } }, { immediate: true });

const view = computed(() => {
  if (!eh.st.loaded) return eh.st.error ? 'error' : 'loading';
  if (phase.value === 'none') return 'setup';
  if (phase.value === 'running') return lock.value ? 'running' : 'planned';
  if (phase.value === 'ended') return lock.value ? 'ended' : 'planned';
  return 'planned';
});
const ends = computed(() => eh.endsLabel.value);
const fmtWake = computed(() => (plan.value ? fmtWakeLabel(plan.value.wakeTime) : ''));
const dayKey = computed(() => eh.phaseInfo.value.dayKey || '');
const taskTotal = computed(() => countableIndexes(props.tasks || [], dayKey.value).length);
const needMore = computed(() => Math.max(0, (plan.value?.taskCount || 0) - taskTotal.value));
const progress = computed(() => (lock.value ? progressOf({ dayKey: lock.value.dayKey, points: lock.value.points }, props.tasks) : { earned: 0, done: 0, total: 0 }));
const pct = computed(() => (lock.value && lock.value.target > 0 ? Math.min(100, Math.round((progress.value.earned / lock.value.target) * 100)) : 0));
const met = computed(() => (lock.value ? progress.value.earned >= lock.value.target : false));

const save = async () => {
  msg.value = '';
  try { await eh.savePlan({ wakeTime: wake.value, taskCount: count.value }); } catch (e) { msg.value = e.status === 423 ? 'Locked: your 8-hour day is running.' : (e.message || 'Could not save'); }
};
</script>

<style scoped>
/* Compact strip (replaces the old big card). Sits between the day tabs and the progress card. */
.eh { background: var(--c-surface, #16181c); border: 1px solid var(--c-border, #2a2a2e); border-radius: 14px; padding: 6px 12px; margin: 6px 0; color: var(--c-text, #e6e6e6); }
.eh--running { border-color: rgba(55,138,221,.55); padding: 4px 12px; }
.eh-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 30px; }
.eh-line--run { justify-content: flex-start; gap: 10px; min-height: 40px; }
.eh-title { font-size: .85rem; font-weight: 700; }
.eh-lock { font-size: .9rem; opacity: .85; }
.eh-clock { font-size: 1.75rem; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; margin: 0; letter-spacing: .01em; }
.eh-meta { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; font-size: .68rem; line-height: 1.25; color: var(--c-text-3, #9aa3b5); white-space: nowrap; }
.eh-meta--end { flex-direction: row; gap: 10px; }
.eh-badge { font-size: .65rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--c-surface-2, #22252a); color: var(--c-text-2, #b0b0b0); text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
.eh-badge--ok { background: rgba(60,180,110,.18); color: #3cb46e; }
.eh-badge--miss { background: rgba(224,90,90,.18); color: #e05a5a; }
.eh-big { font-size: .95rem; font-weight: 700; margin: 0; } .eh-big small { font-size: .75rem; font-weight: 500; color: var(--c-text-3, #9aa3b5); }
.eh-muted { color: var(--c-text-3, #9aa3b5); font-size: .72rem; margin: 2px 0; }
.eh-fine { color: var(--c-text-3, #9aa3b5); font-size: .65rem; margin-left: auto; }
.eh-err { color: #e05a5a; font-size: .72rem; margin: 3px 0 0; }
.eh-note { margin: 4px 0 0; font-size: .72rem; padding: 4px 8px; border-radius: 8px; background: rgba(224,160,60,.12); color: #e0a03c; }
.eh-note--ok { background: rgba(60,180,110,.12); color: #3cb46e; }
.eh-ctrl { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 2px 0 2px; }
.eh-mini { display: inline-flex; align-items: center; gap: 6px; font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3, #9aa3b5); }
.eh-mini input[type=time] { background: var(--c-bg, #0f1113); color: var(--c-text, #e6e6e6); border: 1px solid var(--c-border, #2a2a2e); border-radius: 8px; padding: 3px 6px; font-size: .8rem; }
.eh-stepper { display: inline-flex; align-items: center; gap: 6px; }
.eh-stepper button { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-size: .9rem; line-height: 1; cursor: pointer; padding: 0; }
.eh-stepper button:disabled { opacity: .4; cursor: not-allowed; }
.eh-stepper strong { font-size: .9rem; min-width: 1ch; color: var(--c-text, #e6e6e6); text-transform: none; }
.eh-btn { font-family: inherit; font-size: .75rem; font-weight: 700; border-radius: 999px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; padding: 4px 12px; cursor: pointer; }
.eh-btn--primary { background: var(--c-accent, #378ADD); color: var(--c-on-accent, #fff); border-color: transparent; }
.eh-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
