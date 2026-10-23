<template>
  <div class="ob">
    <PaywallPanel v-if="step === STEPS.length" :name="firstName" @close="finish" />
    <template v-else>
      <div class="ob-top">
        <button v-if="step > 0" class="ob-back" @click="go(step - 1)" aria-label="Back">‹</button><span v-else></span>
        <div class="ob-dots"><i v-for="(s, i) in STEPS" :key="s" :class="{ on: i <= step }"></i></div>
        <button class="ob-skip" @click="go(STEPS.length)">Skip</button>
      </div>

      <section v-if="STEPS[step] === 'welcome'" class="ob-sec">
        <div class="ob-art"></div>
        <p class="ob-k">Welcome</p>
        <h1 class="ob-h">Hey {{ firstName }}, meet your <span>accountability boss.</span></h1>
        <p class="ob-p">ClingNot clings to your to‑dos until they're done. A few quick questions and we'll set it up around you.</p>
      </section>

      <section v-else-if="STEPS[step] === 'goals'" class="ob-sec">
        <p class="ob-k">Step 1</p><h1 class="ob-h">What do you want to <span>nail?</span></h1><p class="ob-p">Pick all that apply.</p>
        <div class="ob-grid">
          <button v-for="g in GOALS" :key="g.id" class="ob-opt" :class="{ on: a.goals.includes(g.id) }" @click="toggle(g.id)"><span class="em">{{ g.e }}</span>{{ g.l }}</button>
        </div>
      </section>

      <section v-else-if="STEPS[step] === 'schedule'" class="ob-sec">
        <p class="ob-k">Step 2</p><h1 class="ob-h">Your daily <span>rhythm</span></h1><p class="ob-p">We'll nudge you to start your day and wrap it up on time.</p>
        <label class="ob-field"><span>☀️ Wake up</span><input type="time" v-model="a.wakeTime" /></label>
        <label class="ob-field"><span>🎯 Tasks done by</span><input type="time" v-model="a.deadline" /></label>
        <label class="ob-field"><span>🌙 Bedtime</span><input type="time" v-model="a.bedTime" /></label>
      </section>

      <section v-else-if="STEPS[step] === 'strictness'" class="ob-sec">
        <p class="ob-k">Step 3</p><h1 class="ob-h">How strict should <span>the boss</span> be?</h1>
        <button v-for="s in STRICT" :key="s.id" class="ob-row" :class="{ on: a.strictness === s.id }" @click="a.strictness = s.id">
          <span class="em">{{ s.e }}</span><span><b>{{ s.l }}</b><small>{{ s.d }}</small></span>
        </button>
      </section>

      <section v-else-if="STEPS[step] === 'notifications'" class="ob-sec">
        <div class="ob-bell">🔔</div>
        <p class="ob-k">Step 4</p><h1 class="ob-h">Let the boss <span>reach you</span></h1>
        <p class="ob-p">Notifications are how ClingNot keeps you honest: start‑of‑day prompts, deadline warnings and boss check‑ins. No spam.</p>
        <div class="ob-note"><b>⏰ 9:00 PM · ClingNot</b><span>2 tasks left before your deadline. Boss is watching 👀</span></div>
      </section>

      <div class="ob-foot">
        <button class="ob-cta" :disabled="STEPS[step] === 'goals' && !a.goals.length" @click="next">{{ ctaLabel }}</button>
        <button v-if="STEPS[step] === 'notifications'" class="ob-later" @click="a.notifications = 'later'; go(step + 1)">Not now</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth } from '@/firebaseConfig';
import { ensureUserDoc, saveUserFields } from '@/utils/userDoc';
import PaywallPanel from '@/components/paywall/PaywallPanel.vue';

const STEPS = ['welcome', 'goals', 'schedule', 'strictness', 'notifications']; // index STEPS.length = paywall
const GOALS = [
  { id: 'work', e: '💼', l: 'Crush work tasks' }, { id: 'fitness', e: '💪', l: 'Work out consistently' },
  { id: 'study', e: '📚', l: 'Study & learn' }, { id: 'habits', e: '🚭', l: 'Break bad habits' },
  { id: 'home', e: '🏠', l: 'Keep life admin tidy' }, { id: 'procrastination', e: '⏳', l: 'Stop procrastinating' },
];
const STRICT = [
  { id: 'chill', e: '🙂', l: 'Chill', d: 'Gentle reminders, no pressure.' },
  { id: 'firm', e: '😤', l: 'Firm', d: 'Deadline warnings and daily reports.' },
  { id: 'drill', e: '🔥', l: 'Drill sergeant', d: 'Strict boss mode — no excuses, breaks must be earned.' },
];
const route = useRoute(); const router = useRouter();
const step = ref(Math.min(Number(route.query.step) || 0, STEPS.length));
const name = ref('');
const a = reactive({ goals: [], wakeTime: '07:00', deadline: '21:00', bedTime: '23:00', strictness: 'firm', notifications: 'unknown' });
const firstName = computed(() => (name.value || 'there').split(' ')[0]);
const ctaLabel = computed(() => ({ welcome: "Let's go", notifications: 'Turn on notifications' }[STEPS[step.value]] || 'Continue'));
const toggle = (id) => { const i = a.goals.indexOf(id); i < 0 ? a.goals.push(id) : a.goals.splice(i, 1); };

onMounted(async () => {
  const u = auth.currentUser; if (!u) return;
  try { const d = await ensureUserDoc(u); name.value = d.name || u.displayName || '';
    if (d.onboarding) Object.assign(a, d.onboarding); } catch (e) { console.error('onboarding load', e.message); }
});
const persist = (extra = {}) => { const u = auth.currentUser; if (!u) return Promise.resolve();
  return saveUserFields(u.uid, { onboarding: { ...a }, ...extra }).catch((e) => console.error('onboarding save', e.message)); };
function go(n) { step.value = n; router.replace({ query: { ...route.query, step: n } }); persist(); }
async function next() {
  if (STEPS[step.value] === 'notifications') {
    try { if ('Notification' in window) a.notifications = await Notification.requestPermission(); } catch (e) { a.notifications = 'error'; }
  }
  go(step.value + 1);
}
async function finish() { await persist({ onboardingComplete: true, onboardingCompletedAt: new Date() });
  const from = String(route.query.from || ''); router.push(from.startsWith('/') && !from.startsWith('//') ? from : '/home'); }
</script>

<style scoped>
.ob { min-height: 100vh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; padding: calc(14px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); color: var(--c-text,#F2F5FC); }
.ob-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; }
.ob-back { background: none; border: 0; color: #A9B4CC; font-size: 28px; line-height: 1; cursor: pointer; width: 32px; }
.ob-skip { background: none; border: 0; color: #7180A0; font-weight: 600; font-size: 14px; cursor: pointer; }
.ob-dots { display: flex; gap: 6px; flex: 1; } .ob-dots i { flex: 1; height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); } .ob-dots i.on { background: linear-gradient(90deg,#1E5BFF,#3C8CFF); }
.ob-sec { flex: 1; padding-top: 18px; }
.ob-art { height: 220px; margin: 0 -20px 10px; background: linear-gradient(180deg, rgba(7,13,28,.1), rgba(7,13,28,.3) 55%, #070D1C), url('~@/assets/hero-forest.jpg') 72% 35%/cover; border-radius: 0 0 24px 24px; }
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
.ob-bell { font-size: 64px; text-align: center; margin: 20px 0 6px; filter: drop-shadow(0 10px 30px rgba(47,111,255,.5)); }
.ob-note { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 16px; background: rgba(18,32,63,.92); border: 1px solid #2A3C66; font-size: 14px; } .ob-note span { color: #A9B4CC; }
.ob-foot { padding-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.ob-cta { min-height: 56px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 800; color: #fff; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); box-shadow: 0 10px 26px rgba(47,111,255,.35); cursor: pointer; }
.ob-cta:disabled { opacity: .45; box-shadow: none; }
.ob-later { background: none; border: 0; color: #7180A0; font-weight: 600; padding: 8px; cursor: pointer; }
</style>
