// Home task list sections (Morning / Noon / Afternoon).
// Boundaries (local time, from task.startTime): Morning < 12:00, Noon 12:00-14:59, Afternoon >= 15:00.
// A task's own `section` field wins (set on create, by drag between sections or by "Move to ..." in the ... menu);
// otherwise its start time decides; untimed tasks without a section go to Morning (the default for new tasks).
export const SECTIONS = [{ id: 'morning', label: 'Morning' }, { id: 'noon', label: 'Noon' }, { id: 'afternoon', label: 'Afternoon' }];
export const SECTION_IDS = SECTIONS.map((s) => s.id);
export const DEFAULT_SECTION = 'morning';
export const isSection = (s) => SECTION_IDS.includes(s);
export const sectionFromTime = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); if (!m) return null;
  const h = Number(m[1]); return h < 12 ? 'morning' : h < 15 ? 'noon' : 'afternoon';
};
export const sectionOf = (t) => (t && isSection(t.section) ? t.section : sectionFromTime(t && t.startTime) || DEFAULT_SECTION);
// On create: an explicit start time wins, then the requested section, else Morning.
export const sectionForCreate = ({ start, section } = {}) => sectionFromTime(start) || (isSection(section) ? section : DEFAULT_SECTION);
export const groupBySection = (tasks = []) => SECTIONS.map((s) => ({ ...s, tasks: tasks.filter((t) => sectionOf(t) === s.id) }));

// Drag/drop: section headers are drop targets in the same flat list as the cards (key HEADER + id).
export const HEADER = '__sec:';
export const headerKey = (id) => HEADER + id;
export const isHeaderKey = (k) => String(k || '').startsWith(HEADER);
/** keys = DOM order (headers + cards) before the drop. Returns the dropped card's key, its new section (nearest header
 *  above it) and the new order of card keys. */
export const resolveDrop = (keys, from, to) => {
  const arr = [...keys]; const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved);
  let section = DEFAULT_SECTION;
  for (let i = arr.indexOf(moved) - 1; i >= 0; i--) if (isHeaderKey(arr[i])) { section = arr[i].slice(HEADER.length); break; }
  return { key: moved, section, order: arr.filter((k) => !isHeaderKey(k)) };
};
/** Full list order after a drop: `full` = all tasks (incl. ones not rendered), `visibleOrder` = card keys as dropped. */
export const mergeOrder = (full, visibleOrder, keyOf, movedKey) => {
  const rest = full.filter((t) => keyOf(t) !== movedKey); const moved = full.find((t) => keyOf(t) === movedKey);
  if (!moved) return full;
  const i = visibleOrder.indexOf(movedKey);
  const prev = visibleOrder[i - 1]; const next = visibleOrder[i + 1];
  let at = prev != null ? rest.findIndex((t) => keyOf(t) === prev) + 1 : next != null ? rest.findIndex((t) => keyOf(t) === next) : rest.length;
  if (at < 0) at = rest.length;
  rest.splice(at, 0, moved); return rest;
};

// Collapse state per section: Morning open, Noon and Afternoon collapsed by default.
export const COLLAPSE_KEY = 'cn.taskSections.collapsed';
export const DEFAULT_COLLAPSED = { morning: false, noon: true, afternoon: true };
export const loadCollapsed = (store = (typeof localStorage !== 'undefined' ? localStorage : null)) => {
  try { const v = JSON.parse((store && store.getItem(COLLAPSE_KEY)) || 'null'); if (v && typeof v === 'object') return { ...DEFAULT_COLLAPSED, ...Object.fromEntries(SECTION_IDS.filter((k) => typeof v[k] === 'boolean').map((k) => [k, v[k]])) }; } catch (e) { /* ignore */ }
  return { ...DEFAULT_COLLAPSED };
};
export const saveCollapsed = (c, store = (typeof localStorage !== 'undefined' ? localStorage : null)) => { try { store && store.setItem(COLLAPSE_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } };
