<template>
  <div class="pw">
    <div class="pw-top">
      <button class="pw-link" @click="$emit('close')">Maybe later</button>
      <button class="pw-link" data-test="pw-restore" @click="restore">{{ ios ? 'Restore Purchases' : 'Restore' }}</button>
    </div>
    <h1 v-if="ios" class="pw-h" data-test="pw-heading">Unlock <span>ClingNote Pro</span></h1>
    <h1 v-else class="pw-h">We want you to try <span>ClingNote</span> for free.</h1>

    <ul v-if="ios" class="feats" data-test="pw-features">
      <li v-for="f in FEATURES" :key="f.t"><span class="fi">✓</span><span><b>{{ f.t }}</b><small>{{ f.d }}</small></span></li>
    </ul>

    <div v-else class="phone" aria-hidden="true">
      <div class="notch"></div>
      <div class="scr">
        <div class="ph-status"><span>9:41</span><span>▮▮▮</span></div>
        <div class="ph-hero"><p class="k">Today</p><p class="t">Good morning, <b>{{ name }}</b></p>
          <div class="ph-stats"><div><b>3🔥</b><small>streak</small></div><div><b>2/5</b><small>done</small></div><div><b>120</b><small>points</small></div></div>
        </div>
        <div class="ph-bar"><i style="width:40%"></i></div>
        <div v-for="(t,i) in demo" :key="i" class="ph-card" :class="{done:t.d, boss:t.b}">
          <span class="ck">{{ t.d ? '✓' : '' }}</span><span class="tt">{{ t.t }}</span><span v-if="t.b" class="bb">BOSS</span>
        </div>
        <div class="ph-fab">+</div>
      </div>
    </div>

    <div v-if="ios && iapState !== 'ready'" class="iap-state" data-test="pw-iap-state" :data-state="iapState" role="status">
      <template v-if="iapState === 'loading'">Loading purchase options…</template>
      <template v-else>
        <b>{{ iapState === 'error' ? "Couldn't load purchase options" : 'Purchase options aren’t available right now' }}</b>
        <span>{{ iapState === 'error' ? 'Check your connection and try again.' : 'Please try again in a little while. If you already subscribed, tap Restore Purchases above.' }}</span>
        <button class="pw-retry" data-test="pw-retry" @click="loadIap">Try again</button>
      </template>
    </div>
    <div v-else class="plans" role="radiogroup">
      <button v-for="p in shownPlans" :key="p.id" class="plan" :class="{on: sel===p.id}" role="radio" :aria-checked="sel===p.id" @click="sel=p.id">
        <span v-if="badgeFor(p)" class="badge">{{ badgeFor(p) }}</span>
        <span class="pl">{{ p.label }}</span>
        <span class="pp" data-test="pw-price">{{ priceText(p) }}<small>{{ ios ? periodSuffix(p) : (p.period==='once' ? ' once' : '/'+p.period) }}</small></span>
        <span class="pm">{{ ios ? subLine(p) : (p.period==='yr' ? `~${fmt(p.perMonth)}/mo` : p.period==='once' ? 'Pay once, own it' : 'Billed monthly') }}</span>
      </button>
    </div>

    <p v-if="ios && iapState === 'ready' && billLine" class="due due--bill" data-test="pw-bill">{{ billLine }}</p>
    <p v-if="!ios" class="due"><span>✓</span> {{ trialDaysFor(plan) ? 'No Payment Due Now' : 'Cancel anytime' }}</p>
    <button v-if="!ios || iapState === 'ready'" class="cta" :disabled="busy || (ios && !iapFor(sel))" @click="buy">{{ ctaText }}</button>
    <p v-if="!ios || iapState === 'ready'" class="fine">{{ fine }}</p>
    <p v-if="msg" class="soon">{{ msg }}</p>
    <p v-if="ios" class="legal">
      <template v-if="plan.mode === 'subscription'">Payment is charged to your Apple ID at confirmation of purchase. The subscription renews automatically unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in your Apple ID account settings.</template>
      <template v-else>One-time purchase charged to your Apple ID. Does not renew.</template>
      <br /><a :href="IAP_URLS.terms" @click.prevent="openLink(IAP_URLS.terms)">Terms of Use</a> · <a :href="IAP_URLS.privacy" @click.prevent="openLink(IAP_URLS.privacy)">Privacy Policy</a>
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { PLANS, DEFAULT_PLAN, fmt, planById, TASK_LIMITS, PRO_RAISES_LIMIT } from '@/config/pricing';
import { startCheckout } from '@/utils/checkout';
import { auth } from '@/firebaseConfig';
import { isNativeIOS } from '@/utils/platform';
import { IAP_URLS } from '@/config/iap';
import { openExternal } from '@/utils/openExternal';
defineProps({ name: { type: String, default: 'there' } });
const emit = defineEmits(['close']);
// iOS native build: Apple IAP via RevenueCat (Stripe is never shown or called). Web: Stripe, unchanged.
const ios = isNativeIOS();
const iapPlans = ref([]);
// iapState: 'loading' (asking the store) | 'ready' (>=1 plan) | 'empty' (store returned no products, e.g. not yet approved / offline) | 'error'.
const iapState = ref(ios ? 'loading' : 'ready');
async function loadIap() { if (!ios) return; iapState.value = 'loading'; msg.value = '';
  try { const { loadPlans } = await import('@/utils/iap'); iapPlans.value = await loadPlans();
    if (!iapPlans.value.length) iapState.value = 'empty';
    else { iapState.value = 'ready'; if (!iapFor(sel.value)) sel.value = (iapPlans.value[0] || {}).id || sel.value; } }
  catch (e) { console.warn('loadPlans failed', e?.message || e); iapState.value = 'error'; } }
onMounted(loadIap);
const iapFor = (id) => iapPlans.value.find((x) => x.id === id);
// iOS shows ONLY store-provided, localised prices (never a hardcoded USD fallback); web keeps the Stripe price list.
const shownPlans = computed(() => ios ? PLANS.filter((p) => iapFor(p.id)) : PLANS);
const priceText = (p) => iapFor(p.id)?.priceString || (ios ? '' : fmt(p.price));
const periodWord = (p) => (p.period === 'yr' ? 'year' : 'month');
const periodSuffix = (p) => (p.period === 'once' ? '' : `/${periodWord(p)}`);
const subLine = (p) => { const td = trialDaysFor(p); return td ? `${td}-day free trial` : p.period === 'once' ? 'Pay once, no renewal' : `Billed every ${periodWord(p)}`; };
// "Save N%" only when computed from the two live store prices (works in any currency); nothing is hardcoded.
const savePct = computed(() => { const m = iapFor('monthly')?.price; const y = iapFor('yearly')?.price; return m && y && y < m * 12 ? Math.round((1 - y / (m * 12)) * 100) : 0; });
const badgeFor = (p) => (ios ? (p.id === 'yearly' && savePct.value >= 5 ? `Save ${savePct.value}%` : '') : p.badge);
const trialDaysFor = (p) => ios ? (iapFor(p.id)?.trialDays || 0) : p.trialDays;
const openLink = (url) => openExternal(url);
const route = useRoute();
const FEATURES = [
  { t: 'AI coach', d: 'Personalised workout and meal suggestions.' },
  { t: 'Strict Boss mode', d: 'An accountability mode that calls out procrastination.' },
  { t: 'Calendar feed', d: 'See your daily plan in any calendar app.' },
  { t: 'Community', d: 'Posts, leaderboards and matchups with other ClingNote users.' },
];
const FEAT = { aiCoach: 'The AI coach', strictBoss: 'Strict Boss mode', calendarFeed: 'The calendar feed', community: 'Community' };
const sel = ref(DEFAULT_PLAN); const busy = ref(false);
const msg = ref(route.query.checkout === 'cancel' ? 'Checkout canceled — no charge was made.' : route.query.feature === 'taskLimit' ? (PRO_RAISES_LIMIT ? `You've reached the free limit of ${TASK_LIMITS.free} tasks today. Pro lets you add ${TASK_LIMITS.pro} per day.` : `You've reached today's limit of ${TASK_LIMITS.free} tasks. Pro adds the AI coach, Strict Boss and more.`) : FEAT[route.query.feature] ? `🔒 ${FEAT[route.query.feature]} is a Pro feature.` : '');
const plan = computed(() => planById(sel.value));
const ctaText = computed(() => busy.value ? 'One sec…' : ios ? (trialDaysFor(plan.value) ? 'Start free trial' : plan.value.period === 'once' ? 'Buy lifetime access' : 'Subscribe') : trialDaysFor(plan.value) ? 'Try for $0.00' : `Continue — ${priceText(plan.value)}`);
// iOS: the billed amount (from the store) is the boldest line, shown above the button; trial wording only when this plan really has a trial.
const billLine = computed(() => { const p = plan.value; const td = trialDaysFor(p); const pr = priceText(p); if (!pr) return '';
  if (p.period === 'once') return `${pr} one-time purchase`;
  return td ? `${pr} per ${periodWord(p)} after your ${td}-day free trial` : `${pr} per ${periodWord(p)}`; });
const fine = computed(() => { const p = plan.value; const td = trialDaysFor(p); const pr = priceText(p);
  if (!pr) return '';
  if (td) return `${td}-day free trial, then ${pr}/${periodWord(p)}. Cancel anytime.`;
  return p.period === 'once' ? `One-time payment of ${pr}. Lifetime access.` : `${pr}/${periodWord(p)}. Cancel anytime.`; });
const demo = [{ t: 'Morning workout', d: true }, { t: 'Write project report', b: true }, { t: 'Reply to emails' }, { t: 'Read 20 pages', d: true }];
async function buy() { busy.value = true; msg.value = '';
  if (ios) { try { const { purchase } = await import('@/utils/iap'); const p = iapFor(sel.value);
      if (!p) msg.value = 'This plan is not available right now. Please try again later.';
      else { const r = await purchase(auth.currentUser, p); if (r.ok) emit('close'); else if (!r.cancelled) msg.value = r.error || 'Purchase failed — please try again.'; } }
    catch (e) { msg.value = 'Purchase failed — please try again.'; }
    busy.value = false; return; }
  const r = await startCheckout({ planId: sel.value, user: auth.currentUser }); busy.value = false;
  if (!r.ok) msg.value = r.notConfigured ? '💳 Payments coming soon — enjoy ClingNote free for now!' : 'Checkout failed — please try again.'; }
async function restore() {
  if (!ios) { msg.value = 'Nothing to restore yet — purchases will sync to your account automatically.'; return; }
  busy.value = true; msg.value = '';
  try { const { restore: rest } = await import('@/utils/iap'); const r = await rest(auth.currentUser);
    if (!r.ok) msg.value = r.error; else if (r.restored) { msg.value = 'Purchases restored. Welcome back to Pro!'; setTimeout(() => emit('close'), 900); } else msg.value = 'No previous purchases found for this Apple ID.'; }
  catch (e) { msg.value = 'Restore failed — please try again.'; }
  busy.value = false; }
</script>

<style scoped>
.pw { max-width: 440px; margin: 0 auto; padding: calc(12px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom)); color: var(--c-text,#F2F5FC); text-align: center; }
.pw-top { display: flex; justify-content: space-between; }
.pw-link { background: none; border: 0; color: var(--c-text-3,#7180A0); font-size: 14px; font-weight: 600; padding: 8px 2px; cursor: pointer; }
.pw-h { font-size: 28px; line-height: 34px; font-weight: 800; letter-spacing: -.02em; margin: 10px 8px 18px; color: #fff; }
.pw-h span { color: #3D8BFF; }
.phone { position: relative; width: 210px; height: 360px; margin: 0 auto; border-radius: 34px; border: 6px solid #1c2740; background: #070D1C; box-shadow: 0 20px 50px rgba(0,0,0,.5), 0 0 0 1px #2A3C66; overflow: hidden; }
.notch { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 70px; height: 18px; border-radius: 12px; background: #000; z-index: 2; }
.scr { position: absolute; inset: 0; padding: 8px 10px; text-align: left; font-size: 10px; }
.ph-status { display: flex; justify-content: space-between; font-size: 9px; color: #A9B4CC; padding: 0 6px; }
.ph-hero { margin: 10px -10px 6px; padding: 14px 12px 10px; background: linear-gradient(180deg, rgba(7,13,28,.1), #070D1C), var(--hero-img, url('~@/assets/hero-forest.jpg')) 70% 35%/cover; }
.ph-hero .k { margin: 0; font-size: 8px; letter-spacing: .16em; text-transform: uppercase; color: #5E9BFF; font-weight: 700; }
.ph-hero .t { margin: 2px 0 8px; font-size: 13px; font-weight: 800; color: #fff; } .ph-hero b { color: #3D8BFF; }
.ph-stats { display: flex; gap: 5px; } .ph-stats div { flex: 1; background: rgba(12,22,48,.85); border: 1px solid #2A3C66; border-radius: 8px; padding: 4px; text-align: center; }
.ph-stats b { display: block; font-size: 11px; } .ph-stats small { font-size: 7px; color: #7180A0; }
.ph-bar { height: 4px; border-radius: 4px; background: rgba(255,255,255,.08); margin: 4px 0 8px; } .ph-bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); }
.ph-card { display: flex; align-items: center; gap: 6px; padding: 8px; margin-bottom: 5px; border-radius: 10px; background: linear-gradient(180deg, rgba(18,32,63,.92), rgba(12,22,48,.92)); border: 1px solid #2A3C66; }
.ph-card .ck { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #2A3C66; font-size: 8px; display: grid; place-items: center; color: #fff; }
.ph-card.done .ck { background: #3DDC97; border-color: #3DDC97; } .ph-card.done .tt { color: #7180A0; text-decoration: line-through; }
.ph-card.boss { border-color: #8F2A2A; } .bb { margin-left: auto; font-size: 7px; font-weight: 800; color: #FCA5A5; background: #2E1517; padding: 1px 5px; border-radius: 6px; }
.ph-fab { position: absolute; right: 12px; bottom: 12px; width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); display: grid; place-items: center; font-size: 18px; color: #fff; }
.plans { display: flex; gap: 8px; margin: 22px 0 14px; }
.plan { position: relative; flex: 1; padding: 16px 6px 10px; border-radius: 14px; border: 1.5px solid var(--c-border-strong,#2A3C66); background: rgba(12,22,48,.92); color: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 3px; font-family: inherit; }
.plan.on { border-color: #3C8CFF; background: #10204A; box-shadow: 0 0 0 3px rgba(47,111,255,.25); }
.badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #3DDC97; color: #062016; }
.pl { font-size: 12px; font-weight: 600; color: #A9B4CC; } .pp { font-size: 17px; font-weight: 800; } .pp small { font-size: 10px; color: #A9B4CC; font-weight: 600; } .pm { font-size: 10px; color: #7180A0; }
.feats { list-style: none; margin: 4px 0 6px; padding: 0; text-align: left; display: flex; flex-direction: column; gap: 12px; }
.feats li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; border: 1px solid #2A3C66; background: rgba(12,22,48,.92); }
.feats .fi { color: #3DDC97; font-weight: 800; } .feats b { display: block; font-size: 15px; } .feats small { color: #A9B4CC; font-size: 13px; }
.due--bill { font-size: 17px; font-weight: 800; color: #fff; }
.due { font-size: 15px; font-weight: 700; margin: 6px 0 12px; } .due span { color: #3DDC97; margin-right: 4px; }
.cta { width: 100%; min-height: 56px; border: 0; border-radius: 16px; font-size: 17px; font-weight: 800; color: #fff; background: linear-gradient(90deg,#1E5BFF,#3C8CFF); box-shadow: 0 10px 26px rgba(47,111,255,.4); cursor: pointer; }
.cta:disabled { opacity: .7; }
.fine { font-size: 12px; color: #7180A0; margin: 10px 0 0; }
.legal { margin: 14px 4px 0; font-size: 11px; line-height: 15px; color: #7180A0; } .legal a { color: #7FB0FF; text-decoration: underline; }
.iap-state { display: flex; flex-direction: column; gap: 8px; align-items: center; margin: 22px 0 14px; padding: 18px 14px; border-radius: 14px; border: 1px solid #2A3C66; background: rgba(12,22,48,.92); color: #A9B4CC; font-size: 14px; }
.iap-state b { color: #fff; font-size: 15px; }
.pw-retry { margin-top: 4px; min-height: 44px; padding: 0 22px; border-radius: 12px; border: 1px solid #3C8CFF; background: transparent; color: #7FB0FF; font-weight: 700; font-size: 15px; cursor: pointer; }
.soon { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: #10204A; border: 1px solid #24448F; color: #7FB0FF; font-size: 13px; font-weight: 600; }
</style>
