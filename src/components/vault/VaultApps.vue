<template>
  <!-- Points-vault price list (cheapest first): one slim row per chosen app, icon + points. No extra box. -->
  <template v-for="a in items" :key="a.id + (a.open ? '-open' : '')">
    <p class="gp-line gp-vapp" :class="{ 'gp-vapp--open': a.open }" data-test="vault-app" :data-open="a.open ? '1' : '0'">
      <span class="gp-vico" data-test="vault-app-icon" aria-hidden="true">
        <img v-if="a.icon" class="gp-vimg" :src="a.icon" alt="" />
        <span v-else-if="brand(a.label)" class="gp-vbrand" data-test="vault-app-brand" :style="{ background: brand(a.label).bg }"><svg viewBox="0 0 24 24" width="16" height="16" v-html="brand(a.label).svg"></svg></span>
        <span v-else class="gp-vletter">{{ initial(a.label) }}</span>
      </span>
      <span class="gp-vname">{{ a.label }}</span>
      <span class="gp-vprice"><template v-if="a.awaiting || a.price == null">Awaiting Screen Time</template><template v-else><button v-if="a.buyable" type="button" class="gp-buy" data-test="vault-buy" @click="$emit('buy', a.id)">Buy</button><template v-else>{{ a.open ? 'Open' : (a.bought ? 'Bought' : '🔒') }}</template> {{ a.price }} pts · ~{{ a.tasks }} tasks<template v-if="toGo(a)"> · {{ toGo(a) }} to go</template></template></span>
    </p>
    <!-- detail (onboarding): weekly screen time + why this price, as plain lines under the app (no box) -->
    <p v-if="detail" class="gp-line gp-vsub" data-test="vault-app-week">{{ weeklyText(a) }}</p>
    <p v-if="detail" class="gp-line gp-vsub gp-vwhy" data-test="vault-app-why">{{ (why && why[a.id]) || priceWhy(a) }}</p>
  </template>
</template>

<script setup>
import { weeklyText, priceWhy } from '@/utils/pointsVault';
import { socialIcon } from '@/utils/socialIcons';
const props = defineProps({ items: { type: Array, default: () => [] }, detail: { type: Boolean, default: false }, why: { type: Object, default: null }, points: { type: Number, default: 0 } });
defineEmits(['buy']);
const brand = (label) => socialIcon(label);
const initial = (label) => { const s = String(label || 'App').trim(); return (s[0] || 'A').toUpperCase(); };
const nextId = () => { const n = (props.items || []).find((a) => a && !a.bought && !a.awaiting && a.price != null); return n ? n.id : ''; };
const toGo = (a) => (!a || a.awaiting || a.price == null || a.bought || a.open || a.buyable || a.id !== nextId() ? 0 : Math.max(0, a.price - (Number(props.points) || 0)));
</script>

<style scoped>
.gp-line { margin: 0; }
.gp-vapp { display: flex; gap: 8px; align-items: center; min-height: 28px; }
.gp-vico { flex: 0 0 22px; width: 22px; height: 22px; border-radius: 6px; overflow: hidden; display: grid; place-items: center; background: var(--c-border, #2a2a2e); }
.gp-vimg, .gp-vbrand, .gp-vletter { width: 22px; height: 22px; display: grid; place-items: center; }
.gp-vimg { object-fit: cover; border-radius: 6px; }
.gp-vletter { font-size: .68rem; font-weight: 700; color: var(--c-text, #ecebe8); }
.gp-vbrand :deep(svg) { display: block; }
.gp-vname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp-vprice { opacity: .8; font-variant-numeric: tabular-nums; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.gp-buy { min-height: 22px; padding: 0 8px; border-radius: 11px; border: 1px solid var(--c-border, #2a2a2e); background: none; color: var(--c-text, #ecebe8); font: inherit; font-size: .68rem; cursor: pointer; }
.gp-vapp--open .gp-vico { animation: vault-release .7s cubic-bezier(.2, .8, .2, 1); }
@keyframes vault-release { 0% { transform: scale(.45) rotate(-18deg); filter: grayscale(1); } 55% { transform: scale(1.18) rotate(6deg); filter: none; } 100% { transform: none; } }
@media (prefers-reduced-motion: reduce) { .gp-vapp--open .gp-vico { animation: none; } }
.gp-vsub { padding-left: 30px; font-size: .85em; opacity: .75; } .gp-vwhy { margin-bottom: 6px; opacity: .9; }
</style>
