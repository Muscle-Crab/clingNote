<template>
  <!-- Coach game plan: ONE compact tappable row (same look as the routine row). Expands inline for the close picker, weekly review and friend unlock. -->
  <div class="gp" data-test="gp-row" :data-phase="phase">
    <button type="button" class="gp-row" data-test="gp-toggle" :aria-expanded="open ? 'true' : 'false'" @click="open = !open">
      <span class="gp-title">{{ icon }} <span data-test="gp-text">{{ text }}</span></span>
      <span v-if="attn" class="gp-dot" data-test="gp-attn" aria-label="Needs you"></span>
      <i class="fas gp-chev" :class="open ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true"></i>
    </button>
    <div v-if="open" class="gp-body">
      <p v-if="gate" class="gp-line" data-test="gp-gate">🔒 Social apps stay locked until your morning checklist is done.</p>
      <p v-if="penalty" class="gp-line gp-warn" data-test="gp-penalty">−{{ penalty }} pts today: Screen Time access was turned off.</p>
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

      <template v-if="locked">
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
  gate: { type: Boolean, default: false }, friend: { type: String, default: '' }, unlock: { type: Object, default: () => ({ status: '' }) },
  penalty: { type: Number, default: 0 }, afterClose: { type: Number, default: 0 }, minutes: { type: Array, default: () => [10, 20, 30] },
});
defineEmits(['carry', 'review', 'ask', 'share']);
const open = ref(false); const picked = ref([]); const accepted = ref([]);
const left = computed(() => props.leftovers);
const icon = computed(() => ({ before: '🌅', focus: '🎯', break: '☕', work: '🛠', closed: '🌙' }[props.phase] || '🎯'));
const attn = computed(() => !!props.review || (props.phase === 'closed' && props.leftovers.length > 0) || props.unlock.status === 'approved');
</script>

<style scoped>
.gp { margin: 0 0 8px; }
.gp-row { width: 100%; display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 2px; background: none; border: 0; color: var(--c-text-2, #a1a09b); font: inherit; font-size: .82rem; cursor: pointer; text-align: left; }
.gp-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c-accent-text, #5B9BFF); }
.gp-chev { font-size: .7rem; opacity: .7; }
.gp-body { padding: 4px 2px 6px; font-size: .8rem; color: var(--c-text-2, #a1a09b); display: grid; gap: 6px; }
.gp-line, .gp-h { margin: 0; } .gp-h { color: var(--c-text, #ecebe8); font-weight: 600; } .gp-warn { color: var(--c-warning, #d29922); }
.gp-check { display: flex; gap: 8px; align-items: center; min-height: 32px; }
.gp-btn, .gp-chip { min-height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--c-border, #2a2a2e); background: none; color: var(--c-text, #ecebe8); font: inherit; font-size: .8rem; cursor: pointer; justify-self: start; }
.gp-btn:disabled { opacity: .5; cursor: default; }
.gp-ask { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
a { color: var(--c-accent-text, #5B9BFF); }
</style>
