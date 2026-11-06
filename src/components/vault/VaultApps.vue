<template>
  <!-- Least-used bay sits at the bottom. Cost climbs toward the door. Each bay keeps that app's own icon. -->
  <div class="gp-shelf" data-test="vault-shelf">
    <p class="gp-climb" data-test="vault-climb">Least used at the bottom. Screen time rises toward the door.</p>
    <div class="gp-bays">
      <div v-for="a in shown" :key="a.id + (a.open ? '-open' : '')" class="gp-bay" :class="{ 'gp-bay--open': a.open, 'gp-bay--unnamed': unnamed(a), 'gp-bay--next': a.id === nextId() }" data-test="vault-app" :data-open="a.open ? '1' : '0'" :data-unnamed="unnamed(a) ? '1' : '0'">
        <span class="gp-slab" aria-hidden="true"></span>
        <span class="gp-vico" data-test="vault-app-icon" aria-hidden="true">
          <img v-if="a.icon" class="gp-vimg" :src="a.icon" alt="" />
          <span v-else-if="!unnamed(a) && brand(a.label)" class="gp-vbrand" data-test="vault-app-brand" :style="{ background: brand(a.label).bg }"><svg viewBox="0 0 24 24" width="18" height="18" v-html="brand(a.label).svg"></svg></span>
          <span v-else class="gp-vletter">{{ unnamed(a) ? '—' : initial(a.label) }}</span>
        </span>
        <span class="gp-vmeta">
          <span class="gp-vname">{{ unnamed(a) ? 'Unnamed' : a.label }}</span>
          <span class="gp-vtag">{{ unnamed(a) ? 'No saved name' : (a.boss ? 'Most used' : (a.id === nextId() ? 'Next' : (a.open ? 'Open' : 'Locked'))) }}</span>
        </span>
        <span class="gp-vprice">
          <template v-if="a.awaiting || a.price == null">Not priced</template>
          <template v-else>
            <b>{{ a.price }} pts</b>
            <small>~{{ a.tasks }} tasks<template v-if="toGo(a)"> · {{ toGo(a) }} to go</template></small>
          </template>
        </span>
        <p v-if="detail" class="gp-line gp-vsub" data-test="vault-app-week">{{ weeklyText(a) }}</p>
        <p v-if="detail" class="gp-line gp-vsub gp-vwhy" data-test="vault-app-why">{{ (why && why[a.id]) || priceWhy(a) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { weeklyText, priceWhy } from '@/utils/pointsVault';
import { socialIcon } from '@/utils/socialIcons';
const props = defineProps({ items: { type: Array, default: () => [] }, detail: { type: Boolean, default: false }, why: { type: Object, default: null }, points: { type: Number, default: 0 } });
const brand = (label) => socialIcon(label);
const unnamed = (a) => !a || !String(a.label || '').trim() || /^app$/i.test(String(a.label).trim());
const initial = (label) => { const s = String(label || '').trim(); return (s[0] || '—').toUpperCase(); };
const shown = computed(() => [...(props.items || [])].reverse());
const nextId = () => { const n = (props.items || []).find((a) => a && !a.awaiting && a.price != null && a.price > (Number(props.points) || 0)); return n ? n.id : ''; };
const toGo = (a) => (!a || unnamed(a) || a.awaiting || a.price == null || a.open || a.id !== nextId() ? 0 : Math.max(0, a.price - (Number(props.points) || 0)));
</script>

<style scoped>
.gp-line { margin: 0; }
.gp-shelf { display: grid; gap: 6px; min-width: 0; }
.gp-climb { margin: 0; font-size: .62rem; letter-spacing: .04em; text-transform: uppercase; color: #d6b25e; opacity: .85; }
.gp-bays { position: relative; display: grid; gap: 6px; min-width: 0; padding-left: 12px; max-height: 280px; overflow: auto; }
.gp-bays::before { content: ''; position: absolute; left: 4px; top: 6px; bottom: 6px; width: 2px; border-radius: 1px; background: linear-gradient(to top, rgba(214, 178, 94, .28), rgba(243, 230, 192, .95)); }
.gp-bay { position: relative; display: grid; grid-template-columns: 8px 32px minmax(0, 1fr) auto; gap: 2px 8px; align-items: center; min-height: 44px; min-width: 0; padding: 4px 6px; border-radius: 9px; background: linear-gradient(180deg, #243352, #121c33); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .14), inset 0 -2px 0 rgba(0, 0, 0, .35), 0 1px 0 rgba(214, 178, 94, .22); }
.gp-bay--unnamed { background: linear-gradient(180deg, #1a2438, #10182a); box-shadow: inset 0 0 0 1px rgba(113, 128, 160, .35); }
.gp-bay--unnamed .gp-vname, .gp-bay--unnamed .gp-vprice { color: var(--c-text-3, #7180A0); }
.gp-bay--open { box-shadow: inset 0 0 0 1px rgba(110, 214, 176, .75), 0 0 12px rgba(47, 111, 255, .28); }
.gp-bay--next { box-shadow: inset 0 0 0 1px rgba(214, 178, 94, .7), inset 0 1px 0 rgba(255, 255, 255, .14); }
.gp-slab { width: 8px; height: 30px; border-radius: 2px; background: linear-gradient(90deg, #7a6234, #f4e7c4 46%, #6b5228); transform-origin: left center; transition: transform .5s cubic-bezier(.2, .8, .2, 1); }
.gp-bay--open .gp-slab { transform: perspective(70px) rotateY(-58deg); }
.gp-vico { width: 32px; height: 32px; border-radius: 8px; overflow: hidden; display: grid; place-items: center; background: #0c1428; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08); }
.gp-vimg, .gp-vbrand, .gp-vletter { width: 32px; height: 32px; display: grid; place-items: center; }
.gp-vimg { object-fit: cover; }
.gp-vletter { font-size: .85rem; font-weight: 700; color: var(--c-text-2, #A9B4CC); }
.gp-vbrand :deep(svg) { display: block; }
.gp-vmeta { min-width: 0; }
.gp-vname { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; color: var(--c-text, #F2F5FC); }
.gp-vtag { display: block; font-size: .62rem; letter-spacing: .03em; text-transform: uppercase; color: var(--c-text-3, #7180A0); }
.gp-bay--open .gp-vtag { color: #8ee0c2; }
.gp-vprice { display: grid; justify-items: end; gap: 1px; color: #f0e2b8; font-variant-numeric: tabular-nums; font-size: .72rem; }
.gp-vprice b { font-weight: 750; }
.gp-vprice small { font-size: .62rem; color: var(--c-text-3, #7180A0); }
.gp-vsub, .gp-vwhy { grid-column: 2 / -1; padding-left: 0; font-size: .78em; opacity: .8; }
.gp-vwhy { margin-bottom: 2px; }
@media (max-width: 360px) {
  .gp-bay { grid-template-columns: 8px 32px minmax(0, 1fr); }
  .gp-vprice { grid-column: 3; }
}
@media (prefers-reduced-motion: reduce) {
  .gp-slab, .gp-bay--open .gp-slab { transition: none; transform: none; }
}
</style>
