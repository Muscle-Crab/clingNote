<template>
  <section class="eh" :class="'eh--' + view" data-test="eight-hour-card" :aria-label="`Your ${hl}-hour day`">
    <!-- loading / offline -->
    <p v-if="view === 'loading'" class="eh-muted" data-test="eh-loading">Loading your day…</p>
    <div v-else-if="view === 'error'" class="eh-line"><p class="eh-muted">Couldn't reach your {{ hl }}-hour day<span v-if="eh.st.error"> ({{ eh.st.error }})</span>.</p><button class="eh-btn" @click="$emit('retry')">Retry</button></div>

    <p v-if="view !== 'error' && view !== 'loading' && eh.st.data && eh.st.data.offline" class="eh-muted" data-test="eh-offline">Offline mode: the countdown lock starts once the server is reachable. <button class="eh-btn" @click="$emit('retry')">Retry</button></p>
    <!-- no plan yet: one compact row (wake time + the min/max task range for the chosen hours), then it is locked when the day starts -->
    <template v-else-if="view === 'setup'">
      <div class="eh-line"><b class="eh-title">⏱ Set your day</b><button class="eh-btn eh-btn--primary" :disabled="busy || !wake" @click="save" data-test="eh-save">Lock in</button></div>
      <div class="eh-ctrl">
        <label class="eh-mini">Wake <input type="time" v-model="wake" data-test="eh-wake" /></label>
        <span class="eh-fine" data-test="eh-range">{{ rangeLine }}</span>
      </div>
      <p v-if="msg" class="eh-err" role="alert">{{ msg }}</p>
    </template>

    <!-- planned: waiting for the wake time (or for the tasks) -->
    <template v-else-if="view === 'planned'">
      <p v-if="stats.warning && !(eh.st.data && eh.st.data.offline)" class="eh-note eh-alert--boss" data-test="eh-alert">⚠️ {{ stats.warning }}</p>
      <div class="eh-line">
        <p class="eh-big" data-test="eh-starts">{{ phase === 'before' ? 'Starts ' + fmtWake : 'Ready' }}<small> · Ends {{ ends }}</small></p>
        <button v-if="phase === 'ready' && inRange" class="eh-btn eh-btn--primary" data-test="eh-start" @click="$emit('start')">Start</button>
        <span v-else class="eh-badge">Not started</span>
      </div>
      <!-- ONE compact line: the min/max range for the chosen hours + what is on the list (no stepper, no "plan N instead") -->
      <p class="eh-muted" data-test="eh-range">{{ rangeLine }} · {{ taskTotal }} on your list.<template v-if="needMore > 0"> Add {{ needMore }} more to start.</template><template v-else-if="phase === 'before'"> After your wake time you'll pick today's hours and confirm.</template></p>
      <div class="eh-ctrl" v-if="phase === 'before'">
        <label class="eh-mini">Wake <input type="time" v-model="wake" data-test="eh-wake" /></label>
        <button v-if="wake !== plan.wakeTime" class="eh-btn" :disabled="busy" @click="save">Save</button>
        <span class="eh-fine">Locked once started</span>
      </div>
      <p v-if="overBy > 0" class="eh-err" data-test="eh-over" role="alert">Over the max of {{ range.max }} tasks. Remove {{ overBy }} to start.</p>
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
      <!-- draining bar: time left (track) vs points earned (fill); the pace marker is where points should be by now -->
      <div class="eh-drain" data-test="eh-drain" :aria-label="`${pace.timePct}% of time left, ${pace.pointsPct}% of target earned`">
        <span class="eh-drain-time" :style="{ width: pace.timePct + '%' }"></span><span class="eh-drain-pts" :style="{ width: pace.pointsPct + '%' }"></span>
        <span class="eh-drain-pace" :style="{ left: Math.min(100, Math.round((pace.expected / Math.max(1, lock.target)) * 100)) + '%' }"></span>
      </div>
      <!-- at most ONE pressure line. The server notice belongs to the last SETTLED day, never to the running one
           (it said "0 of 30" from an earlier day under today's 0/260 header). -->
      <p v-if="alert" class="eh-note" :class="'eh-alert--' + alert.level" data-test="eh-alert" role="status">{{ alert.text }}</p>
    </template>

    <!-- ended -->
    <template v-else-if="view === 'ended'">
      <div class="eh-line">
        <span class="eh-badge" :class="met ? 'eh-badge--ok' : 'eh-badge--miss'" data-test="eh-result">{{ met ? 'Goal met' : 'Goal missed' }}</span>
        <div class="eh-meta eh-meta--end"><span data-test="eh-points">{{ progress.earned }}/{{ lock.target }} pts</span><span>🔥 {{ stats.streak }} day streak</span></div>
      </div>
      <p v-if="met && reward" class="eh-note eh-note--ok" data-test="eh-reward">{{ reward }}</p>
      <p v-if="stats.notice && stats.lastDay === lock.dayKey" class="eh-note" data-test="eh-notice">{{ stats.notice }}</p>
      <details class="eh-hist" data-test="eh-history">
        <summary>Lv {{ level }} · {{ stats.xp || 0 }} XP · {{ stats.coins || 0 }} coins · 🛡️{{ stats.shields || 0 }}<span v-if="badges.length"> · 🏅{{ badges.length }}</span></summary>
        <div v-if="badges.length" class="eh-badges" data-test="eh-badges">
          <span v-for="b in badges" :key="b.k" class="eh-bdg" :title="b.title">{{ b.icon }}<small>{{ b.name }}<template v-if="b.from"><br>{{ b.from }} · {{ b.date }}</template><template v-if="b.note"><br>“{{ b.note }}”</template></small></span>
        </div>
        <ul class="eh-log"><li v-for="e in (stats.log || [])" :key="e.dayKey">{{ e.dayKey }}: {{ e.met ? '✅' : '❌' }} {{ e.earned }}/{{ e.target }}<template v-if="e.reward"> · +{{ e.reward.xp }} XP · +{{ e.reward.coins }} coins</template><template v-if="e.penalty && e.penalty.coins"> · -{{ e.penalty.coins }} coins</template><template v-if="e.penalty && e.penalty.shieldUsed"> · 🛡️ used</template></li></ul>
      </details>
      <div class="eh-ctrl"><label class="eh-mini">Tomorrow's wake <input type="time" v-model="wake" /></label><button v-if="wake !== plan.wakeTime" class="eh-btn" :disabled="busy" @click="save">Save</button></div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useEightHour } from '@/composables/useEightHour';
import { paceOf, topAlert, badgeLabel, levelOf } from '@/utils/pressure';
import { progressOf, countableIndexes, fmtWakeLabel, hoursLabel, taskRange } from '@/utils/eightHour';

// tasks = today's stored task array (all of it; hidden recurring copies are excluded by progressOf/countable logic)
const props = defineProps({ tasks: { type: Array, default: () => [] }, startError: { type: String, default: '' } });
defineEmits(['retry', 'start']);
const eh = useEightHour();
const { phase, plan, lock, stats, reward, countdown } = eh;
const starts = computed(() => eh.startsLabel.value);
const wake = ref('07:00'); const msg = ref('');
const busy = computed(() => eh.st.busy);
watch(plan, (p) => { if (p) wake.value = p.wakeTime; }, { immediate: true });

const view = computed(() => {
  if (!eh.st.loaded) return eh.st.error ? 'error' : 'loading';
  if (phase.value === 'none') return 'setup';
  if (phase.value === 'running') return lock.value ? 'running' : 'planned';
  if (phase.value === 'ended') return lock.value ? 'ended' : 'planned';
  return 'planned';
});
const ends = computed(() => eh.endsLabel.value);
const hl = computed(() => hoursLabel(eh.dayHours.value));
const fmtWake = computed(() => (plan.value ? fmtWakeLabel(plan.value.wakeTime) : ''));
const dayKey = computed(() => eh.phaseInfo.value.dayKey || '');
const taskTotal = computed(() => countableIndexes(props.tasks || [], dayKey.value).length);
// Min/max tasks for the chosen hours (eightHourCore.taskRange): Start needs min <= list <= max; adding past max is blocked in HomeView.
const range = computed(() => taskRange(eh.dayHours.value));
const rangeLine = computed(() => `Min ${range.value.min} · max ${range.value.max} tasks for ${hl.value} hours`);
const needMore = computed(() => Math.max(0, range.value.min - taskTotal.value));
const overBy = computed(() => Math.max(0, taskTotal.value - range.value.max));
const inRange = computed(() => needMore.value === 0 && overBy.value === 0);
const progress = computed(() => (lock.value ? progressOf({ dayKey: lock.value.dayKey, points: lock.value.points }, props.tasks) : { earned: 0, done: 0, total: 0 }));
const pct = computed(() => (lock.value && lock.value.target > 0 ? Math.min(100, Math.round((progress.value.earned / lock.value.target) * 100)) : 0));
const pace = computed(() => (lock.value ? paceOf({ earned: progress.value.earned, target: lock.value.target || 0, startMs: lock.value.startMs, endMs: lock.value.endMs, nowMs: (countdown.value, eh.nowMs()) }) : { timePct: 0, pointsPct: 0, expected: 0, behindBy: 0, leftMs: 0 }));
const alert = computed(() => (lock.value ? topAlert({ offline: !!(eh.st.data && eh.st.data.offline), running: phase.value === 'running', earned: progress.value.earned, target: lock.value.target || 0, startMs: lock.value.startMs, endMs: lock.value.endMs, nowMs: (countdown.value, eh.nowMs()), streak: stats.value.streak || 0, warning: stats.value.warning || '' }) : null));
const level = computed(() => levelOf(stats.value.xp || 0));
const fmtDay = (ms) => { try { return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch (e) { return ''; } };
const badges = computed(() => [
  ...(stats.value.awards || []).filter((a) => a.badge).map((a) => ({ k: 'a' + a.at, ...badgeLabel(a.badge), from: a.from || 'Manager', date: fmtDay(a.at), note: a.note || '', title: badgeLabel(a.badge).name })),
  ...(stats.value.badges || []).map((id) => ({ k: 'b' + id, ...badgeLabel(id), title: badgeLabel(id).name })),
]);
const met = computed(() => (lock.value ? progress.value.earned >= lock.value.target : false));

const save = async () => {
  msg.value = '';
  // plan.taskCount is internal now (the server still wants 1..MAX); store the list size clamped into the range.
  const taskCount = Math.min(range.value.max, Math.max(range.value.min, taskTotal.value));
  try { await eh.savePlan({ wakeTime: wake.value, taskCount }); } catch (e) { msg.value = e.status === 423 ? `Locked: your ${hl.value}-hour day is running.` : (e.message || 'Could not save'); }
};
</script>

<style scoped>
/* Compact strip (replaces the old big card). Sits between the day tabs and the progress card. */
.eh { max-width: 100%; box-sizing: border-box; overflow-x: hidden; touch-action: pan-y; overscroll-behavior-x: none; background: var(--c-surface, #16181c); border: 1px solid var(--c-border, #2a2a2e); border-radius: 14px; padding: 6px 12px; margin: 6px 0; color: var(--c-text, #e6e6e6); }
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
.eh-mini input[type=time] { background: var(--c-bg, #0f1113); color: var(--c-text, #e6e6e6); border: 1px solid var(--c-border, #2a2a2e); border-radius: 8px; padding: 3px 6px; font-size: 16px; max-width: 100%; }
.eh-btn { font-family: inherit; font-size: .75rem; font-weight: 700; min-height: 44px; min-width: 44px; border-radius: 999px; border: 1px solid var(--c-border, #2a2a2e); background: var(--c-surface-2, #22252a); color: inherit; padding: 4px 12px; cursor: pointer; }
.eh-btn--primary { background: var(--c-accent, #378ADD); color: var(--c-on-accent, #fff); border-color: transparent; }
.eh-btn:disabled { opacity: .5; cursor: not-allowed; }
.eh-drain { position: relative; height: 6px; border-radius: 3px; background: rgba(255,255,255,.06); margin-top: 6px; overflow: hidden; }
.eh-drain-time { position: absolute; inset: 0 auto 0 0; background: rgba(55,138,221,.28); transition: width 1s linear; }
.eh-drain-pts { position: absolute; inset: 0 auto 0 0; background: #3cb46e; border-radius: 3px; }
.eh-drain-pace { position: absolute; top: 0; bottom: 0; width: 2px; background: #f59e0b; }
.eh-alert--behind { color: #f59e0b; } .eh-alert--risk { color: #e05a5a; font-weight: 700; } .eh-alert--boss { color: #e05a5a; }
.eh-hist { margin-top: 6px; font-size: 12px; } .eh-hist summary { cursor: pointer; opacity: .8; list-style: none; } .eh-hist summary::after { content: ' ▾'; }
.eh-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; margin: 6px 0; }
.eh-bdg { display: flex; flex-direction: column; align-items: center; font-size: 20px; text-align: center; } .eh-bdg small { font-size: 9px; opacity: .75; line-height: 1.2; }
.eh-log { margin: 4px 0 0; padding: 0; list-style: none; opacity: .75; max-height: 120px; overflow: auto; }
.eh-link { background: none; border: 0; padding: 0; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
.eh-link:disabled { opacity: .5; }
</style>
