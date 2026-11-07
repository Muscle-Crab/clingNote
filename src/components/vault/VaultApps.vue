<template>
  <!-- Two-up metal plates. Cheapest first. Each plate keeps that app's own icon. -->
  <div class="gp-shelf" data-test="vault-shelf">
    <div class="gp-bays">
      <article v-for="a in items" :key="a.id" class="gp-bay" :class="{ 'gp-bay--open': a.open, 'gp-bay--unnamed': unnamed(a), 'gp-bay--next': a.id === nextId() }" data-test="vault-app" :data-open="a.open ? '1' : '0'" :data-unnamed="unnamed(a) ? '1' : '0'">
        <span class="gp-vico" data-test="vault-app-icon" aria-hidden="true">
          <img v-if="a.icon" class="gp-vimg" :src="a.icon" alt="" />
          <span v-else-if="!unnamed(a) && brand(a.label)" class="gp-vbrand" data-test="vault-app-brand" :style="{ background: brand(a.label).bg }"><svg viewBox="0 0 24 24" width="22" height="22" v-html="brand(a.label).svg"></svg></span>
          <span v-else class="gp-vletter">{{ unnamed(a) ? '—' : initial(a.label) }}</span>
          <span v-if="!a.open" class="gp-lock" data-test="vault-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="11" height="11"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
        </span>
        <span class="gp-vname">{{ unnamed(a) ? 'Unnamed' : a.label }}</span>
        <span class="gp-vtag">{{ unnamed(a) ? 'No saved name' : (a.open ? 'Open' : (a.boss ? 'Most used' : (a.id === nextId() ? 'Next' : 'Locked'))) }}</span>
        <span class="gp-pill" :class="{ 'gp-pill--off': a.awaiting || a.price == null }">
          <template v-if="a.noReading">No reading</template>
          <template v-else-if="a.awaiting || a.price == null">Not priced</template>
          <template v-else>{{ a.price }} points<template v-if="toGo(a)"> · {{ toGo(a) }} to go</template></template>
        </span>
        <p v-if="detail" class="gp-line gp-vsub" data-test="vault-app-week">{{ weeklyText(a) }}</p>
        <p v-if="detail" class="gp-line gp-vsub gp-vwhy" data-test="vault-app-why">{{ (why && why[a.id]) || priceWhy(a) }}</p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { weeklyText, priceWhy } from '@/utils/pointsVault';
import { socialIcon } from '@/utils/socialIcons';
const props = defineProps({ items: { type: Array, default: () => [] }, detail: { type: Boolean, default: false }, why: { type: Object, default: null }, points: { type: Number, default: 0 } });
const brand = (label) => socialIcon(label);
const unnamed = (a) => !a || !String(a.label || '').trim() || /^app$/i.test(String(a.label).trim());
const initial = (label) => { const s = String(label || '').trim(); return (s[0] || '—').toUpperCase(); };
const nextId = () => { const n = (props.items || []).find((a) => a && !a.awaiting && a.price != null && a.price > (Number(props.points) || 0)); return n ? n.id : ''; };
const toGo = (a) => (!a || unnamed(a) || a.awaiting || a.price == null || a.open || a.id !== nextId() ? 0 : Math.max(0, a.price - (Number(props.points) || 0)));
</script>

<style scoped>
.gp-line { margin: 0; }
.gp-shelf { min-width: 0; }
.gp-bays { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; min-width: 0; max-height: 340px; overflow: auto; padding: 1px; }
.gp-bay { display: grid; justify-items: center; gap: 3px; min-width: 0; min-height: 118px; padding: 8px 6px 7px; border-radius: 12px; text-align: center; background: linear-gradient(180deg, rgba(255,255,255,.06), transparent 28%), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px), linear-gradient(180deg, #2c343f, #171c24); box-shadow: inset 0 0 0 1px rgba(214, 178, 94, .55), inset 0 1px 0 rgba(255,255,255,.2); }
.gp-bay--open { box-shadow: inset 0 0 0 1px rgba(110, 214, 176, .85), 0 0 10px rgba(16, 140, 90, .28); }
.gp-bay--unnamed { box-shadow: inset 0 0 0 1px rgba(139, 151, 184, .45); }
.gp-bay--next { box-shadow: inset 0 0 0 1px #f0d78c, 0 0 0 1px rgba(240, 215, 140, .35); }
.gp-vico { position: relative; width: 40px; height: 40px; border-radius: 10px; overflow: visible; display: grid; place-items: center; background: #0e141c; }
.gp-vimg, .gp-vbrand, .gp-vletter { width: 40px; height: 40px; border-radius: 10px; overflow: hidden; display: grid; place-items: center; }
.gp-vimg { object-fit: cover; }
.gp-vletter { font-weight: 700; color: #c5d0e6; }
.gp-vbrand :deep(svg) { display: block; }
.gp-lock { position: absolute; right: -4px; bottom: -4px; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; color: #3a2c10; background: linear-gradient(180deg, #f8e7b0, #d6b25e); box-shadow: 0 1px 2px rgba(0,0,0,.45); }
.gp-vname { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .78rem; font-weight: 700; color: #f4f7fb; }
.gp-bay--unnamed .gp-vname { color: #b7c0d4; }
.gp-vtag { font-size: .62rem; letter-spacing: .02em; color: #c5d0e6; }
.gp-bay--open .gp-vtag { color: #b6f3d8; }
.gp-pill { max-width: 100%; padding: 3px 8px; border-radius: 999px; background: linear-gradient(180deg, #f8e7b0, #d6b25e); color: #2a220c; font-size: .68rem; font-weight: 750; line-height: 1.2; }
.gp-pill--off { background: #243044; color: #d5dced; }
.gp-bay--unnamed .gp-pill, .gp-bay:not(.gp-bay--open) .gp-pill { color: #2a220c; }
.gp-vsub, .gp-vwhy { font-size: .72rem; color: #d5dced; }
@media (max-width: 340px) { .gp-bays { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .gp-bay { transition: none; } }
</style>
