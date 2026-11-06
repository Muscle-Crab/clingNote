<template>
  <!-- Coach game plan: ONE compact tappable row (same look as the routine row). Expands inline for the close picker, weekly review and (optional) friend unlock. -->
  <div class="gp" data-test="gp-row" :data-phase="phase">
    <div class="gp-head">
    <button type="button" class="gp-row" data-test="gp-toggle" :aria-expanded="open ? 'true' : 'false'" @click="open = !open">
      <span class="gp-title" data-test="gp-text"><span class="gp-main">{{ text }}</span><span v-if="ready" class="gp-ready" data-test="gp-ready">&nbsp;{{ ready }}</span></span>
      <span v-if="attn" class="gp-dot" data-test="gp-attn" aria-label="Needs you"></span>
      <span class="gp-chev" aria-hidden="true">{{ open ? '‹' : '›' }}</span>
    </button>
    <!-- Break available: a small 🎁 right on the line (no box); one tap starts the break. Shown whenever a break can be taken, checklist or not. -->
    <button v-if="gift" type="button" class="gp-gift" data-test="gp-gift" :aria-label="`Take your ${Math.min(breakBank, breakMin)} minute break`" :title="`Take break (${Math.min(breakBank, breakMin)}m)`" @click.stop="$emit('take-break')">🎁</button>
    </div>
    <!-- Earned break / running break: shown on the collapsed row (no expand needed), same slim line, no box. -->
    <p v-if="breakBank > 0 && !breakOn && phase !== 'closed'" class="gp-line gp-bline" data-test="gp-break-line">Break earned: opens your apps, never costs points. <button type="button" class="gp-chip" data-test="gp-take-break" @click="$emit('take-break')">Take break ({{ Math.min(breakBank, breakMin) }}m)</button></p>
    <p v-if="breakOn" class="gp-line gp-bline" data-test="gp-break-on">Break running: all apps open, they lock again on their own. <button type="button" class="gp-chip" data-test="gp-end-break" @click="$emit('end-break')">End break now</button></p>
    <!-- Points vault: the mark is the door. The row stays the same slim line; the room inside is a shelf, not a shop table. -->
    <template v-if="vault">
      <div class="gp-head">
        <button type="button" class="gp-vault-btn" data-test="vault-toggle" :aria-expanded="vaultOpen ? 'true' : 'false'" :aria-label="vaultOpen ? 'Close the vault' : 'Open the vault'" @click="vaultOpen = !vaultOpen">
          <VaultMark :open="vaultOpen" />
        </button>
        <button type="button" class="gp-row gp-vault" data-test="vault-status" :aria-expanded="vaultOpen ? 'true' : 'false'" @click="vaultOpen = !vaultOpen">
          <span class="gp-title" data-test="vault-text"><span class="gp-main">{{ vault.text }}</span></span>
          <span class="gp-chev" aria-hidden="true">{{ vaultOpen ? '‹' : '›' }}</span>
        </button>
      </div>
      <div v-if="vaultOpen" class="gp-vault-room" data-test="vault-body">
        <header class="vd-head" data-test="vault-door">
          <VaultDoor :unlocked="vault.openCount > 0" :live="!!vault.live" />
          <h2 class="vd-title">App Vault</h2>
          <p class="vd-sub">Complete tasks. Earn your access.</p>
          <p class="vd-pill" data-test="vault-points">{{ vault.points || 0 }} points</p>
          <div class="vd-gauge" data-test="vault-gauge" role="meter" :aria-valuenow="vault.points || 0" :aria-valuemin="0" :aria-valuemax="gaugeMax" :aria-label="`Points ${vault.points || 0} of ${gaugeMax}`">
            <span class="vd-gauge-fill" :style="{ width: gaugePct + '%' }"></span>
          </div>
          <p v-if="cheapest" class="vd-line" data-test="vault-next">Next · {{ bayName(cheapest) }}<template v-if="cheapest.price != null"> · {{ cheapest.price }} points</template></p>
          <p v-if="heaviest && (!cheapest || heaviest.id !== cheapest.id)" class="vd-line" data-test="vault-last">Most used · {{ bayName(heaviest) }}</p>
          <p v-if="breakLine" class="vd-line" data-test="vault-break">{{ breakLine }}</p>
        </header>
        <p v-if="vault.debt" class="gp-line gp-warn" data-test="vault-debt">Vault closed: a missed goal keeps apps locked until a session hits its goal.</p>
        <p v-if="vault.reportNote" class="gp-line gp-vault-note" data-test="vault-report">{{ vault.reportNote }} <button type="button" class="gp-chip" data-test="vault-report-reload" @click="$emit('vault-report-reload')">Reload the report you sent</button></p>
        <p v-if="vault.awaiting" class="gp-line gp-vault-note" data-test="vault-awaiting">No exact report for {{ vault.awaiting }} selected app{{ vault.awaiting === 1 ? '' : 's' }}. <button type="button" class="gp-chip" data-test="vault-sync" @click="$emit('vault-sync')">Sync thresholds</button></p>
        <VaultApps :items="vault.items" :points="vault.points" />
        <button type="button" class="vd-earn" data-test="vault-earn" @click="earnPoints">Earn more points</button>
        <p class="gp-line gp-vault-note" data-test="vault-time">
          <template v-if="vault.live">App time running: {{ vault.liveLeftMin }} min left. <button type="button" class="gp-chip" data-test="vault-stop" @click="$emit('vault-stop')">Stop</button></template>
          <template v-else>App time left: {{ vault.leftMin }} of {{ vault.earnedMin }} min (10 pts = 5 min).<button v-if="vault.canStart" type="button" class="gp-chip gp-vgo" data-test="vault-start" @click="$emit('vault-start')">Use {{ vault.leftMin }} min</button></template>
        </p>
      </div>
    </template>
    <div v-if="open" class="gp-body">
      <p v-if="gate" class="gp-line" data-test="gp-gate">🔒 Social apps stay locked until your morning checklist is done.<template v-if="gift"> An earned break still opens them.</template></p>
      <p v-if="penalty" class="gp-line gp-warn" data-test="gp-penalty">−{{ penalty }} pts today: Screen Time access was turned off.</p>
      <button v-if="history.length" type="button" class="gp-line gp-link" data-test="gp-history-open" :aria-expanded="histOpen ? 'true' : 'false'" @click="histOpen = !histOpen">Break history ({{ history.length }}) {{ histOpen ? '‹' : '›' }}</button>
      <template v-if="histOpen"><p v-for="h in history" :key="h.key" class="gp-line gp-hist" data-test="gp-history-item">{{ h.date }} {{ h.time }} · {{ h.min }} min · at {{ h.points }} pts</p></template>
      <p v-if="screenReady > 0" class="gp-line" data-test="gp-screen-line">Goal hit: {{ screenReady }}m screen time earned. <button type="button" class="gp-chip" data-test="gp-claim-screen" @click="$emit('claim-screen')">Start screen time ({{ screenReady }}m)</button></p>
      <p v-if="afterClose" class="gp-line" data-test="gp-after">+{{ afterClose }} pts finished after close are not counted.</p>

      <template v-if="review">
        <p class="gp-h" data-test="gp-review">Weekly review · {{ review.hit }}/{{ review.days.length }} goals hit · {{ review.total }} pts{{ review.penalties ? ` · −${review.penalties} penalty` : '' }}</p>
        <label v-for="p in review.proposals" :key="p.id" class="gp-check"><input type="checkbox" v-model="accepted" :value="p.id" data-test="gp-proposal"> {{ p.text }}</label>
        <p v-if="!review.proposals.length" class="gp-line">No changes suggested. Same plan next week.</p>
        <button type="button" class="gp-btn" data-test="gp-review-apply" @click="$emit('review', accepted)">Start next week</button>
      </template>

      <template v-if="locked && friendOn">
        <p v-if="unlock.status === 'counting'" class="gp-line" data-test="gp-countdown">Opening in {{ unlock.left }}s… take a breath.</p>
        <p v-else-if="unlock.status === 'pending'" class="gp-line" data-test="gp-pending">Waiting for {{ friend }}. <a :href="unlock.url" data-test="gp-link" @click.prevent="$emit('share')">Share link again</a></p>
        <p v-else-if="unlock.status === 'denied'" class="gp-line" data-test="gp-denied">{{ friend }} said keep it locked.</p>
        <p v-else-if="unlock.status === 'error'" class="gp-line gp-warn">{{ unlock.error }}</p>
        <div v-if="friend && !['pending', 'counting'].includes(unlock.status)" class="gp-ask">
          Ask {{ friend }} for
          <button v-for="m in minutes" :key="m" type="button" class="gp-chip" :data-test="'gp-ask-' + m" @click="$emit('ask', m)">{{ m }} min</button>
        </div>
        <p v-else-if="!friend" class="gp-line">Early unlock needs a friend. Add one in Settings → Coach mode.</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import VaultApps from '@/components/vault/VaultApps.vue';
import VaultMark from '@/components/vault/VaultMark.vue';
import VaultDoor from '@/components/vault/VaultDoor.vue';
import { computed, ref } from 'vue';
const props = defineProps({
  text: { type: String, default: '' }, phase: { type: String, default: 'work' }, review: { type: Object, default: null },
  locked: { type: Boolean, default: false },
  gate: { type: Boolean, default: false }, friend: { type: String, default: '' }, friendOn: { type: Boolean, default: false }, unlock: { type: Object, default: () => ({ status: '' }) },
  penalty: { type: Number, default: 0 }, afterClose: { type: Number, default: 0 }, minutes: { type: Array, default: () => [10, 20, 30] },
  breakBank: { type: Number, default: 0 }, breakMin: { type: Number, default: 10 }, breakOn: { type: Boolean, default: false }, gift: { type: Boolean, default: false },   screenReady: { type: Number, default: 0 }, ready: { type: String, default: '' }, history: { type: Array, default: () => [] },
  vault: { type: Object, default: null }, pointsGoal: { type: Number, default: 0 },
});
defineEmits(['review', 'ask', 'share', 'take-break', 'end-break', 'claim-screen', 'vault-start', 'vault-stop', 'vault-sync', 'vault-report-reload']);
const open = ref(false); const accepted = ref([]); const histOpen = ref(false); const vaultOpen = ref(false);
const attn = computed(() => !!props.review || (props.friendOn && props.unlock.status === 'approved'));
const bayName = (a) => (!a || !String(a.label || '').trim() || /^app$/i.test(String(a.label).trim()) ? 'Unnamed' : a.label);
const pricedBays = computed(() => ((props.vault && props.vault.items) || []).filter((a) => a && a.price != null));
const cheapest = computed(() => pricedBays.value.find((a) => !a.open) || pricedBays.value[0] || null);
const heaviest = computed(() => [...pricedBays.value].sort((a, b) => (Number(b.min) || 0) - (Number(a.min) || 0) || (b.boss ? 1 : 0) - (a.boss ? 1 : 0))[0] || null);
const gaugeMax = computed(() => { const goal = Number(props.pointsGoal) || 0; if (goal > 0) return goal; const next = props.vault && Number(props.vault.nextPrice); return next > 0 ? next : Math.max(1, Number(props.vault && props.vault.points) || 0); });
const gaugePct = computed(() => Math.max(0, Math.min(100, Math.round(((Number(props.vault && props.vault.points) || 0) / gaugeMax.value) * 100))));
const breakLine = computed(() => {
  if (props.breakOn) return 'Break running';
  if (props.breakBank > 0) return `Break ready · ${Math.min(props.breakBank, props.breakMin)}m`;
  return String(props.ready || '').replace(/^·\s*/, '').trim();
});
const earnPoints = () => {
  vaultOpen.value = false;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('home-tasks')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};
</script>

<style scoped>
.gp { margin: 0 0 4px; opacity: .6; } .gp:focus-within, .gp:hover, .gp:has([data-test="vault-body"]) { opacity: 1; }
.gp-row { width: 100%; display: flex; align-items: center; gap: 6px; min-height: 22px; padding: 0 2px; background: none; border: 0; color: var(--c-text-3, #7d7c78); font: inherit; font-size: .7rem; cursor: pointer; text-align: left; }
.gp-link { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; } .gp-hist { opacity: .8; }
.gp-title { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; white-space: nowrap; } .gp-main { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; } .gp-ready { flex-shrink: 0; } /* the points never get cut: the break balance wraps to its own line when the row is full */
.gp-head { display: flex; align-items: center; gap: 2px; } .gp-head .gp-row { flex: 1; min-width: 0; }
.gp-gift { flex-shrink: 0; min-width: 22px; min-height: 22px; padding: 0 2px; background: none; border: 0; font-size: .8rem; line-height: 1; cursor: pointer; border-radius: 50%; animation: gp-glow 1.6s ease-in-out 3; }
@keyframes gp-glow { 0%, 100% { filter: none; transform: scale(1); } 50% { filter: drop-shadow(0 0 4px rgba(255, 196, 80, .9)); transform: scale(1.12); } }
@media (prefers-reduced-motion: reduce) { .gp-gift { animation: none; } }
.gp-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--c-accent-text, #5B9BFF); }
.gp-chev { font-size: .7rem; opacity: .7; }
.gp-body { padding: 2px 2px 4px; font-size: .72rem; color: var(--c-text-2, #a1a09b); display: grid; gap: 6px; }
.gp-line, .gp-h { margin: 0; } .gp-bline { padding: 0 2px 2px; font-size: .7rem; color: var(--c-text-2, #a1a09b); } .gp-h { color: var(--c-text-2, #a1a09b); font-weight: 600; } .gp-warn { color: var(--c-warning, #d29922); }
.gp-check { display: flex; gap: 8px; align-items: center; min-height: 32px; }
.gp-btn, .gp-chip { min-height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--c-border, #2a2a2e); background: none; color: var(--c-text, #ecebe8); font: inherit; font-size: .72rem; cursor: pointer; justify-self: start; }
.gp-btn:disabled { opacity: .5; cursor: default; }
.gp-ask { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.gp-vapp { display: flex; gap: 6px; align-items: baseline; } .gp-vname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .gp-vprice { opacity: .8; font-variant-numeric: tabular-nums; }
.gp-vault-btn { flex: none; width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 9px; background: #1c222c; color: #e6c56a; cursor: pointer; box-shadow: inset 0 0 0 1px #e6c56a; }
.gp-vault-btn[aria-expanded="true"] { box-shadow: inset 0 0 0 1px #f6e2a8, 0 0 10px rgba(230, 197, 106, .45); }
.gp-vault-room { margin: 2px 0 6px; padding: 14px 10px 10px; border-radius: 22px; display: grid; gap: 8px; max-width: 100%; overflow: hidden; box-sizing: border-box; color: #e7edf8; background-color: #12171f; background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px), linear-gradient(180deg, #3a4250, #1a2029 28%, #12171f); box-shadow: inset 0 0 0 2px #e6c56a, inset 0 0 0 5px #1c222c, inset 0 0 0 6px rgba(214,178,94,.55); }
.vd-head { display: grid; justify-items: center; gap: 4px; min-width: 0; text-align: center; }
.vd-title { margin: 0; font-size: 1.35rem; line-height: 1.1; letter-spacing: .01em; color: #f6e2a8; text-shadow: 0 1px 0 #6d5420; }
.vd-sub { margin: 0; font-size: .75rem; color: #d5dced; }
.vd-pill { margin: 2px 0 0; padding: 4px 12px; border-radius: 999px; background: linear-gradient(180deg, #f8e7b0, #d6b25e); color: #2a220c; font-size: .8rem; font-weight: 800; }
.vd-gauge { position: relative; width: min(100%, 220px); height: 6px; border-radius: 99px; overflow: hidden; background: #0e141c; box-shadow: inset 0 0 0 1px rgba(214, 178, 94, .45); }
.vd-gauge-fill { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #8a6a32, #f0e2b8); }
.vd-line { margin: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .68rem; color: #e7edf8; }
.vd-earn { min-height: 40px; width: 100%; border: 0; border-radius: 999px; background: linear-gradient(180deg, #1ea36a, #0e7a45); color: #f4fff8; font: inherit; font-size: .85rem; font-weight: 750; cursor: pointer; box-shadow: 0 0 12px rgba(16, 160, 96, .35); }
.vd-earn:focus-visible { outline: 2px solid #f6e2a8; outline-offset: 2px; }
.gp-vault-note { font-size: .68rem; opacity: .85; } .gp-vgo { margin-left: 6px; }
@media (prefers-reduced-motion: reduce) { .vd-gauge-fill { transition: none; } }
a { color: var(--c-accent-text, #5B9BFF); }
</style>
