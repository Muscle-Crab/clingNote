// Pure helpers for the Today sort/filter control. Never mutate input; tolerate undefined lists / odd values.
import { toMinutes } from '@/utils/taskPlanning';

export const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual order' },
  { value: 'start', label: 'Start time' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];
export const FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
];
export const DEFAULT_PREFS = { sort: 'manual', filter: 'all' };

const SORT_VALUES = SORT_OPTIONS.map((o) => o.value);
const FILTER_VALUES = FILTER_OPTIONS.map((o) => o.value);
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const STATUS_RANK = { 'in-progress': 0, todo: 1, waiting: 2 };

export const normalizePrefs = (p) => ({
  sort: SORT_VALUES.includes(p?.sort) ? p.sort : DEFAULT_PREFS.sort,
  filter: FILTER_VALUES.includes(p?.filter) ? p.filter : DEFAULT_PREFS.filter,
});

const statusOf = (t) => t?.status || 'todo';
const rank = (map, v, fallback) => (v in map ? map[v] : fallback);

// Manual order and filter 'all' are the only state where drag-reorder is safe (list === stored order).
export const isManual = (prefs) => normalizePrefs(prefs).sort === 'manual';
export const canReorder = (prefs) => { const n = normalizePrefs(prefs); return n.sort === 'manual' && n.filter === 'all'; };
export const isDefaultPrefs = (prefs) => { const n = normalizePrefs(prefs); return n.sort === 'manual' && n.filter === 'all'; };

// Returns [{ task, index }] where index is the position in the ORIGINAL list, so index-based handlers stay correct.
// Completed tasks are not hidden here (Show completed is handled by the caller); the status filter applies to non-completed tasks.
export function viewTasks(tasks, prefs) {
  const { sort, filter } = normalizePrefs(prefs);
  let items = (Array.isArray(tasks) ? tasks : []).map((task, index) => ({ task, index }));
  if (filter !== 'all') items = items.filter(({ task }) => task?.completed || statusOf(task) === filter);
  if (sort === 'manual') return items;
  const cmp = {
    start: (a, b) => {
      const x = toMinutes(a.task?.startTime), y = toMinutes(b.task?.startTime);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y;
    },
    priority: (a, b) => rank(PRIORITY_RANK, a.task?.priority, 3) - rank(PRIORITY_RANK, b.task?.priority, 3),
    status: (a, b) => rank(STATUS_RANK, statusOf(a.task), 3) - rank(STATUS_RANK, statusOf(b.task), 3),
  }[sort];
  // stable: ties keep manual order
  return items.sort((a, b) => cmp(a, b) || a.index - b.index);
}

// Visible = what will actually render (after Show completed).
export const visibleCount = (items, showCompleted) => items.filter(({ task }) => !task?.completed || showCompleted).length;

// "n" shortcut guard: ignore when typing, modified, or a modal is open.
export function shouldHandleShortcut(e, modalOpen) {
  if (!e || e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing || e.repeat) return false;
  if (modalOpen) return false;
  const t = e.target;
  const tag = String(t?.tagName || '').toUpperCase();
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || t?.isContentEditable) return false;
  return true;
}
