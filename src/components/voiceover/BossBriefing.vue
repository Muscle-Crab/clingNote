<template>
  <div v-if="card" class="bb-wrap" data-test="boss-briefing">
    <section class="bb" role="dialog" aria-label="Boss briefing">
      <div class="bb-head">
        <div class="bb-who"><BossSergeant :size="64" :yelling="!(card.report && card.report.atEase) || speaking" /><div><h2>{{ card.morning ? 'Morning report' : card.report && card.report.atEase ? 'At ease' : 'Report, recruit!' }}</h2><BrandMark inline /></div></div>
        <div class="bb-r"><VoToggle @unmuted="speak" /><button class="bb-x" aria-label="Close" @click="close">✕</button></div>
      </div>
      <p v-if="card.alert && !card.report" class="bb-alert" data-test="bb-overdue">{{ card.alert }}</p>
      <div v-if="card.report" class="bb-rep" data-test="bb-report">
        <div class="bb-stats"><span v-if="card.report.stats.overdue">⏰ {{ card.report.stats.overdue }} overdue</span><span>📋 {{ card.report.stats.left }}/{{ card.report.stats.total }} left</span>
          <span v-if="card.report.stats.target">⭐ {{ card.report.stats.earned }}/{{ card.report.stats.target }} pts</span><span>🔥 {{ card.report.stats.streak }}</span><span v-if="card.report.stats.lockLeft">🔒 {{ card.report.stats.lockLeft }} left</span></div>
        <p v-for="(l, i) in card.report.lines" :key="i" class="bb-line" :class="'bb-line--' + l.kind">{{ l.text }}</p>
        <div v-if="card.report.prompts.length" class="bb-acts">
          <button v-for="p in card.report.prompts" :key="p.id" type="button" class="bb-act" :data-test="'bb-act-' + p.id" @click="act(p)">{{ p.label }}</button>
        </div>
      </div>
      <template v-if="card.morning">
        <svg class="bb-chart" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`Last 7 days: ${card.week.map(d => d.label + ' ' + d.done + ' of ' + d.planned).join(', ')}`">
          <line v-for="g in 3" :key="g" :x1="0" :x2="W" :y1="H - 18 - (g * (H - 34)) / 3" :y2="H - 18 - (g * (H - 34)) / 3" stroke="#16264A" />
          <g v-for="(d, i) in card.week" :key="i">
            <rect :x="bx(i)" :y="by(d.planned)" :width="bw" :height="bh(d.planned)" rx="5" fill="none" stroke="#2A3C66" stroke-width="1.5" />
            <rect :x="bx(i)" :y="by(d.done)" :width="bw" :height="bh(d.done)" rx="5" :fill="d.today ? '#5E9BFF' : d.done >= d.planned && d.planned ? '#2BD67B' : '#1E5BFF'" />
            <text :x="bx(i) + bw / 2" :y="by(Math.max(d.done, d.planned)) - 4" text-anchor="middle" fill="#A9B4CC" font-size="10">{{ d.done }}/{{ d.planned }}</text>
            <text :x="bx(i) + bw / 2" :y="H - 4" text-anchor="middle" :fill="d.today ? '#fff' : '#7180A0'" font-size="11" font-weight="600">{{ d.today ? 'Today' : d.label }}</text>
          </g>
        </svg>
        <div class="bb-stats"><span>🔥 {{ card.streak }}/5 streak</span><span>✅ {{ card.weekDone }}/{{ card.weekPlanned }} this week</span><span>⭐ {{ card.weekPoints }} pts</span></div>
        <p v-if="card.introText" class="bb-p bb-intro" data-test="bb-intro"><b>New here?</b> {{ card.introText }}</p>
        <p class="bb-p" data-test="bb-recap"><b>Yesterday:</b> {{ card.recap.replace(/^First, (how )?yesterday( went)?\.\s*/, '') }}</p>
        <p v-if="card.todayList.length" class="bb-p"><b>Today:</b> {{ card.todayList.join(' · ') }}</p>
        <p v-if="card.team" class="bb-p"><b>Team:</b> {{ card.team }}</p>
      </template>
      <p v-if="muted" class="bb-muted" data-test="bb-muted-banner">🔇 Voice is off. Tap 🔊 to hear the boss.</p>
      <button v-else-if="!spoke" class="bb-play" @click="speak">▶ Hear the boss</button>
      <p v-if="voiceTip" class="bb-p bb-tip" data-test="bb-voice-tip">🎙️ <b>Make the boss sound real:</b> on your iPhone open Settings › Accessibility › Spoken Content › Voices › English, download <b>Evan (Enhanced)</b> or <b>Nathan (Enhanced)</b>. <button type="button" class="bb-tipx" @click="dismissTip">Got it</button></p>
    </section>
  </div>
  <transition name="bb-ack"><div v-if="ack" class="bb-ackt" role="status" aria-live="polite" @click="ack = ''"><BossSergeant :size="40" :badge="true" /><span>{{ ack }}</span></div></transition>
</template>

<script setup>
import BrandMark from '@/components/brand/BrandMark.vue';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import VoToggle from './VoToggle.vue';
import BossSergeant from '@/components/boss/BossSergeant.vue';
import { buildReport, ackLine } from '@/utils/sergeantReport';
import { useEightHour } from '@/composables/useEightHour';
import { useRouter } from 'vue-router';
import { playFlow, stopVoice, unlockVoice, speakLive, loadVoiceInfo, voiceQuality, voMuted as muted, voSpeaking as speaking } from '@/composables/useVoiceover';
// One-time tip: only the compact iOS voice is installed -> suggest downloading an Enhanced/Premium male voice.
const TIP_KEY = 'clingnote.voiceTipSeen.v1';
const tipSeen = ref((() => { try { return localStorage.getItem(TIP_KEY) === '1'; } catch (e) { return true; } })());
const voiceTip = computed(() => !tipSeen.value && voiceQuality.value === 'default');
const dismissTip = () => { tipSeen.value = true; try { localStorage.setItem(TIP_KEY, '1'); } catch (e) { /* ignore */ } };
loadVoiceInfo();
import { SCRIPTS } from '@/voiceover/scripts';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { getMode } from '@/utils/appMode';
import { localDateStr } from '@/utils/streak';
import { overdueTasks, overdueLine, recapLine, planLine, morningDue, overdueDue, introKey } from '@/utils/briefing';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const W = 320; const H = 150; const bw = 28;
const route = useRoute(); const router = useRouter(); const eh = useEightHour(); const ack = ref(''); let ackT = null; const card = ref(null); const spoke = ref(false); let busy = false; let max = 1;
const bx = (i) => 10 + i * ((W - 20) / 7) + ((W - 20) / 7 - bw) / 2;
const bh = (v) => (v ? Math.max(3, (v / max) * (H - 40)) : 0); const by = (v) => H - 18 - bh(v);
const SKIP = /^\/(onboarding|welcome|login|landing|m\/|paywall|privacy|terms|support)/;
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };

async function run() {
  const u = auth.currentUser; if (!u || busy || card.value || SKIP.test(route.path)) return;
  const now = new Date(); const today = localDateStr(now); const mode = getMode();
  const kM = `clingnote.morning.${u.uid}`; const kO = `clingnote.overdueAt.${u.uid}`;
  const kI = `clingnote.introHeard.${u.uid}`; const needIntro = !ls(kI);
  const wantMorning = (needIntro && ls(kM) !== today) || morningDue(today, now.getHours(), ls(kM)); // first report = onboarding, any hour
  const wantOverdue = overdueDue(now.getTime(), ls(kO));
  if (!wantMorning && !wantOverdue) return;
  busy = true;
  try {
    const ud = await getDoc(doc(db, 'users', u.uid)).then((s) => (s.exists() ? s.data() : {})).catch(() => ({}));
    if (!ud.onboardingComplete) return;
    let people = [];
    if (mode === 'manager') { try { const { palApi } = await import('@/composables/usePals'); people = (await palApi('managerList')).people || []; } catch (e) { /* offline */ } }
    const dates = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i));
    const lists = await Promise.all(dates.map((d) => loadDayTasks(u.uid, DAY[d.getDay()]).catch(() => [])));
    const todayTasks = lists[6];
    const overdue = mode === 'manager' ? [] : overdueTasks(todayTasks, now, ud.onboarding && ud.onboarding.deadline);
    const alert = wantOverdue ? overdueLine({ mode, overdue, people }) : '';
    if (wantOverdue) ls(kO, String(now.getTime()));
    // Drill-sergeant report on open/resume (same 30-min throttle as the overdue alert).
    let report = null;
    if (wantOverdue && mode !== 'manager') {
      const sd0 = await getDoc(doc(db, 'streaks', u.uid)).then((s) => (s.exists() ? s.data() : {})).catch(() => ({}));
      const lk = eh.lock.value; const tgt = eh.data.value && eh.data.value.lock ? eh.data.value.lock : {};
      const earned = todayTasks.filter((t) => t.completed).reduce((s, t) => s + (Number(t.points) || 0), 0);
      report = buildReport({ tasks: todayTasks, now, nowMs: eh.nowMs(), deadline: ud.onboarding && ud.onboarding.deadline, phase: eh.phase.value,
        lock: lk ? { startMs: lk.startMs, endMs: lk.endMs } : null, earned: Number(tgt.earned) || earned, target: Number(tgt.target) || 0, streak: Number(sd0.streak) || 0 });
      if (!report.lines.length) report = null;
    }
    if (!wantMorning && !alert && !report) return;
    let morning = null;
    if (wantMorning) {
      const week = dates.map((d, i) => { const t = lists[i] || []; const done = t.filter((x) => x.completed);
        return { label: DAY[d.getDay()], planned: t.length, done: done.length, points: done.reduce((s, x) => s + (Number(x.points) || 0), 0), today: i === 6 }; });
      max = Math.max(1, ...week.map((d) => Math.max(d.planned, d.done)));
      const sd = await getDoc(doc(db, 'streaks', u.uid)).then((s) => (s.exists() ? s.data() : {})).catch(() => ({}));
      const streak = Math.min(5, Number(sd.streak) || 0);
      const late = people.filter((p) => p.overdue > 0);
      morning = { week, streak, weekDone: week.reduce((s, d) => s + d.done, 0), weekPlanned: week.reduce((s, d) => s + d.planned, 0), weekPoints: week.reduce((s, d) => s + d.points, 0),
        todayList: todayTasks.filter((t) => !t.completed).slice(0, 4).map((t) => t.title),
        team: people.length ? (late.length ? `${late.map((p) => `${p.ownerName} (${p.overdue} overdue)`).join(', ')}` : `All ${people.length} on track`) : '',
        recap: recapLine({ week }), plan: planLine({ streak, mode, people, todayTasks, deadline: ud.onboarding && ud.onboarding.deadline }) };
      const hello = now.getHours() < 12 ? 'Good morning.' : now.getHours() < 18 ? 'Good afternoon.' : 'Good evening.';
      morning.introKey = needIntro ? introKey(mode) : ''; morning.introText = morning.introKey ? SCRIPTS[morning.introKey] : '';
      morning.speech = `${hello} Here's your report. ${morning.recap} ${morning.plan}`;
      ls(kM, today); ls(`morningReport_${u.uid}`, today); // the Home text report is superseded by this card today
    }
    max = morning ? max : 1;
    // One voice flow: overdue alert first, then (first time only) the app explanation MP3, then yesterday's recap + today's plan.
    const lead = report ? report.speech : alert;
    card.value = { alert, report, lead, morning: !!morning, ...(morning || {}), morningSpeech: morning ? morning.speech : '', speech: [lead, morning && morning.speech].filter(Boolean).join(' ') };
    spoke.value = false; if (!muted.value) spoke.value = speak(false); // works once audio was unlocked by a tap; otherwise "Hear the boss"
  } catch (e) { console.error('briefing', e.message); } finally { busy = false; }
}
const markIntro = () => { const u = auth.currentUser; if (u && card.value && card.value.introKey) ls(`clingnote.introHeard.${u.uid}`, '1'); };
function speak(tap = true) {
  if (tap) unlockVoice(); const c = card.value; if (!c) return false;
  // Order: overdue alert (live) -> app explanation (bundled MP3, first report only) -> yesterday's recap + today's plan (live).
  const ok = playFlow({ before: c.lead || '', key: c.introKey || '', text: c.morningSpeech || '' });
  if (ok) markIntro(); if (tap) spoke.value = ok; return ok;
}
const close = () => { stopVoice(); markIntro(); card.value = null; }; // muted users still saw the intro text on the card
// Report buttons: Home performs the real action (start-day prompt, reminder modal, task detail).
function act(p) {
  close();
  const fire = () => window.dispatchEvent(new window.CustomEvent('cn:sergeant', { detail: { id: p.id, taskKey: p.taskKey || '' } }));
  if (route.path !== '/home') router.push('/home').then(() => setTimeout(fire, 600)); else fire();
}
// Small acknowledgement when a task is completed on Home.
const onAck = (e) => {
  const left = e && e.detail ? Number(e.detail.left) : 1; ack.value = ackLine({ left });
  if (!muted.value && !card.value) speakLive(ack.value);
  clearTimeout(ackT); ackT = setTimeout(() => { ack.value = ''; }, 2600);
};
let unsub = null; let appSub = null;
const onVis = () => { if (!document.hidden) run(); };
onMounted(async () => {
  unsub = onAuthStateChanged(auth, (u) => { if (u) setTimeout(run, 1500); });
  document.addEventListener('visibilitychange', onVis); window.addEventListener('cn:sergeant-ack', onAck);
  try { const { Capacitor } = await import('@capacitor/core'); if (Capacitor.isNativePlatform()) { const { App } = await import('@capacitor/app'); appSub = await App.addListener('resume', () => setTimeout(run, 500)); } } catch (e) { /* web */ }
});
watch(() => route.path, () => setTimeout(run, 800)); // e.g. right after onboarding lands on Home -> first report (intro)
onBeforeUnmount(() => { window.removeEventListener('cn:sergeant-ack', onAck); clearTimeout(ackT); unsub && unsub(); document.removeEventListener('visibilitychange', onVis); appSub && appSub.remove && appSub.remove(); stopVoice(); });
</script>

<style scoped>
.bb-wrap { position: fixed; inset: 0; z-index: 9000; display: flex; align-items: flex-end; justify-content: center; background: rgba(3,6,14,.6); padding: 12px 12px calc(12px + env(safe-area-inset-bottom)); }
.bb { width: 100%; max-width: 460px; max-height: 86vh; overflow-y: auto; background: #070D1C; border: 1px solid #2A3C66; border-radius: 22px; padding: 16px; color: #F2F5FC; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.bb-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; } .bb-head h2 { margin: 0; font-size: 18px; font-weight: 800; }
.bb-r { display: flex; gap: 6px; align-items: center; } .bb-x { background: none; border: 0; color: #7180A0; font-size: 16px; cursor: pointer; width: 30px; height: 30px; }
.bb-alert { margin: 12px 0 4px; padding: 10px 12px; border-radius: 12px; background: rgba(255,90,70,.12); border: 1px solid rgba(255,90,70,.4); color: #FFD2CA; font-weight: 600; }
.bb-chart { width: 100%; height: auto; margin: 10px 0 4px; background: linear-gradient(180deg, #0B1630, #070D1C); border-radius: 14px; }
.bb-stats { display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; color: #A9B4CC; } .bb-stats span { background: #10204A; padding: 4px 10px; border-radius: 999px; }
.bb-p { margin: 8px 0 0; color: #A9B4CC; font-size: 14px; } .bb-p b { color: #fff; }
.bb-muted { margin: 10px 0 0; font-size: 13px; color: #A9B4CC; }
.bb-play { margin-top: 12px; width: 100%; min-height: 46px; border: 0; border-radius: 14px; font-weight: 800; color: #fff; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); cursor: pointer; }
.bb-who { display: flex; align-items: center; gap: 10px; }
.bb-rep { margin-top: 10px; } .bb-line { margin: 8px 0 0; font-size: 15px; font-weight: 700; color: #F2F5FC; letter-spacing: .01em; }
.bb-line--overdue { color: #FFD2CA; } .bb-line--atease { color: #2BD67B; } .bb-line--streak, .bb-line--points { color: #A9B4CC; font-weight: 600; }
.bb-acts { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.bb-act { min-height: 44px; border-radius: 14px; border: 1px solid #2A3C66; background: #10204A; color: #fff; font-weight: 800; cursor: pointer; }
.bb-act:first-child { border: 0; background: linear-gradient(90deg,#1E5BFF,#5B9BFF); }
.bb-ackt { position: fixed; z-index: 8999; left: 50%; transform: translateX(-50%); bottom: calc(84px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 10px;
  padding: 6px 14px 6px 6px; border-radius: 999px; background: #0C1630; border: 1px solid #5B9BFF; color: #fff; font-weight: 800; font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
.bb-ack-enter-active, .bb-ack-leave-active { transition: opacity .2s, transform .2s; } .bb-ack-enter-from, .bb-ack-leave-to { opacity: 0; transform: translate(-50%, 10px); }
@media (prefers-reduced-motion: reduce) { .bb-ack-enter-active, .bb-ack-leave-active { transition: none; } }
.bb-tip { font-size: 12px; opacity: .9; }
.bb-tipx { margin-left: 6px; background: none; border: 1px solid currentColor; border-radius: 8px; color: inherit; font-size: 11px; padding: 1px 8px; }
</style>
