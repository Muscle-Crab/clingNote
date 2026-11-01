<template>
  <!-- One flat list (headers + cards are siblings) so the existing smooth reorder can drop a card under any header,
       including a collapsed one. Headers reuse the Completed row style: label, count, chevron. No extra boxes. -->
  <div ref="listEl" class="tasks-list space-y-2" :class="{ 'reorder-off': !reorderable }" @pointerdown="onPointerDown">
    <template v-for="s in groups" :key="s.id">
      <div class="task-section" :data-reorder-key="headerKey(s.id)" :data-section="s.id" data-test="task-section">
        <button type="button" class="done-toggle task-section__toggle" :aria-expanded="collapsed[s.id] ? 'false' : 'true'" :data-test="`section-toggle-${s.id}`" @click="toggle(s.id)">
          <i class="fas" :class="collapsed[s.id] ? 'fa-chevron-right' : 'fa-chevron-down'" aria-hidden="true"></i>
          <span>{{ s.label }} ({{ s.tasks.length }})</span>
        </button>
      </div>
      <template v-if="!collapsed[s.id]">
        <template v-for="task in s.tasks" :key="keyOf(task)"><slot :task="task" :section="s.id" /></template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { useSmoothReorder } from '@/composables/useSmoothReorder';
import { groupBySection, headerKey, resolveDrop, loadCollapsed, saveCollapsed } from '@/utils/taskSections';

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  keyOf: { required: true }, // (task) => stable key
  reorderable: { type: Boolean, default: true },
});
const emit = defineEmits(['drop', 'drag-start', 'drag-end']);
const groups = computed(() => groupBySection(props.tasks));
const collapsed = ref(loadCollapsed());
const setCollapsed = (id, v) => { collapsed.value = { ...collapsed.value, [id]: v }; saveCollapsed(collapsed.value); };
const toggle = (id) => setCollapsed(id, !collapsed.value[id]);
const expand = (id) => { if (collapsed.value[id]) setCollapsed(id, false); };
const listEl = ref(null);
const { onPointerDown } = useSmoothReorder({
  listRef: listEl,
  enabled: () => props.reorderable,
  onStart: () => emit('drag-start'),
  onCommit: async (_fromKey, _toKey, from, to) => {
    // DOM order before the data changes = the order the reorder composable measured (headers included).
    const keys = Array.from(listEl.value.children).filter((n) => n.nodeType === 1 && n.dataset.reorderKey).map((n) => n.dataset.reorderKey);
    const r = resolveDrop(keys, from, to);
    expand(r.section); // dropped onto a collapsed header: open it so the card is visible in its new section
    emit('drop', r);
    await nextTick();
  },
  onEnd: (changed) => emit('drag-end', changed),
});
defineExpose({ expand, collapsed });
</script>

<style scoped>
.task-section__toggle { font-weight: 600; }
</style>
