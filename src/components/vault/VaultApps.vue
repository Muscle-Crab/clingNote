<template>
  <!-- Points-vault price list (cheapest first): shared by the Home game-plan vault row and the onboarding vault step. -->
  <template v-for="a in items" :key="a.id">
    <p class="gp-line gp-vapp" data-test="vault-app" :data-open="a.open ? '1' : '0'">
      <span aria-hidden="true">{{ a.open ? '✓' : '🔒' }}</span> <span class="gp-vname">{{ a.label }}</span> <span class="gp-vprice">{{ a.price }} pts · ~{{ a.tasks }} tasks</span>
    </p>
    <!-- detail (onboarding): weekly screen time + why this price, as plain lines under the app (no box) -->
    <p v-if="detail" class="gp-line gp-vsub" data-test="vault-app-week">{{ weeklyText(a) }}</p>
    <p v-if="detail" class="gp-line gp-vsub gp-vwhy" data-test="vault-app-why">{{ (why && why[a.id]) || priceWhy(a) }}</p>
  </template>
</template>

<script setup>
import { weeklyText, priceWhy } from '@/utils/pointsVault';
defineProps({ items: { type: Array, default: () => [] }, detail: { type: Boolean, default: false }, why: { type: Object, default: null } });
</script>

<style scoped>
.gp-line { margin: 0; }
.gp-vapp { display: flex; gap: 6px; align-items: baseline; } .gp-vname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .gp-vprice { opacity: .8; font-variant-numeric: tabular-nums; }
.gp-vsub { padding-left: 22px; font-size: .85em; opacity: .75; } .gp-vwhy { margin-bottom: 6px; opacity: .9; }
</style>
