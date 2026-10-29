// Dev-only harness (not part of the app build): mounts TaskCard with mocked ZZTEST data, mirroring HomeView's wiring.
import { createApp, h, reactive, ref } from 'vue';
import TaskCard from '@/components/home/TaskCard.vue';
import '@/assets/ui.css';
const Root = {
  setup() {
    const tasks = reactive([
      { id: 'zz1', title: 'ZZTEST write report', completed: false, type: 'one-time', estimateMin: 25, sortOrder: 1 },
      { id: 'zz2', title: 'ZZTEST call dentist', completed: false, type: 'one-time', estimateMin: 10, sortOrder: 2 },
    ]);
    const expandedKey = ref(null); const log = reactive({ detail: 0, expand: 0, complete: 0 });
    window.__h = { tasks, log, expandedKey };
    return () => h('div', { style: 'max-width:420px;margin:24px auto;display:flex;flex-direction:column;gap:8px' },
      tasks.map((t, i) => h(TaskCard, { key: t.id, 'data-reorder-key': t.id, task: t, index: i, isTodayTab: true, expanded: expandedKey.value === t.id, section: 'now', activeLabels: [], now: Date.now(),
        onToggleComplete: () => { t.completed = !t.completed; log.complete++; },
        onOpenDetail: () => { log.detail++; expandedKey.value = t.id; },
        onToggleExpand: () => { log.expand++; expandedKey.value = expandedKey.value === t.id ? null : t.id; },
        onEdit: () => { log.expand++; expandedKey.value = t.id; } })));
  },
};
createApp(Root).mount('#app');
