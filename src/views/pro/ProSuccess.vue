<template>
  <div class="ps" data-test="pro-success">
    <div class="ps-glow" aria-hidden="true"></div>
    <div class="ps-badge" :class="state" aria-hidden="true">
      <span v-if="state === 'confirmed'">★</span>
      <span v-else-if="state === 'pending'" class="ps-spin"></span>
      <span v-else>⏳</span>
    </div>

    <p class="ps-k">{{ state === 'confirmed' ? 'Welcome to Pro' : 'Payment received' }}</p>
    <h1 class="ps-h" v-if="state === 'confirmed'">You're <span>Pro</span>.</h1>
    <h1 class="ps-h" v-else-if="state === 'pending'">Activating <span>Pro</span>…</h1>
    <h1 class="ps-h" v-else>Almost <span>there</span>.</h1>

    <div class="ps-card">
      <div class="ps-row"><span>Plan</span><b data-test="plan-name">{{ planLabel }}</b></div>
      <div class="ps-row" v-if="planInfo"><span>Price</span><b>{{ priceText }}</b></div>
      <div class="ps-row"><span>Status</span>
        <b :class="'st-' + state" data-test="pro-status">{{ state === 'confirmed' ? 'Active ✓' : state === 'pending' ? 'Confirming…' : 'Processing' }}</b>
      </div>
    </div>

    <p class="ps-p" v-if="state === 'confirmed'">Strict Boss, AI coach and your private calendar feed are unlocked. Go crush today.</p>
    <p class="ps-p" v-else-if="state === 'pending'">Hang tight — we're confirming your payment with Stripe. This usually takes a few seconds.</p>
    <p class="ps-p" v-else>Your payment went through, but confirmation is taking longer than usual. Pro will switch on automatically within a minute or two — no need to pay again.</p>

    <ul class="ps-perks" v-if="state === 'confirmed'">
      <li>🔥 Strict Boss mode</li><li>🤖 AI workout &amp; meal coach</li><li>📆 Calendar feed</li>
    </ul>

    <button class="ps-cta" data-test="go-home" @click="goHome">Go to Home</button>
    <button v-if="state === 'timeout'" class="ps-link" data-test="recheck" @click="poll">Check again</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { isPro } from '@/utils/pro';
import { planById, fmt } from '@/config/pricing';
import { clearProCache } from '@/composables/usePro';

const route = useRoute(); const router = useRouter();
const state = ref('pending'); // pending | confirmed | timeout
const docPlan = ref(null);
const POLL_MS = 1500, TIMEOUT_MS = 20000;
let timer = null, stopped = false;

const planId = computed(() => docPlan.value || (typeof route.query.plan === 'string' ? route.query.plan : null));
const planInfo = computed(() => (planId.value ? planById(planId.value) : null));
const planLabel = computed(() => (planInfo.value ? `CleanNote Pro · ${planInfo.value.label}` : 'CleanNote Pro'));
const priceText = computed(() => { const p = planInfo.value; if (!p) return '';
  if (p.period === 'once') return `${fmt(p.price)} once`;
  return p.trialDays ? `${p.trialDays}-day free trial, then ${fmt(p.price)}/${p.period}` : `${fmt(p.price)}/${p.period}`; });

async function check() {
  const u = auth.currentUser; if (!u) return false;
  try { const s = await getDoc(doc(db, 'users', u.uid)); const d = s.exists() ? s.data() : null;
    if (d?.plan) docPlan.value = d.plan;
    return isPro(d);
  } catch (e) { console.error('pro poll', e.message); return false; }
}
async function poll() {
  clearTimeout(timer); state.value = 'pending'; stopped = false;
  const start = Date.now();
  const tick = async () => {
    if (stopped) return;
    if (await check()) { state.value = 'confirmed'; clearProCache(); return; }
    if (Date.now() - start >= TIMEOUT_MS) { state.value = 'timeout'; return; }
    timer = setTimeout(tick, POLL_MS);
  };
  tick();
}
function goHome() { clearProCache(); router.push('/home'); }
onMounted(poll);
onBeforeUnmount(() => { stopped = true; clearTimeout(timer); });
</script>

<style scoped>
.ps { position: relative; min-height: 100vh; max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: calc(48px + env(safe-area-inset-top)) 22px calc(28px + env(safe-area-inset-bottom)); color: var(--c-text,#F2F5FC); overflow: hidden; }
.ps-glow { position: absolute; top: -120px; left: 50%; transform: translateX(-50%); width: 420px; height: 420px; border-radius: 50%;
  background: radial-gradient(circle, rgba(47,111,255,.35), rgba(47,111,255,0) 65%); pointer-events: none; }
.ps-badge { position: relative; width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; font-size: 44px; color: #fff;
  background: linear-gradient(135deg,#1E5BFF,#3C8CFF); box-shadow: 0 16px 40px rgba(47,111,255,.5), 0 0 0 6px rgba(47,111,255,.15); }
.ps-badge.confirmed { background: linear-gradient(135deg,#f59e0b,#ea580c); box-shadow: 0 16px 40px rgba(234,88,12,.45), 0 0 0 6px rgba(245,158,11,.15); animation: pop .5s ease-out; }
.ps-badge.timeout { background: #10204A; border: 1.5px solid #2A3C66; box-shadow: none; font-size: 36px; }
.ps-spin { width: 38px; height: 38px; border-radius: 50%; border: 4px solid rgba(255,255,255,.3); border-top-color: #fff; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop { 0% { transform: scale(.6); } 70% { transform: scale(1.1); } 100% { transform: scale(1); } }
.ps-k { margin: 22px 0 0; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #5E9BFF; }
.ps-h { margin: 6px 0 16px; font-size: 34px; line-height: 40px; font-weight: 800; letter-spacing: -.02em; color: #fff; } .ps-h span { color: #3D8BFF; }
.ps-card { width: 100%; border-radius: 16px; border: 1px solid #2A3C66; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); padding: 6px 16px; }
.ps-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; font-size: 14px; } .ps-row + .ps-row { border-top: 1px solid rgba(42,60,102,.6); }
.ps-row span { color: #A9B4CC; } .ps-row b { text-align: right; }
.st-confirmed { color: #3DDC97; } .st-pending { color: #7FB0FF; } .st-timeout { color: #FBBF24; }
.ps-p { color: #A9B4CC; line-height: 1.55; margin: 18px 4px 6px; font-size: 15px; }
.ps-perks { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.ps-perks li { font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 999px; background: #10204A; border: 1px solid #24448F; color: #CFE0FF; }
.ps-cta { margin-top: auto; width: 100%; min-height: 56px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 800; color: #fff;
  background: linear-gradient(90deg,#1E5BFF,#3C8CFF); box-shadow: 0 10px 26px rgba(47,111,255,.4); cursor: pointer; }
.ps-card + .ps-p, .ps-perks { } .ps-perks + .ps-cta, .ps-p + .ps-cta { margin-top: 28px; }
.ps-link { background: none; border: 0; color: #7180A0; font-weight: 600; padding: 12px; cursor: pointer; }
</style>
