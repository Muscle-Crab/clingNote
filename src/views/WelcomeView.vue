<template>
  <div class="wl">
    <div class="wl-top">
      <button v-if="step > 0" class="wl-back" data-test="wl-back" @click="back" aria-label="Back">‹</button><span v-else class="wl-back"></span>
      <div class="wl-dots"><i v-for="(s, i) in STEPS" :key="s" :class="{ on: i <= step }"></i></div>
      <span class="wl-back"></span>
    </div>

    <section v-if="STEPS[step] === 'intro'" class="wl-sec" data-test="wl-intro">
      <p class="wl-k">Welcome to ClingNote</p>
      <h1 class="wl-h">Discipline, <span>not wishes.</span></h1>
      <p class="wl-p">ClingNote is a strict daily system. No streak-gaming, no editing the rules once you've started.</p>
      <ul class="wl-list">
        <li><span>☀️</span><div><b>Pick your wake time</b><small>Each morning you choose 3 to 12 hours, confirm, and your day runs from then.</small></div></li>
        <li><span>🔒</span><div><b>Your hours, locked</b><small>The task count, the points per task and the daily target are set when the day starts. No edits.</small></div></li>
        <li><span>🎯</span><div><b>Finish the goal</b><small>Hit the points target before the clock runs out.</small></div></li>
        <li><span>🔥</span><div><b>Build streaks, climb ranks</b><small>Miss a day and the streak pays for it.</small></div></li>
      </ul>
      <div class="wl-asb"><AppStoreButton /></div>
    </section>

    <section v-else-if="STEPS[step] === 'tour'" class="wl-sec wl-tour" data-test="wl-tour">
      <TutorialCarousel ref="carousel" v-model="slide" @last="sawLast = true" />
    </section>

    <section v-else-if="STEPS[step] === 'wake'" class="wl-sec" data-test="wl-wake">
      <p class="wl-k">Your day</p>
      <h1 class="wl-h">When do you <span>start?</span></h1>
      <p class="wl-p">Pick your wake time. From then, each morning you choose your hours (3 to 12) and confirm to start.</p>
      <label class="wl-field"><span>☀️ Wake time</span><input type="time" v-model="wake" data-test="wl-wake-input" /></label>
      <p class="wl-ends" data-test="wl-ends">Starts {{ wakeLabel }} · <b>ends based on the hours you pick each morning</b></p>
      <div class="wl-field wl-count"><span>✅ Tasks per day</span>
        <div class="wl-step"><button type="button" :disabled="taskCount <= 1" @click="taskCount--" aria-label="Fewer tasks" data-test="wl-count-dec">−</button><b data-test="wl-count">{{ taskCount }}</b><button type="button" :disabled="taskCount >= MAX_TASKS_PER_DAY" @click="taskCount++" aria-label="More tasks" data-test="wl-count-inc">+</button></div>
      </div>
      <p class="wl-p wl-small">1 to {{ MAX_TASKS_PER_DAY }}. You choose it before the day starts. Then it's locked. The app sets the points per task and your daily target.</p>
    </section>

    <section v-else class="wl-sec" data-test="wl-account">
      <p class="wl-k">Last step</p>
      <h1 class="wl-h">{{ signedIn ? 'You are in.' : 'Save your' }} <span>{{ signedIn ? 'Let\'s set up.' : 'plan.' }}</span></h1>
      <p class="wl-p">Your day starts at <b>{{ wakeLabel }}</b> and ends at <b>{{ endLabel }}</b>, with {{ taskCount }} task{{ taskCount === 1 ? '' : 's' }} per day. We save this to your account.</p>
      <div class="wl-note"><b>What happens next</b><span>{{ signedIn ? 'A few quick questions, then your plans.' : (native ? 'Sign in with Apple' : 'Sign in with Google') + ', answer a few quick questions, then choose a plan.' }}</span></div>
    </section>

    <div class="wl-foot">
      <template v-if="STEPS[step] === 'account'">
        <button v-if="!signedIn" class="wl-cta" data-test="wl-signin" @click="finish({ path: '/login', query: { returning: '1' } })">Continue to sign in</button>
        <button v-if="signedIn" class="wl-cta" data-test="wl-continue" :disabled="busy" @click="finishSignedIn">Continue</button>
      </template>
      <button v-else class="wl-cta" data-test="wl-next" :disabled="!canNext" @click="next">{{ nextLabel }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth } from '@/firebaseConfig';
import TutorialCarousel from '@/components/onboarding/TutorialCarousel.vue';
import AppStoreButton from '@/components/AppStoreButton.vue';
import { TOUR_SLIDES } from '@/assets/tour/slides';
import { markTutorialSeen } from '@/utils/entryGuard';
import { isNativeIOS } from '@/utils/platform';
const native = isNativeIOS(); // iOS app: Apple sign-in only; web: Google
import { cachePlan, readCachedPlan, syncAfterAuth, deviceTz } from '@/composables/useEightHour';
import { fmtWakeLabel, parseWake, MAX_TASKS_PER_DAY, WAKE_PICKER_PRESELECT, clampHours, hoursLabel } from '@/utils/eightHour';

// Pre-sign-up tutorial: explainer -> real-app screenshot carousel -> explicit wake pick -> sign-in (Apple/Google; no email sign-up). The user cannot leave it
// half-way: the only exits are the account actions on the last step (the flag is set there, once per install).
const STEPS = ['intro', 'tour', 'wake', 'account'];
const router = useRouter(); const route = useRoute();
const step = ref(0); const slide = ref(0); const sawLast = ref(false); const carousel = ref(null); const busy = ref(false);
const cached = readCachedPlan();
const wake = ref(cached?.wakeTime || WAKE_PICKER_PRESELECT); // pre-selected for convenience only: the pick still has to be confirmed
const taskCount = ref(Math.min(MAX_TASKS_PER_DAY, Math.max(1, Number(cached?.taskCount) || 3)));
const signedIn = computed(() => !!auth.currentUser && route.query.new === '1');

const hoursPrefW = clampHours((() => { try { return localStorage.getItem('clingnote.dayLengthHours.v1'); } catch (e) { return null; } })());
const hl = hoursLabel(hoursPrefW);
const wakeLabel = computed(() => fmtWakeLabel(wake.value) || '—');
const endLabel = computed(() => { const w = parseWake(wake.value); if (!w) return '—'; const t = (w.h * 60 + w.m + Math.round(hoursPrefW * 60)) % 1440; return fmtWakeLabel(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`); });
const lastSlide = TOUR_SLIDES.length - 1;
// The tour's button always works: it pages through the slides, and only after the last one does it move on.
const canNext = computed(() => (STEPS[step.value] === 'wake' ? !!parseWake(wake.value) : true));
const nextLabel = computed(() => (STEPS[step.value] === 'tour' && slide.value < lastSlide ? 'Next' : 'Continue'));

const next = () => {
  if (STEPS[step.value] === 'tour' && slide.value < lastSlide) { slide.value += 1; carousel.value?.goTo(slide.value); if (slide.value === lastSlide) sawLast.value = true; return; }
  if (STEPS[step.value] === 'wake' && parseWake(wake.value)) cachePlan({ wakeTime: wake.value, taskCount: taskCount.value, tz: deviceTz() });
  if (canNext.value && step.value < STEPS.length - 1) step.value += 1;
};
const back = () => { if (step.value > 0) step.value -= 1; };

const finish = (to) => { cachePlan({ wakeTime: wake.value, taskCount: taskCount.value, tz: deviceTz() }); markTutorialSeen(); router.push(to); };
const finishSignedIn = async () => {
  busy.value = true; cachePlan({ wakeTime: wake.value, taskCount: taskCount.value, tz: deviceTz() }); markTutorialSeen();
  try { await syncAfterAuth(); } catch (e) { /* the cached plan stays on the device and is retried at the next sign-in */ }
  busy.value = false; router.push('/onboarding');
};
</script>

<style scoped>
.wl-asb { margin-top: 18px; display: flex; justify-content: center; }
.wl { min-height: 100vh; min-height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; padding: calc(14px + env(safe-area-inset-top)) 20px calc(22px + env(safe-area-inset-bottom)); color: var(--c-text, #F2F5FC); background: #070D1C; }
.wl-top { display: flex; align-items: center; gap: 12px; min-height: 36px; }
.wl-back { width: 32px; background: none; border: 0; color: #A9B4CC; font-size: 28px; line-height: 1; cursor: pointer; }
.wl-dots { display: flex; gap: 6px; flex: 1; } .wl-dots i { flex: 1; height: 4px; border-radius: 4px; background: rgba(255, 255, 255, .1); } .wl-dots i.on { background: linear-gradient(90deg, #1E5BFF, #3C8CFF); }
.wl-sec { flex: 1; padding-top: 18px; display: flex; flex-direction: column; }
.wl-tour { justify-content: center; padding-top: 6px; }
.wl-k { margin: 8px 0 0; font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #5E9BFF; }
.wl-h { margin: 4px 0 10px; font-size: 32px; line-height: 38px; font-weight: 800; letter-spacing: -.02em; color: #fff; } .wl-h span { color: #3D8BFF; }
.wl-p { color: #A9B4CC; line-height: 1.55; margin: 0 0 16px; } .wl-small { font-size: 13px; margin-top: 4px; }
.wl-list { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.wl-list li { display: flex; gap: 14px; align-items: center; padding: 13px 14px; border-radius: 16px; border: 1px solid #2A3C66; background: linear-gradient(180deg, rgba(18, 32, 63, .92), rgba(12, 22, 48, .92)); }
.wl-list li > span { font-size: 26px; } .wl-list b { display: block; font-size: 16px; } .wl-list small { color: #A9B4CC; font-size: 13px; line-height: 1.4; }
.wl-field { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; margin-bottom: 10px; border-radius: 16px; border: 1px solid #2A3C66; background: linear-gradient(180deg, rgba(18, 32, 63, .92), rgba(12, 22, 48, .92)); font-weight: 600; }
.wl-field input { width: 178px; text-align: right; font-size: 19px; font-weight: 700; color-scheme: dark; }
.wl-ends { margin: 2px 0 14px; color: #A9B4CC; font-size: 15px; } .wl-ends b { color: #fff; }
.wl-step { display: flex; align-items: center; gap: 14px; } .wl-step b { font-size: 22px; min-width: 20px; text-align: center; }
.wl-step button { width: 40px; height: 40px; border-radius: 12px; border: 1px solid #2A3C66; background: #10204A; color: #fff; font-size: 22px; cursor: pointer; } .wl-step button:disabled { opacity: .35; }
.wl-confirm { margin-top: 10px; min-height: 52px; border-radius: 16px; border: 1.5px solid #3C8CFF; background: transparent; color: #8DB8FF; font: inherit; font-weight: 700; cursor: pointer; }
.wl-confirm.on { background: rgba(60, 140, 255, .16); color: #fff; }
.wl-note { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 16px; background: rgba(18, 32, 63, .92); border: 1px solid #2A3C66; font-size: 14px; } .wl-note span { color: #A9B4CC; }
.wl-foot { padding-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.wl-cta { min-height: 56px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 800; color: #fff; background: linear-gradient(90deg, #1E5BFF, #3C8CFF); box-shadow: 0 10px 26px rgba(47, 111, 255, .35); cursor: pointer; }
.wl-cta:disabled { opacity: .45; box-shadow: none; }
.wl-link { background: none; border: 0; color: #8DB8FF; font-weight: 600; padding: 8px; cursor: pointer; }
</style>
