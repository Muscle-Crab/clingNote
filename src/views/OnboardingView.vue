<template>
  <div class="ob" @pointerdown.capture="onFirstTap">
    <PaywallPanel v-if="step === STEPS.length" :name="firstName" @close="finish" />
    <template v-else>
      <div class="ob-top">
        <button v-if="step > 0" class="ob-back" @click="go(step - 1)" aria-label="Back">‹</button><span v-else></span>
        <div class="ob-dots"><i v-for="(s, i) in STEPS" :key="s" :class="{ on: i <= step }"></i></div>
        <VoToggle class="ob-vo" @unmuted="narrate" /><button v-if="STEPS[step] !== 'age'" class="ob-skip" @click="go(ageState === 'ok' ? STEPS.length : STEPS.indexOf('age'))">Skip</button>
      </div>

      <!-- First screen = the core pitch: you buy your free time (screen time) with done tasks. Numbers mirror utils/pointsVault.js. -->
      <Transition name="ob-step" mode="out-in">
      <section v-if="STEPS[step] === 'welcome'" class="ob-sec" data-test="ob-pitch">
        <div class="ob-art"></div>
        <p class="ob-k">Hey {{ firstName }} 👋</p>
        <h1 class="ob-h">Buy back your <span>free time.</span></h1>
        <p class="ob-p">In ClingNote, screen time isn't free: you pay for it by getting things done. Your robot coach keeps score.</p>
        <div class="ob-row"><span class="em">✅</span><div><b>Tasks earn points</b><small>A medium task is about 20 pts. Every 10 pts buys you 5 minutes.</small></div></div>
        <div class="ob-row"><span class="em">💸</span><div><b>Your top apps cost the most</b><small>Each app's price follows how much you used it this past week (30 pts + 2 per daily minute).</small></div></div>
        <div class="ob-row"><span class="em">🔓</span><div><b>The vault opens as you earn</b><small>Pass an app's price and it unlocks, right on your phone.</small></div></div>
        <div class="ob-row"><span class="em">🔥</span><div><b>8 tasks a session</b><small>Hit 8 to keep your streak alive. Earn breaks along the way.</small></div></div>
        <div class="ob-row"><span class="em">🤖</span><div><b>An AI coach in your corner</b><small>Plans your day, sizes your tasks, and cheers you on.</small></div></div>
      </section>

      <!-- What's new: big update section (kept in the existing ob-row style). -->
      <section v-else-if="STEPS[step] === 'whatsnew'" class="ob-sec" data-test="ob-whatsnew">
        <p class="ob-k">What's new</p>
        <h1 class="ob-h">Fresh in this <span>update 🎉</span></h1>
        <p class="ob-p">Three upgrades that make every focus session feel better.</p>
        <div class="ob-row"><span class="em">⏱️</span><div><b>Timers count up</b><small>Press play and watch it climb from 00:00. Every minute you put in shows.</small></div></div>
        <div class="ob-row"><span class="em">🔔</span><div><b>A ping at your set time</b><small>Your phone buzzes when you hit the task's time, even when locked. The timer keeps going (+overtime) until you end the session. Your music keeps playing.</small></div></div>
        <div class="ob-row"><span class="em">🎁</span><div><b>Real app icons pop out of the vault</b><small>When apps unlock, their actual icons burst out of the vault with confetti.</small></div></div>
      </section>

      <section v-else-if="STEPS[step] === 'age'" class="ob-sec" data-test="ob-age">
        <p class="ob-k">Quick check</p><h1 class="ob-h">How old <span>are you?</span></h1><p class="ob-p">Just your age. You must be 13 or older to use ClingNote.</p>
        <div class="ob-age">
          <button type="button" class="ob-step" aria-label="Younger" @click="bumpAge(-1)">−</button>
          <input type="number" inputmode="numeric" min="1" max="100" v-model.number="a.age" placeholder="—" aria-label="Your age" data-test="ob-age-input" />
          <button type="button" class="ob-step" aria-label="Older" @click="bumpAge(1)">+</button>
        </div>
        <p v-if="ageState === 'under'" class="ob-warn" data-test="ob-age-under">Sorry, ClingNote is for people 13 and older. Come back when you're 13 — your robot will be waiting. 👋</p>
        <p v-else-if="ageState === 'invalid'" class="ob-warn">Enter an age between 13 and 100.</p>
      </section>

      <section v-else-if="STEPS[step] === 'goals'" class="ob-sec">
        <p class="ob-k">Step {{ stepNo('goals') }}</p><h1 class="ob-h">What do you want to <span>nail?</span></h1><p class="ob-p">Pick all that apply.</p>
        <div class="ob-grid">
          <button v-for="g in GOALS" :key="g.id" class="ob-opt" :class="{ on: a.goals.includes(g.id) }" @click="toggle(g.id)"><span class="em">{{ g.e }}</span>{{ g.l }}</button>
        </div>
      </section>

      <section v-else-if="STEPS[step] === 'schedule'" class="ob-sec">
        <p class="ob-k">Step {{ stepNo('schedule') }}</p><h1 class="ob-h">Your daily <span>rhythm</span></h1><p class="ob-p">We'll nudge you to start your day and wrap it up on time.</p>
        <div class="ob-field" data-test="ob-wake-locked"><span>☀️ Your day can start from</span><b>{{ wakeLabel }}</b></div>
        <p class="ob-p ob-small">You picked this before signing up. Each morning you pick 3 to 12 hours and confirm. Once confirmed, those hours are locked.</p>
        <label class="ob-field"><span>🎯 Tasks done by</span><input type="time" v-model="a.deadline" /></label>
        <label class="ob-field"><span>🌙 Bedtime</span><input type="time" v-model="a.bedTime" /></label>
      </section>

      <section v-else-if="STEPS[step] === 'alarm'" class="ob-sec" data-test="ob-alarm">
        <div class="ob-bell">⏰</div>
        <p class="ob-k">Step {{ stepNo('alarm') }}</p><h1 class="ob-h">Want a <span>wake-up alarm?</span></h1>
        <p class="ob-p">ClingNote can ask you each day if you want an alarm, and ring at your time even on silent.</p>
        <label class="ob-field"><span>⏰ Alarm time</span><input type="time" v-model="alarmTime" data-test="ob-alarm-time" /></label>
        <p class="ob-p ob-small">You can change this anytime in Settings.</p>
      </section>

      <section v-else-if="STEPS[step] === 'strictness'" class="ob-sec">
        <p class="ob-k">Step {{ stepNo('strictness') }}</p><h1 class="ob-h">How strict should <span>your robot</span> be?</h1>
        <button v-for="s in STRICT" :key="s.id" class="ob-row" :class="{ on: a.strictness === s.id }" @click="a.strictness = s.id">
          <RobotCoach v-if="s.id === 'drill'" class="em em-sgt" :size="44" :talking="a.strictness === 'drill'" /><span v-else class="em">{{ s.e }}</span><span><b>{{ s.l }}</b><small>{{ s.d }}</small></span>
        </button>
        <p class="ob-boss" data-test="ob-boss">Coach mode:
          <button type="button" class="ob-boss-opt" :class="{ on: a.bossMode !== 'strict' }" data-test="ob-boss-simple" @click="a.bossMode = 'simple'">Simple</button>
          <button type="button" class="ob-boss-opt" :class="{ on: a.bossMode === 'strict' }" data-test="ob-boss-strict" @click="a.bossMode = 'strict'">Strict</button>
          <small>{{ a.bossMode === 'strict' ? 'Starts at wake, locks apps, you earn screen time by hitting your points goal.' : 'You start the day yourself. Change it any time in Settings.' }}</small></p>
      </section>

      <section v-else-if="STEPS[step] === 'notifications'" class="ob-sec">
        <div class="ob-bell">🔔</div>
        <p class="ob-k">Step {{ stepNo('notifications') }}</p><h1 class="ob-h">Let your robot <span>reach you</span></h1>
        <p class="ob-p">Notifications are how ClingNote keeps you honest: start‑of‑day prompts, deadline warnings and robot check‑ins. No spam.</p>
        <div class="ob-note"><b>⏰ 9:00 PM · ClingNote</b><span>2 tasks left before your deadline. Let's finish strong 💪</span></div>
      </section>

      <section v-else-if="STEPS[step] === 'applock'" class="ob-sec" data-test="ob-applock">
        <div class="ob-bell">🔒</div>
        <p class="ob-k">Step {{ stepNo('applock') }}</p><h1 class="ob-h">Lock your <span>distractions</span></h1>
        <p class="ob-p">Pick apps to block while you're locked in. They unlock when your tasks or points goal are done, or when your hours end. Optional, and you can change it later. Only apps on this iPhone are listed: find Instagram under Social and PUBG Mobile under Games, or search for them.</p>
        <p v-if="a.appLock" class="ob-p">{{ a.appLock }}</p>
      </section>

      <!-- Right after the app picker: the chosen apps locked in the vault, priced/ordered by utils/pointsVault.js (same list as Home's vault row). -->
      <section v-else-if="STEPS[step] === 'vault'" class="ob-sec" data-test="ob-vault">
        <div class="ob-bell">🔐</div>
        <p class="ob-k">Step {{ stepNo('vault') }}</p><h1 class="ob-h">Your apps are in <span>the vault</span></h1>
        <p class="ob-p">Earn points to unlock these. Cheapest opens first; 10 pts = 5 min of app time.</p>
        <div class="gp-body gp-vbody ob-vault" data-test="ob-vault-list"><VaultApps :items="vaultItems" detail :why="vaultWhy" /></div>
        <p v-if="!vaultItems.length" class="ob-p" data-test="ob-vault-empty">Your picked apps will show here with their prices.</p>
      </section>
      </Transition>

      <div class="ob-foot">
        <button class="ob-cta" :aria-busy="String(busy)" :disabled="busy || (STEPS[step] === 'goals' && !a.goals.length) || (STEPS[step] === 'age' && ageState !== 'ok') || (STEPS[step] === 'alarm' && (alarmBusy || !alarmTime))" @click="next">{{ ctaLabel }}</button>
        <button v-if="STEPS[step] === 'alarm'" class="ob-later" data-test="ob-alarm-later" @click="a.wakeAlarm = 'later'; go(step + 1)">Not now</button>
        <button v-if="STEPS[step] === 'applock'" class="ob-later" :disabled="busy" @click="a.appLock = 'later'; go(step + 2)">Not now</button>
        <button v-if="STEPS[step] === 'notifications'" class="ob-later" @click="a.notifications = 'later'; go(step + 1)">Not now</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import VoToggle from '@/components/voiceover/VoToggle.vue';
import { clingLock, lockAvailable } from '@/native/clingNative';
import { LOCK_PREF } from '@/utils/appLock';
import { playVoice, stopVoice, unlockVoice, voUnlocked } from '@/composables/useVoiceover';
import { getMode, getPendingManagerToken } from '@/utils/appMode';
import { useRoute, useRouter } from 'vue-router';
import AppStoreButton from '@/components/AppStoreButton.vue';
import { auth } from '@/firebaseConfig';
import { ensureUserDoc, saveUserFields } from '@/utils/userDoc';
import { isNativeIOS } from '@/utils/platform';
import { requestNativePushPermission, getNativePushState } from '@/utils/nativePush';
import PaywallPanel from '@/components/paywall/PaywallPanel.vue';
import { markReviewPending } from '@/utils/appReview';
import { markPaywallSeenLocal } from '@/utils/entryGuard';
import { readCachedPlan, useEightHour } from '@/composables/useEightHour';
import { requestWakePermissions, loadWake } from '@/composables/useWakeAlarm';
import { defaultAlarmTime, DEFAULT_ALARM_TIME } from '@/utils/wakeAlarm';
import { clearProCache } from '@/composables/usePro';
import { fmtWakeLabel } from '@/utils/eightHour';
import RobotCoach from '@/components/robot/RobotCoach.vue';
import { typicalMin } from '@/utils/typicalUsage';
import VaultApps from '@/components/vault/VaultApps.vue';
import { askAiQuiet } from '@/composables/useAi';
import { vaultView } from '@/utils/pointsVault';
import { localDateStr } from '@/utils/streak';

// 'alarm' (iOS app only): optional wake-up alarm opt-in right after the day-start step. index STEPS.length = paywall
const STEPS = ['welcome', 'whatsnew', 'age', 'goals', 'schedule', ...(isNativeIOS() ? ['alarm'] : []), 'strictness', 'notifications', ...(lockAvailable() ? ['applock', 'vault'] : [])];
const stepNo = (id) => STEPS.indexOf(id) - 1; // "Step N" counter: welcome + age are not numbered
const GOALS = [
  { id: 'work', e: '💼', l: 'Crush work tasks' }, { id: 'fitness', e: '💪', l: 'Work out consistently' },
  { id: 'study', e: '📚', l: 'Study & learn' }, { id: 'habits', e: '🚭', l: 'Break bad habits' },
  { id: 'home', e: '🏠', l: 'Keep life admin tidy' }, { id: 'procrastination', e: '⏳', l: 'Stop procrastinating' },
];
const STRICT = [
  { id: 'chill', e: '🙂', l: 'Chill', d: 'Gentle reminders, no pressure.' },
  { id: 'firm', e: '😤', l: 'Firm', d: 'Deadline warnings and daily reports.' },
  { id: 'drill', e: '🔥', l: 'Strict', d: 'Strict Coach mode — no excuses, breaks must be earned.' },
];
const route = useRoute(); const router = useRouter();
const step = ref(route.query.step === 'paywall' ? STEPS.length : Math.min(Number(route.query.step) || 0, STEPS.length));
const name = ref('');
const a = reactive({ goals: [], wakeTime: '07:00', deadline: '21:00', bedTime: '23:00', strictness: 'firm', bossMode: 'simple', notifications: 'unknown', age: null, wakeAlarm: 'unknown' });
// Wake-up alarm step: default 7:00 AM, or the chosen day start minus 30 min when known. Saved as users/{uid}.wakeAlarmEnabled + wakeAlarmTime.
const alarmTime = ref(DEFAULT_ALARM_TIME); const alarmBusy = ref(false);
const ageState = computed(() => { const n = Number(a.age); if (!a.age && a.age !== 0) return 'empty'; if (!Number.isInteger(n) || n < 1 || n > 100) return 'invalid'; return n < 13 ? 'under' : 'ok'; });
const bumpAge = (d) => { const n = Number(a.age) || 18; a.age = Math.max(1, Math.min(100, n + d)); };
// Voiceover: each screen plays its own segment as you advance (previous one stops). Manager-link arrivals get the manager welcome.
const isManagerCtx = () => !!getPendingManagerToken() || getMode() === 'manager';
const voKey = () => { const id = step.value >= STEPS.length ? 'paywall' : STEPS[step.value]; return id === 'welcome' && isManagerCtx() ? 'ob_welcome_manager' : `ob_${id}`; };
const narrate = () => playVoice(voKey());
const onFirstTap = () => { if (voUnlocked.value) return; unlockVoice(); setTimeout(narrate, 60); };
watch(step, () => narrate());
onBeforeUnmount(stopVoice);
const eh = useEightHour();
const wakeLabel = computed(() => fmtWakeLabel(eh.plan.value?.wakeTime || a.wakeTime) || '—');
// The paywall counts as "seen" the moment it is shown (local flag + users/{uid}.paywallSeenAt) so existing users get it at most once; Subs/Profile can still open it.
watch(step, (n) => { if (n === STEPS.length) { const u = auth.currentUser; if (u) { markPaywallSeenLocal(u.uid); saveUserFields(u.uid, { paywallSeenAt: new Date() }).catch(() => {}); } } }, { immediate: true });
const firstName = computed(() => (name.value || 'there').split(' ')[0]);
const busy = ref(false); // CTA is disabled while a native prompt (notifications, Screen Time, alarm) is open: no double taps
const ctaLabel = computed(() => (busy.value && STEPS[step.value] === 'applock' ? 'Opening Screen Time…' : { welcome: "Let's go", whatsnew: 'Nice, continue', alarm: 'Yes, turn it on', notifications: 'Turn on notifications', applock: 'Choose apps to block', vault: 'Start earning' }[STEPS[step.value]] || 'Continue'));
// Vault step: the apps just picked, with 0 pts earned = all locked, cheapest first (prices from on-device usage, same as Home).
const vaultItems = ref([]); const vaultWhy = ref(null);
// AI wording of each price (server task 'vault_why'); only when AI consent was already given (never prompts here). Any failure keeps the template line.
const explainVault = async (items) => { if (!items.length) return;
  const apps = items.map((r) => ({ id: r.id, label: r.label, hoursPerWeek: Math.max(1, Math.round(r.min * 7 / 60)), price: r.price, tasks: r.tasks, estimate: !!r.noData, boss: !!r.boss }));
  const d = await askAiQuiet('vault_why', { apps }); if (d && d.lines) vaultWhy.value = d.lines; };
const loadVault = async () => { try { const u = await clingLock.vaultUsage(); vaultItems.value = vaultView({ apps: (u && u.apps) || [], days: (u && u.days) || {}, todayYmd: localDateStr(), points: 0, typical: typicalMin }).items; explainVault(vaultItems.value); } catch (e) { vaultItems.value = []; } };
watch(step, (n) => { if (STEPS[n] === 'vault' && !vaultItems.value.length) loadVault(); }, { immediate: true });
const toggle = (id) => { const i = a.goals.indexOf(id); i < 0 ? a.goals.push(id) : a.goals.splice(i, 1); };

onMounted(async () => {
  const u = auth.currentUser; if (!u) return;
  const cp = readCachedPlan(); if (cp) a.wakeTime = cp.wakeTime; alarmTime.value = defaultAlarmTime((cp && cp.wakeTime) || eh.plan.value?.wakeTime); // the wake time is picked in the pre-signup tutorial (and locked into the 8-hour day), not here
  try { const d = await ensureUserDoc(u); name.value = d.name || u.displayName || '';
    if (d.age) a.age = d.age;
    if (d.onboarding) Object.assign(a, d.onboarding, cp ? { wakeTime: cp.wakeTime } : {}); } catch (e) { console.error('onboarding load', e.message); }
});
const persist = (extra = {}) => { const u = auth.currentUser; if (!u) return Promise.resolve();
  return saveUserFields(u.uid, { onboarding: { ...a }, bossMode: a.bossMode === 'strict' ? 'strict' : 'simple', ...extra }).catch((e) => console.error('onboarding save', e.message)); };
function go(n) {
  if (STEPS[step.value] === 'age' && n > step.value) { if (ageState.value !== 'ok') return; if (auth.currentUser) saveUserFields(auth.currentUser.uid, { age: Number(a.age), ageCollectedAt: new Date() }).catch(() => {}); }
  step.value = n; router.replace({ query: { ...route.query, step: n } }); persist(); }
async function next() {
  if (busy.value) return; busy.value = true;
  try { await nextStep(); } finally { busy.value = false; }
}
async function nextStep() {
  if (STEPS[step.value] === 'notifications') {
    try {
      if (isNativeIOS()) { // iOS app: ask through the native OneSignal prompt (the web Notification API does not exist in WKWebView)
        const ok = await requestNativePushPermission();
        a.notifications = ok ? 'granted' : (await getNativePushState()).status === 'denied' ? 'denied' : 'default';
      } else if ('Notification' in window) a.notifications = await Notification.requestPermission();
    } catch (e) { a.notifications = 'error'; }
  }
  if (STEPS[step.value] === 'alarm') { // "Yes, turn it on": enable + save the time, and ask for Alarms (AlarmKit) + notification permission now
    const u = auth.currentUser; alarmBusy.value = true;
    if (u) { await saveUserFields(u.uid, { wakeAlarmEnabled: true, wakeAlarmTime: alarmTime.value }).catch(() => {}); clearProCache(); }
    a.wakeAlarm = 'on'; await requestWakePermissions().catch(() => {}); if (u) loadWake(u.uid, true).catch(() => {});
    alarmBusy.value = false;
  }
  if (STEPS[step.value] === 'applock') {
    const auth0 = await clingLock.requestAuthorization();
    if (auth0.status === 'approved') { const r = await clingLock.pickApps(); if (r.saved && (r.apps + r.categories + r.sites) > 0) { try { localStorage.setItem(LOCK_PREF, '1'); } catch (e) { /* ignore */ } a.appLock = 'on'; } else a.appLock = 'none'; }
    else a.appLock = auth0.status || 'denied';
    if (a.appLock === 'on') await loadVault(); else return go(step.value + 2); // no apps chosen: no vault step
  }
  go(step.value + 1);
}
async function finish() { await persist({ onboardingComplete: true, onboardingCompletedAt: new Date() });
  if (auth.currentUser) markReviewPending(auth.currentUser.uid); // one-time App Store rating prompt on the next /home landing (after this paywall closed)
  const from = String(route.query.from || ''); router.push(from.startsWith('/') && !from.startsWith('//') ? from : '/home'); }
</script>

<style scoped>
.ob-asb { margin-top: 16px; }
.ob { min-height: 100vh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; padding: calc(14px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); color: var(--c-text,#F2F5FC); }
.ob-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; }
.ob-back { background: none; border: 0; color: #A9B4CC; font-size: 28px; line-height: 1; cursor: pointer; width: 32px; }
.ob-skip { background: none; border: 0; color: #7180A0; font-weight: 600; font-size: 14px; cursor: pointer; min-height: 44px; min-width: 44px; padding: 0 10px; }
.ob-dots { display: flex; gap: 6px; flex: 1; } .ob-dots i { flex: 1; height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); } .ob-dots i { transition: background .25s ease; } .ob-dots i.on { background: linear-gradient(90deg,#1E5BFF,#3C8CFF); }
.ob-sec { flex: 1; padding-top: 18px; }
.ob-art { height: 220px; margin: 0 -20px 10px; background: linear-gradient(180deg, rgba(7,13,28,.1), rgba(7,13,28,.3) 55%, #070D1C), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 35%/cover; border-radius: 0 0 24px 24px; }
.ob-k { margin: 8px 0 0; font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #5E9BFF; }
.ob-h { margin: 4px 0 10px; font-size: 30px; line-height: 36px; font-weight: 800; letter-spacing: -.02em; color: #fff; } .ob-h span { color: #3D8BFF; }
.ob-p { color: #A9B4CC; line-height: 1.55; margin: 0 0 18px; }
.ob-vault { display: grid; gap: 8px; margin: 0 0 18px; color: #A9B4CC; font-size: .95rem; text-align: left; }
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ob-opt, .ob-row { text-align: left; font: inherit; color: inherit; cursor: pointer; border-radius: 16px; border: 1.5px solid #2A3C66; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); padding: 14px; font-weight: 600; font-size: 14px; }
.ob-opt .em { display: block; font-size: 24px; margin-bottom: 6px; }
.ob-opt.on, .ob-row.on { border-color: #3C8CFF; background: #10204A; box-shadow: 0 0 0 3px rgba(47,111,255,.22); }
.ob-boss { margin: 4px 0 0; font-size: 14px; color: #A9B4CC; } .ob-boss small { display: block; margin-top: 4px; font-size: 12px; }
.ob-boss-opt { font: inherit; font-weight: 600; color: inherit; margin-left: 6px; padding: 4px 12px; border-radius: 999px; border: 1.5px solid #2A3C66; background: none; cursor: pointer; } .ob-boss-opt.on { border-color: #3C8CFF; background: #10204A; color: #fff; }
.ob-row { width: 100%; display: flex; gap: 14px; align-items: center; margin-bottom: 10px; } .ob-row .em { font-size: 28px; } .ob-row b { display: block; font-size: 16px; } .ob-row small { color: #A9B4CC; font-weight: 500; font-size: 13px; }
.ob-field { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; margin-bottom: 10px; border-radius: 16px; border: 1px solid #2A3C66; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); font-weight: 600; }
.ob-field input { width: 160px; text-align: right; font-size: 18px; font-weight: 700; color-scheme: dark; }
.ob-small { font-size: 13px; margin-top: 4px; }
.ob-bell { font-size: 64px; text-align: center; margin: 20px 0 6px; filter: drop-shadow(0 10px 30px rgba(47,111,255,.5)); }
.ob-note { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 16px; background: rgba(18,32,63,.92); border: 1px solid #2A3C66; font-size: 14px; } .ob-note span { color: #A9B4CC; }
.ob-foot { padding-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.ob-cta { min-height: 56px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 800; color: #fff; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); box-shadow: 0 10px 26px rgba(47,111,255,.35); cursor: pointer; }
.ob-cta:disabled { opacity: .45; box-shadow: none; }
.ob-cta[aria-busy="true"] { opacity: .7; }
.ob-step-enter-active, .ob-step-leave-active { transition: opacity .18s ease, transform .18s ease; }
.ob-step-enter-from { opacity: 0; transform: translateX(14px); } .ob-step-leave-to { opacity: 0; transform: translateX(-14px); }
@media (prefers-reduced-motion: reduce) { .ob-step-enter-active, .ob-step-leave-active { transition: none; } .ob-dots i { transition: none; } }
.ob-later { background: none; border: 0; color: #7180A0; font-weight: 600; padding: 8px; cursor: pointer; }
.ob-vo { margin-left: auto; }
.ob-age { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 18px 0; }
.ob-age input { width: 120px; text-align: center; font-size: 40px; font-weight: 800; padding: 10px; border-radius: 16px; border: 1.5px solid #2A3C66; background: rgba(18,32,63,.92); color: #fff; color-scheme: dark; }
.ob-step { width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid #2A3C66; background: #10204A; color: #fff; font-size: 26px; cursor: pointer; }
.ob-warn { color: #FFB4A8; background: rgba(255,90,70,.1); border: 1px solid rgba(255,90,70,.35); border-radius: 12px; padding: 10px 12px; font-size: 14px; }
</style>
