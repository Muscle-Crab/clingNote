<template>
  <section class="eh" :class="'eh--' + view" data-test="eight-hour-card" aria-label="Your 8-hour day">
    <!-- loading / offline -->
    <p v-if="view === 'loading'" class="eh-muted" data-test="eh-loading">Loading your 8-hour day…</p>
    <div v-else-if="view === 'error'" class="eh-row"><p class="eh-muted">Couldn't reach your 8-hour day.</p><button class="eh-btn" @click="$emit('retry')">Retry</button></div>

    <!-- no plan yet (new install of an existing account, or skipped nothing: onboarding normally sets this) -->
    <template v-else-if="view === 'setup'">
      <h2 class="eh-title">Set your 8-hour day</h2>
      <p class="eh-muted">Pick the time you wake up. Your 8-hour countdown starts then, and once it starts it is locked.</p>
      <div class="eh-form">
        <label class="eh-field">Wake time<input type="time" v-model="wake" data-test="eh-wake" /></label>
        <div class="eh-field">Tasks today <span class="eh-stepper"><button type="button" :disabled="count <= 1" @click="count--" aria-label="Fewer tasks">−</button><strong data-test="eh-count">{{ count }}</strong><button type="button" :disabled="count >= max" @click="count++" aria-label="More tasks">+</button></span></div>
      </div>
      <button class="eh-btn eh-btn--primary" :disabled="busy || !wake" @click="save" data-test="eh-save">Lock in my plan</button>
      <p v-if="msg" class="eh-err" role="alert">{{ msg }}</p>
    </template>

    <!-- planned: waiting for the wake time (or for the tasks) -->
    <template v-else-if="view === 'planned'">
      <div class="eh-head"><h2 class="eh-title">Your 8-hour day</h2><span class="eh-badge">Not started</span></div>
      <p class="eh-big" data-test="eh-starts">{{ phase === 'before' ? 'Starts ' + fmtWake : 'Ready' }}<small> · Ends {{ ends }}</small></p>
      <p class="eh-muted" v-if="phase === 'ready' && needMore <= 0" data-test="eh-all-added">All {{ plan.taskCount }} task{{ plan.taskCount === 1 ? '' : 's' }} added. Start the countdown when you are ready.</p>
      <p class="eh-muted" v-else-if="phase === 'ready'" data-test="eh-needs-tasks">
        Add {{ needMore }} more task{{ needMore === 1 ? '' : 's' }} to start the countdown ({{ taskTotal }}/{{ plan.taskCount }} added).
      </p>
      <p class="eh-muted" v-else>Add your {{ plan.taskCount }} task{{ plan.taskCount === 1 ? '' : 's' }} ({{ taskTotal }}/{{ plan.taskCount }}). The countdown starts at your wake time.</p>
      <div class="eh-form">
        <label class="eh-field" v-if="phase === 'before'">Wake time<input type="time" v-model="wake" data-test="eh-wake" /></label>
        <div class="eh-field">Tasks <span class="eh-stepper"><button type="button" :disabled="busy || count <= 1" @click="count--; save()" aria-label="Fewer tasks">−</button><strong data-test="eh-count">{{ count }}</strong><button type="button" :disabled="busy || count >= max" @click="count++; save()" aria-label="More tasks">+</button></span></div>
        <button v-if="phase === 'before'" class="eh-btn" :disabled="busy || wake === plan.wakeTime" @click="save">Save wake time</button>
      </div>
      <p v-if="taskTotal > plan.taskCount" class="eh-err" data-test="eh-over" role="alert">You have {{ taskTotal }} tasks but planned {{ plan.taskCount }}. Raise the count to {{ taskTotal }} to start.</p>
      <button v-if="phase === 'ready' && taskTotal === plan.taskCount && taskTotal > 0" class="eh-btn eh-btn--primary" data-test="eh-start" @click="$emit('start')">Start the countdown</button>
      <p v-if="startError" class="eh-err" role="alert">{{ startError }}</p>
      <p class="eh-fine">Changes are only possible until the countdown starts. After that: no edits, skips or resets.</p>
      <p v-if="msg" class="eh-err" role="alert">{{ msg }}</p>
    </template>

    <!-- running: the strict, locked day -->
    <template v-else-if="view === 'running'">
      <div class="eh-head"><h2 class="eh-title">8-hour day</h2><span class="eh-badge eh-badge--lock" data-test="eh-lock">🔒 Locked</span></div>
      <p class="eh-clock" data-test="eh-countdown" role="timer">{{ countdown }}</p>
      <p class="eh-muted" data-test="eh-ends">Ends {{ ends }}</p>
      <div class="eh-stats">
        <p class="eh-stat" data-test="eh-tasks"><strong>{{ progress.done }}/{{ progress.total }}</strong><span>tasks done</span></p>
        <p class="eh-stat" data-test="eh-points"><strong>{{ progress.earned }}/{{ lock.target }}</strong><span>points target</span></p>
      </div>
      <div class="eh-bar" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: pct + '%' }"></span></div>
      <p class="eh-fine">{{ pct >= 100 ? 'Goal reached. Finish strong.' : 'Hit the target before the clock runs out.' }} Tasks, points and target are locked.</p>
      <p v-if="stats.notice" class="eh-note" data-test="eh-notice">{{ stats.notice }}</p>
    </template>

    <!-- ended -->
    <template v-else-if="view === 'ended'">
      <div class="eh-head"><h2 class="eh-title">8-hour day over</h2><span class="eh-badge" :class="met ? 'eh-badge--ok' : 'eh-badge--miss'" data-test="eh-result">{{ met ? 'Goal met' : 'Goal missed' }}</span></div>
      <div class="eh-stats">
        <p class="eh-stat"><strong>{{ progress.done }}/{{ progress.total }}</strong><span>tasks done</span></p>
        <p class="eh-stat"><strong>{{ progress.earned }}/{{ lock.target }}</strong><span>points target</span></p>
        <p class="eh-stat"><strong>{{ stats.streak }}</strong><span>day streak</span></p>
      </div>
      <p v-if="met && reward" class="eh-note eh-note--ok" data-test="eh-reward">{{ reward }}</p>
      <p v-if="stats.notice" class="eh-note" data-test="eh-notice">{{ stats.notice }}</p>
      <p class="eh-fine">Tomorrow's wake time can be changed now; your next countdown starts at that time.</p>
      <div class="eh-form"><label class="eh-field">Wake time<input type="time" v-model="wake" /></label><button class="eh-btn" :disabled="busy || wake === plan.wakeTime" @click="save">Save</button></div>
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
.eh { background: var(--c-surface, #16181c); border: 1px solid var(--c-border, #2a2a2e); border-radius: var(--r, 6px); padding: 14px 16px; margin: 10px 0; color: var(--c-text, #e6e6e6); }
.eh--running { border-color: var(--c-accent, #378ADD); }
.eh-head, .eh-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.eh-title { font-size: 0.95rem; font-weight: 700; margin: 0; letter-spacing: .01em; }
.eh-badge { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--c-surface-2, #22252a); color: var(--c-text-2, #b0b0b0); text-transform: uppercase; letter-spacing: .04em; }
.eh-badge--lock { background: rgba(55,138,221,.18); color: var(--c-accent, #378ADD); }
.eh-badge--ok { background: rgba(60,180,110,.18); color: #3cb46e; }
.eh-badge--miss { background: rgba(224,90,90,.18); color: #e05a5a; }
.eh-clock { font-size: 2.4rem; font-weight: 800; font-variant-numeric: tabular-nums; margin: 6px 0 0; letter-spacing: .02em; }
.eh-big { font-size: 1.3rem; font-weight: 700; margin: 6px 0; }
.eh-big small { font-size: .85rem; font-weight: 500; color: var(--c-text-3, #888); }
.eh-muted { color: var(--c-text-3, #888); font-size: .85rem; margin: 4px 0; }
.eh-fine { color: var(--c-text-3, #888); font-size: .75rem; margin: 8px 0 0; }
.eh-err { color: #e05a5a; font-size: .8rem; margin: 6px 0 0; }
.eh-note { margin: 8px 0 0; font-size: .82rem; padding: 8px 10px; border-radius: var(--r, 6px); background: rgba(224,160,60,.12); color: #e0a03c; }
.eh-note--ok { background: rgba(60,180,110,.12); color: #3cb46e; }
.eh-stats { display: flex; gap: 22px; margin: 10px 0 8px; }
.eh-stat { display: flex; flex-direction: column; margin: 0; }
.eh-stat strong { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
.eh-stat span { font-size: .7rem; color: var(--c-text-3, #888); text-transform: uppercase; letter-spacing: .04em; }
.eh-bar { height: 6px; border-radius: 3px; background: var(--c-surface-2, #22252a); overflow: hidden; }
.eh-bar span { display: block; height: 100%; background: var(--c-accent, #378ADD); transition: width .4s; }
.eh-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin: 10px 0 4px; }
.eh-field { display: flex; flex-direction: column; gap: 4px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-3, #888); }
.eh-field input[type=time] { background: var(--c-bg, #0f1113); color: inherit; border: 1px solid var(--c-border, #2a2a2e); border-radius: var(--r, 6px); padding: 6px 8px; font-size: .95rem; }
.eh-stepper { display: inline-flex; align-items: center; gap: 10px; }
.eh-stepper button { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; font-size: 1rem; cursor: pointer; }
.eh-stepper button:disabled { opacity: .4; cursor: not-allowed; }
.eh-stepper strong { font-size: 1.05rem; min-width: 1ch; color: var(--c-text, #e6e6e6); }
.eh-btn { font-family: inherit; font-size: .85rem; font-weight: 600; border-radius: var(--r, 6px); border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; padding: 7px 14px; cursor: pointer; }
.eh-btn--primary { background: var(--c-accent, #378ADD); color: var(--c-on-accent, #fff); border-color: transparent; margin-top: 8px; }
.eh-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
