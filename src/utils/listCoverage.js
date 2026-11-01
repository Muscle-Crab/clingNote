// Today list coverage (pure): how many of the day's tasks are actually rendered as cards, and why the rest are not.
// The reported "13 vs 11" was the 8-hour PLANNED count (plan.taskCount) vs the tasks actually on the list; that message is
// clarified in EightHourCard. Two real ways a task can still be missing from the cards, handled here:
//  1) a saved status filter (Sort & filter menu, persisted across launches) silently hides tasks with another status;
//     completed tasks are NOT counted as hidden: they already have their own "Done (N)" toggle on today's tab.
//  2) two tasks with the same createdAt|title got the same v-for key, so Vue's keyed patch could drop one card.
// listCoverage() drives "N more not shown · tap to see" (filter only); uniqueRenderKeys() fixes 2.

// keyFn(task) -> base key. Returns an array of keys (same order as tasks), suffixing repeats with #2, #3...
export const uniqueRenderKeys = (tasks = [], keyFn = (t) => String(t)) => {
  const seen = new Map();
  return (Array.isArray(tasks) ? tasks : []).map((t) => {
    const base = String(keyFn(t)); const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
};

// dayTasks: every task the header counts. displayTasks: the sorted+filtered list the template iterates.
// isToday: completed tasks only render inside the Completed section (and only when showCompleted).
export const listCoverage = ({ dayTasks = [], displayTasks = [], isToday = true, showCompleted = false } = {}) => {
  const total = (dayTasks || []).length;
  const shownList = (displayTasks || []).filter((t) => t && (!isToday || !t.completed || showCompleted));
  const shown = Math.min(total, shownList.length);
  const inDisplay = new Set(displayTasks || []);
  const filtered = (dayTasks || []).filter((t) => !inDisplay.has(t)).length; // removed by the status filter
  const completed = isToday && !showCompleted ? (displayTasks || []).filter((t) => t && t.completed).length : 0;
  const hidden = filtered; // only tasks with no other on-screen trace
  const parts = [];
  if (completed) parts.push(`${completed} completed`);
  if (filtered) parts.push(`${filtered} filtered out`);
  return { total, shown, hidden, completed, filtered, label: hidden ? `${hidden} more not shown · tap to see` : '', why: parts.join(', ') };
};
