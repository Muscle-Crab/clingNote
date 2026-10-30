<template>
  <!-- B39 mood check-in: one inline line (no box) inside the existing Start Day UI. Optional: ignoring it is the skip. -->
  <div class="ci" data-test="checkin-row">
    <span class="ci-group" role="radiogroup" aria-label="Mood">
      <button v-for="m in MOODS" :key="m.v" type="button" role="radio" class="ci-mood" :class="{ on: value.mood === m.v }"
        :aria-checked="String(value.mood === m.v)" :aria-label="m.l" :title="m.l" :data-test="'checkin-mood-' + m.v" @click="$emit('pick', 'mood', m.v)">{{ m.e }}</button>
    </span>
    <span class="ci-sep" aria-hidden="true">·</span>
    <span class="ci-group" role="radiogroup" aria-label="Energy">
      <span class="ci-lbl">⚡</span>
      <button v-for="x in ENERGY" :key="x.v" type="button" role="radio" class="ci-en" :class="{ on: value.energy === x.v }"
        :aria-checked="String(value.energy === x.v)" :aria-label="'Energy ' + x.l" :data-test="'checkin-energy-' + x.v" @click="$emit('pick', 'energy', x.v)">{{ x.l }}</button>
    </span>
  </div>
</template>

<script setup>
import { MOODS, ENERGY } from '@/utils/checkin';
defineProps({ value: { type: Object, default: () => ({}) } });
defineEmits(['pick']);
</script>

<style scoped>
.ci { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; margin: 0 0 12px; }
.ci-group { display: inline-flex; align-items: center; gap: 2px; }
.ci-mood { background: none; border: none; font-size: 1.25rem; line-height: 1; padding: 4px; cursor: pointer; opacity: .55; filter: grayscale(.6); border-radius: 50%; transition: transform .12s, opacity .12s; }
.ci-mood.on, .ci-mood:hover { opacity: 1; filter: none; }
.ci-mood.on { transform: scale(1.18); }
.ci-sep, .ci-lbl { color: var(--c-text-3, #9aa3b5); font-size: .8rem; }
.ci-en { background: none; border: none; font: inherit; font-size: .78rem; color: var(--c-text-3, #9aa3b5); padding: 4px 5px; cursor: pointer; border-radius: 6px; }
.ci-en.on { color: var(--c-accent, #2F6FFF); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
</style>
