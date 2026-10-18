<template>
  <div class="task-list-header">
    <div class="task-count">
      <h2 class="task-count-label">{{ label }}</h2>
      <span class="task-count-badge">{{ completed }}/{{ total }}</span>
    </div>
    <div class="header-actions">
      <div v-if="isToday" ref="sortWrap" class="sort-wrap">
        <button @click="open = !open" class="toggle-visibility sort-btn" :class="{ 'sort-btn--active': !isDefaultPrefs(prefs) }" :aria-expanded="open" aria-haspopup="true" aria-label="Sort and filter" title="Sort and filter">
          <i class="fas fa-sort-amount-down"></i>
        </button>
        <div v-if="open" class="sort-menu" role="group" aria-label="Sort and filter tasks">
          <label class="sort-label">Sort by
            <select class="sort-select" :value="prefs.sort" aria-label="Sort by" @change="$emit('update:prefs', { ...prefs, sort: $event.target.value })">
              <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label class="sort-label">Filter
            <select class="sort-select" :value="prefs.filter" aria-label="Filter by status" @change="$emit('update:prefs', { ...prefs, filter: $event.target.value })">
              <option v-for="o in FILTER_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <p v-if="!canReorder(prefs)" class="sort-hint">Drag reorder is off unless sorted manually with no filter.</p>
          <button v-if="!isDefaultPrefs(prefs)" class="sort-reset" @click="$emit('update:prefs', { sort: 'manual', filter: 'all' })">Reset</button>
        </div>
      </div>
      <button v-if="isToday" @click="$emit('toggle-sound')" class="toggle-visibility" :aria-pressed="soundEnabled ? 'true' : 'false'" aria-label="Sounds" :title="soundEnabled ? 'Sounds on' : 'Sounds off'">
        <i :class="soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute'"></i>
      </button>
      <button v-if="isToday" @click="$emit('toggle-completed')" class="toggle-visibility toggle-visibility--text" :aria-pressed="showCompleted ? 'true' : 'false'" :title="showCompleted ? 'Hide completed' : 'Show completed'">
        <i :class="showCompleted ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
        <span>{{ showCompleted ? 'Hide completed' : 'Show completed' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { SORT_OPTIONS, FILTER_OPTIONS, DEFAULT_PREFS, isDefaultPrefs, canReorder } from '@/utils/taskView';
const open = ref(false);
const sortWrap = ref(null);
const onDocDown = (e) => { if (sortWrap.value && !sortWrap.value.contains(e.target)) open.value = false; };
const onDocKey = (e) => { if (e.key === 'Escape') open.value = false; };
const unbind = () => { document.removeEventListener('pointerdown', onDocDown, true); document.removeEventListener('keydown', onDocKey); };
watch(open, (o) => { unbind(); if (o) { document.addEventListener('pointerdown', onDocDown, true); document.addEventListener('keydown', onDocKey); } });
onBeforeUnmount(unbind);
defineProps({
  label: { type: String, default: 'Today' },
  isToday: { type: Boolean, default: true }, // sort/filter/completed toggles only apply to today's list
  prefs: { type: Object, default: () => ({ ...DEFAULT_PREFS }) },
  completed: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  soundEnabled: { type: Boolean, default: false },
  showCompleted: { type: Boolean, default: false },
});
defineEmits(['toggle-sound', 'toggle-completed', 'update:prefs']);
</script>

<style scoped>
.task-list-header { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-2) 0; gap: var(--sp-2); }
.task-count { display: flex; align-items: center; gap: var(--sp-2); }
.task-count-label { margin: 0; font-size: 24px; line-height: 28px; font-weight: 800; letter-spacing: -.01em; color: var(--c-text); }
.task-count-badge { font-size: var(--fs-sm); font-weight: 700; font-family: 'JetBrains Mono', monospace; background: var(--c-accent-soft); color: var(--c-accent-text); padding: 2px 10px; border-radius: var(--r-pill); }
.header-actions { display: flex; align-items: center; gap: 2px; }
.toggle-visibility { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 40px; min-height: 40px; background: none; border: none; color: var(--c-text-2); cursor: pointer; font-size: var(--fs-md); padding: 0 var(--sp-2); border-radius: var(--r); transition: color .15s, background .15s; }
.toggle-visibility--text span { font-size: var(--fs-sm); }
.toggle-visibility:hover { color: var(--c-text); background: var(--c-surface-2); }
.sort-wrap { position: relative; }
.sort-btn--active { color: var(--c-accent-text); }
.sort-menu { position: absolute; right: 0; top: 100%; z-index: 20; min-width: 220px; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--r); box-shadow: 0 8px 24px rgba(0,0,0,.4); }
.sort-label { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-sm); color: var(--c-text-2); }
.sort-select { min-height: 36px; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-border); border-radius: var(--r); padding: 0 var(--sp-2); }
.sort-hint { margin: 0; font-size: var(--fs-xs); color: var(--c-text-3); }
.sort-reset { align-self: flex-start; background: none; border: none; color: var(--c-accent-text); cursor: pointer; padding: 4px 0; }
</style>
