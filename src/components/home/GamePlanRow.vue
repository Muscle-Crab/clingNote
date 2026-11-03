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
    <!-- Points vault: one slim line (no box). Tap expands the price list, tap again collapses it. -->
    <template v-if="vault">
      <button type="button" class="gp-row gp-vault" data-test="vault-toggle" :aria-expanded="vaultOpen ? 'true' : 'false'" @click="vaultOpen = !vaultOpen">
        <span class="gp-title" data-test="vault-text"><span class="gp-main">{{ vault.text }}</span></span>
        <span class="gp-chev" aria-hidden="true">{{ vaultOpen ? '‹' : '›' }}</span>
      </button>
      <div v-if="vaultOpen" class="gp-body gp-vbody" data-test="vault-body">
        <p v-if="vault.debt" class="gp-line gp-warn" data-test="vault-debt">Vault closed: a missed goal keeps apps locked until a session hits its goal.</p>
        <p v-else-if="!vault.gate.met" class="gp-line" data-test="vault-gate">Finish {{ vault.gate.left }} more task{{ vault.gate.left === 1 ? '' : 's' }} to open the vault.</p>
        <p v-for="a in vault.items" :key="a.id" class="gp-line gp-vapp" data-test="vault-app" :data-open="a.open ? '1' : '0'">
          <span aria-hidden="true">{{ a.open ? '✓' : '🔒' }}</span> <span class="gp-vname">{{ a.label }}</span> <span class="gp-vprice">{{ a.price }} pts</span>
        </p>
        <p class="gp-line" data-test="vault-time">
          <template v-if="vault.live">App time running: {{ vault.liveLeftMin }} min left. <button type="button" class="gp-chip" data-test="vault-stop" @click="$emit('vault-stop')">Stop</button></template>
          <template v-else>App time left: {{ vault.leftMin }} of {{ vault.earnedMin }} min (10 pts = 5 min).<button v-if="vault.canStart" type="button" class="gp-chip gp-vgo" data-test="vault-start" @click="$emit('vault-start')">Use {{ vault.leftMin }} min</button></template>
        </p>
      </div>
    </template>
    <div v-if="open" class="gp-body">
      <p v-if="gate" class="gp-line" data-test="gp-gate">🔒 Social apps stay locked until your morning checklist is done.<template v-if="gift"> An earned break still opens them.</template></p>
      <p v-if="penalty" class="gp-line gp-warn" data-test="gp-penalty">−{{ penalty }} pts today: Screen Time access was turned off.</p>
      <p v-if="breakBank > 0 && !breakOn && phase !== 'closed'" class="gp-line" data-test="gp-break-line">Earned break, yours to take when you want. Opens your apps, never costs points. <button type="button" class="gp-chip" data-test="gp-take-break" @click="$emit('take-break')">Take break ({{ Math.min(breakBank, breakMin) }}m)</button></p>
      <p v-if="breakOn" class="gp-line" data-test="gp-break-on">Break running: all apps open, they lock again on their own. <button type="button" class="gp-chip" data-test="gp-end-break" @click="$emit('end-break')">End break now</button></p>
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

      <template v-if="phase === 'closed' && left.length">
        <p class="gp-h">Pick what goes to {{ tomorrow }}. The rest stays here, no penalty.</p>
        <label v-for="t in left" :key="t.key" class="gp-check"><input type="checkbox" v-model="picked" :value="t.key" data-test="gp-carry-pick"> {{ t.title }}</label>
        <button type="button" class="gp-btn" data-test="gp-carry" :disabled="!picked.length" @click="$emit('carry', picked); picked = []">Move {{ picked.length || '' }} to {{ tomorrow }}</button>
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
import { computed, ref } from 'vue';
const props = defineProps({
  text: { type: String, default: '' }, phase: { type: String, default: 'work' }, review: { type: Object, default: null },
  leftovers: { type: Array, default: () => [] }, tomorrow: { type: String, default: 'tomorrow' }, locked: { type: Boolean, default: false },
  gate: { type: Boolean, default: false }, friend: { type: String, default: '' }, friendOn: { type: Boolean, default: false }, unlock: { type: Object, default: () => ({ status: '' }) },
  penalty: { type: Number, default: 0 }, afterClose: { type: Number, default: 0 }, minutes: { type: Array, default: () => [10, 20, 30] },
  breakBank: { type: Number, default: 0 }, breakMin: { type: Number, default: 10 }, breakOn: { type: Boolean, default: false }, gift: { type: Boolean, default: false }, screenReady: { type: Number, default: 0 }, ready: { type: String, default: '' }, history: { type: Array, default: () => [] },
  vault: { type: Object, default: null },
});
defineEmits(['carry', 'review', 'ask', 'share', 'take-break', 'end-break', 'claim-screen', 'vault-start', 'vault-stop']);
const open = ref(false); const picked = ref([]); const accepted = ref([]); const histOpen = ref(false); const vaultOpen = ref(false);
const left = computed(() => props.leftovers);
const attn = computed(() => !!props.review || (props.phase === 'closed' && props.leftovers.length > 0) || (props.friendOn && props.unlock.status === 'approved'));
</script>

<style scoped>
.gp { margin: 0 0 4px; opacity: .6; } .gp:focus-within, .gp:hover { opacity: .85; }
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
.gp-line, .gp-h { margin: 0; } .gp-h { color: var(--c-text-2, #a1a09b); font-weight: 600; } .gp-warn { color: var(--c-warning, #d29922); }
.gp-check { display: flex; gap: 8px; align-items: center; min-height: 32px; }
.gp-btn, .gp-chip { min-height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--c-border, #2a2a2e); background: none; color: var(--c-text, #ecebe8); font: inherit; font-size: .72rem; cursor: pointer; justify-self: start; }
.gp-btn:disabled { opacity: .5; cursor: default; }
.gp-ask { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.gp-vapp { display: flex; gap: 6px; align-items: baseline; } .gp-vname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .gp-vprice { opacity: .8; font-variant-numeric: tabular-nums; }
.gp-vbody { gap: 3px; } .gp-vgo { margin-left: 6px; }
a { color: var(--c-accent-text, #5B9BFF); }
</style>
