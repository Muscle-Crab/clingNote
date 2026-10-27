<template>
  <div class="ob" @pointerdown.capture="onFirstTap">
    <PaywallPanel v-if="step === STEPS.length" :name="firstName" @close="finish" />
    <template v-else>
      <div class="ob-top">
        <button v-if="step > 0" class="ob-back" @click="go(step - 1)" aria-label="Back">‹</button><span v-else></span>
        <div class="ob-dots"><i v-for="(s, i) in STEPS" :key="s" :class="{ on: i <= step }"></i></div>
        <VoToggle class="ob-vo" @unmuted="narrate" /><button v-if="STEPS[step] !== 'age'" class="ob-skip" @click="go(ageState === 'ok' ? STEPS.length : 1)">Skip</button>
      </div>

      <section v-if="STEPS[step] === 'welcome'" class="ob-sec">
        <div class="ob-art"></div>
        <p class="ob-k">Welcome</p>
        <h1 class="ob-h">Hey {{ firstName }}, meet your <span>robot coach.</span></h1>
        <p class="ob-p">ClingNote clings to your to‑dos until they're done. A few quick questions and we'll set it up around you.</p>
        <div class="ob-asb"><AppStoreButton small /></div>
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
        <p class="ob-k">Step 1</p><h1 class="ob-h">What do you want to <span>nail?</span></h1><p class="ob-p">Pick all that apply.</p>
        <div class="ob-grid">
          <button v-for="g in GOALS" :key="g.id" class="ob-opt" :class="{ on: a.goals.includes(g.id) }" @click="toggle(g.id)"><span class="em">{{ g.e }}</span>{{ g.l }}</button>
        </div>
      </section>

      <section v-else-if="STEPS[step] === 'schedule'" class="ob-sec">
        <p class="ob-k">Step 2</p><h1 class="ob-h">Your daily <span>rhythm</span></h1><p class="ob-p">We'll nudge you to start your day and wrap it up on time.</p>
        <div class="ob-field" data-test="ob-wake-locked"><span>☀️ Your day can start from</span><b>{{ wakeLabel }}</b></div>
        <p class="ob-p ob-small">You picked this before signing up. Each morning you pick 3 to 12 hours and confirm. Once confirmed, those hours are locked.</p>
        <label class="ob-field"><span>🎯 Tasks done by</span><input type="time" v-model="a.deadline" /></label>
        <label class="ob-field"><span>🌙 Bedtime</span><input type="time" v-model="a.bedTime" /></label>
      </section>

      <section v-else-if="STEPS[step] === 'strictness'" class="ob-sec">
        <p class="ob-k">Step 3</p><h1 class="ob-h">How strict should <span>your robot</span> be?</h1>
        <button v-for="s in STRICT" :key="s.id" class="ob-row" :class="{ on: a.strictness === s.id }" @click="a.strictness = s.id">
          <RobotCoach v-if="s.id === 'drill'" class="em em-sgt" :size="44" :talking="a.strictness === 'drill'" /><span v-else class="em">{{ s.e }}</span><span><b>{{ s.l }}</b><small>{{ s.d }}</small></span>
        </button>
      </section>

      <section v-else-if="STEPS[step] === 'notifications'" class="ob-sec">
        <div class="ob-bell">🔔</div>
        <p class="ob-k">Step 4</p><h1 class="ob-h">Let your robot <span>reach you</span></h1>
        <p class="ob-p">Notifications are how ClingNote keeps you honest: start‑of‑day prompts, deadline warnings and robot check‑ins. No spam.</p>
        <div class="ob-note"><b>⏰ 9:00 PM · ClingNote</b><span>2 tasks left before your deadline. Let's finish strong 💪</span></div>
      </section>

      <section v-else-if="STEPS[step] === 'applock'" class="ob-sec" data-test="ob-applock">
        <div class="ob-bell">🔒</div>
        <p class="ob-k">Step 5</p><h1 class="ob-h">Lock your <span>distractions</span></h1>
        <p class="ob-p">Pick apps to block while you're locked in. They unlock when your tasks or points goal are done, or when your hours end. Optional, and you can change it later.</p>
        <p v-if="a.appLock" class="ob-p">{{ a.appLock }}</p>
      </section>

      <div class="ob-foot">
        <button class="ob-cta" :disabled="(STEPS[step] === 'goals' && !a.goals.length) || (STEPS[step] === 'age' && ageState !== 'ok')" @click="next">{{ ctaLabel }}</button>
        <button v-if="STEPS[step] === 'applock'" class="ob-later" @click="a.appLock = 'later'; go(step + 1)">Not now</button>
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
import { fmtWakeLabel } from '@/utils/eightHour';
import RobotCoach from '@/components/robot/RobotCoach.vue';

const STEPS = ['welcome', 'age', 'goals', 'schedule', 'strictness', 'notifications', ...(lockAvailable() ? ['applock'] : [])]; // index STEPS.length = paywall
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
const step = ref(Math.min(Number(route.query.step) || 0, STEPS.length));
const name = ref('');
const a = reactive({ goals: [], wakeTime: '07:00', deadline: '21:00', bedTime: '23:00', strictness: 'firm', notifications: 'unknown', age: null });
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
const ctaLabel = computed(() => ({ welcome: "Let's go", notifications: 'Turn on notifications', applock: 'Choose apps to block' }[STEPS[step.value]] || 'Continue'));
const toggle = (id) => { const i = a.goals.indexOf(id); i < 0 ? a.goals.push(id) : a.goals.splice(i, 1); };

onMounted(async () => {
  const u = auth.currentUser; if (!u) return;
  const cp = readCachedPlan(); if (cp) a.wakeTime = cp.wakeTime; // the wake time is picked in the pre-signup tutorial (and locked into the 8-hour day), not here
  try { const d = await ensureUserDoc(u); name.value = d.name || u.displayName || '';
    if (d.age) a.age = d.age;
    if (d.onboarding) Object.assign(a, d.onboarding, cp ? { wakeTime: cp.wakeTime } : {}); } catch (e) { console.error('onboarding load', e.message); }
});
const persist = (extra = {}) => { const u = auth.currentUser; if (!u) return Promise.resolve();
  return saveUserFields(u.uid, { onboarding: { ...a }, ...extra }).catch((e) => console.error('onboarding save', e.message)); };
function go(n) {
  if (STEPS[step.value] === 'age' && n > step.value) { if (ageState.value !== 'ok') return; if (auth.currentUser) saveUserFields(auth.currentUser.uid, { age: Number(a.age), ageCollectedAt: new Date() }).catch(() => {}); }
  step.value = n; router.replace({ query: { ...route.query, step: n } }); persist(); }
async function next() {
  if (STEPS[step.value] === 'notifications') {
    try {
      if (isNativeIOS()) { // iOS app: ask through the native OneSignal prompt (the web Notification API does not exist in WKWebView)
        const ok = await requestNativePushPermission();
        a.notifications = ok ? 'granted' : (await getNativePushState()).status === 'denied' ? 'denied' : 'default';
      } else if ('Notification' in window) a.notifications = await Notification.requestPermission();
    } catch (e) { a.notifications = 'error'; }
  }
  if (STEPS[step.value] === 'applock') {
    const auth0 = await clingLock.requestAuthorization();
    if (auth0.status === 'approved') { const r = await clingLock.pickApps(); if (r.saved && (r.apps + r.categories + r.sites) > 0) { try { localStorage.setItem(LOCK_PREF, '1'); } catch (e) { /* ignore */ } a.appLock = 'on'; } else a.appLock = 'none'; }
    else a.appLock = auth0.status || 'denied';
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
.ob-dots { display: flex; gap: 6px; flex: 1; } .ob-dots i { flex: 1; height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); } .ob-dots i.on { background: linear-gradient(90deg,#1E5BFF,#3C8CFF); }
.ob-sec { flex: 1; padding-top: 18px; }
.ob-art { height: 220px; margin: 0 -20px 10px; background: linear-gradient(180deg, rgba(7,13,28,.1), rgba(7,13,28,.3) 55%, #070D1C), var(--hero-img, url('~@/assets/hero-forest.jpg')) 72% 35%/cover; border-radius: 0 0 24px 24px; }
.ob-k { margin: 8px 0 0; font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #5E9BFF; }
.ob-h { margin: 4px 0 10px; font-size: 30px; line-height: 36px; font-weight: 800; letter-spacing: -.02em; color: #fff; } .ob-h span { color: #3D8BFF; }
.ob-p { color: #A9B4CC; line-height: 1.55; margin: 0 0 18px; }
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ob-opt, .ob-row { text-align: left; font: inherit; color: inherit; cursor: pointer; border-radius: 16px; border: 1.5px solid #2A3C66; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); padding: 14px; font-weight: 600; font-size: 14px; }
.ob-opt .em { display: block; font-size: 24px; margin-bottom: 6px; }
.ob-opt.on, .ob-row.on { border-color: #3C8CFF; background: #10204A; box-shadow: 0 0 0 3px rgba(47,111,255,.22); }
.ob-row { width: 100%; display: flex; gap: 14px; align-items: center; margin-bottom: 10px; } .ob-row .em { font-size: 28px; } .ob-row b { display: block; font-size: 16px; } .ob-row small { color: #A9B4CC; font-weight: 500; font-size: 13px; }
.ob-field { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; margin-bottom: 10px; border-radius: 16px; border: 1px solid #2A3C66; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); font-weight: 600; }
.ob-field input { width: 160px; text-align: right; font-size: 18px; font-weight: 700; color-scheme: dark; }
.ob-small { font-size: 13px; margin-top: 4px; }
.ob-bell { font-size: 64px; text-align: center; margin: 20px 0 6px; filter: drop-shadow(0 10px 30px rgba(47,111,255,.5)); }
.ob-note { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 16px; background: rgba(18,32,63,.92); border: 1px solid #2A3C66; font-size: 14px; } .ob-note span { color: #A9B4CC; }
.ob-foot { padding-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.ob-cta { min-height: 56px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 800; color: #fff; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); box-shadow: 0 10px 26px rgba(47,111,255,.35); cursor: pointer; }
.ob-cta:disabled { opacity: .45; box-shadow: none; }
.ob-later { background: none; border: 0; color: #7180A0; font-weight: 600; padding: 8px; cursor: pointer; }
.ob-vo { margin-left: auto; }
.ob-age { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 18px 0; }
.ob-age input { width: 120px; text-align: center; font-size: 40px; font-weight: 800; padding: 10px; border-radius: 16px; border: 1.5px solid #2A3C66; background: rgba(18,32,63,.92); color: #fff; color-scheme: dark; }
.ob-step { width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid #2A3C66; background: #10204A; color: #fff; font-size: 26px; cursor: pointer; }
.ob-warn { color: #FFB4A8; background: rgba(255,90,70,.1); border: 1px solid rgba(255,90,70,.35); border-radius: 12px; padding: 10px 12px; font-size: 14px; }
</style>
