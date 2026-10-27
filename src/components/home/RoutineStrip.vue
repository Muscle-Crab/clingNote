<template>
  <!-- One compact tappable row (collapsed by default): today's routine count + Mon–Sun dots; thin weekly bar underneath. -->
  <div class="rs" data-test="routine-strip">
    <button type="button" class="rs-row" data-test="routine-toggle" :aria-expanded="open ? 'true' : 'false'" @click="toggle">
      <span class="rs-title">🔁 Routine <b>{{ doneToday }}/{{ items.length }}</b></span>
      <span class="rs-week" data-test="routine-week" role="img" :aria-label="week.label" :title="week.label">
        <span v-for="d in week.days" :key="d.date" class="rs-dot" :class="'rs-dot--' + d.state" data-test="routine-dot" :data-state="d.state"></span>
        <span class="rs-wk">{{ week.done }}/{{ week.total }}</span>
      </span>
      <i class="fas rs-chev" :class="open ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true"></i>
    </button>
    <div class="rs-bar" aria-hidden="true"><span :style="{ width: pct + '%' }"></span></div>
    <div v-if="open" class="rs-chips">
      <button v-for="it in items" :key="it.id" type="button" class="rs-chip" :class="{ 'is-done': it.done }" data-test="routine-chip"
        :disabled="!it.task" :aria-pressed="it.done ? 'true' : 'false'" @click="it.task && $emit('toggle', it.task)">
        <i class="fas" :class="it.done ? 'fa-check-circle' : 'fa-circle'" aria-hidden="true"></i> {{ it.title }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
const props = defineProps({ items: { type: Array, default: () => [] }, week: { type: Object, required: true } });
defineEmits(['toggle']);
const KEY = 'cn_routine_open';
const open = ref((() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })());
const toggle = () => { open.value = !open.value; try { localStorage.setItem(KEY, open.value ? '1' : '0'); } catch { /* private mode */ } };
const doneToday = computed(() => props.items.filter((i) => i.done).length);
const pct = computed(() => (props.week.total ? Math.round((props.week.done / props.week.total) * 100) : 0));
</script>

<style scoped>
.rs { margin: 0 0 8px; }
.rs-row { width: 100%; display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 2px; background: none; border: 0; color: var(--c-text-2, #a1a09b); font: inherit; font-size: .82rem; cursor: pointer; text-align: left; }
.rs-title b { color: var(--c-text, #ecebe8); font-weight: 700; }
.rs-week { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.rs-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c-border, #2a2a2e); }
.rs-dot--done { background: var(--c-success, #3fb950); }
.rs-dot--part { background: var(--c-warning, #d29922); }
.rs-dot--miss { background: transparent; box-shadow: inset 0 0 0 1px var(--c-text-3, #6b6a66); }
.rs-dot--open, .rs-dot--future { background: transparent; box-shadow: inset 0 0 0 1px var(--c-accent-text, #5B9BFF); }
.rs-wk { margin-left: 2px; font-size: .74rem; font-variant-numeric: tabular-nums; }
.rs-chev { font-size: .7rem; opacity: .7; }
.rs-bar { height: 2px; border-radius: 1px; background: var(--c-border, #2a2a2e); overflow: hidden; }
.rs-bar span { display: block; height: 100%; background: var(--c-success, #3fb950); transition: width .3s; }
.rs-chips { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; }
.rs-chip { min-height: 32px; padding: 0 10px; border-radius: 16px; border: 1px solid var(--c-border, #2a2a2e); background: none; color: inherit; font: inherit; font-size: .8rem; cursor: pointer; }
.rs-chip.is-done { color: var(--c-text-3, #6b6a66); text-decoration: line-through; }
.rs-chip.is-done i { color: var(--c-success, #3fb950); }
.rs-chip:disabled { cursor: default; }
@media (prefers-reduced-motion: reduce) { .rs-bar span { transition: none; } }
</style>
