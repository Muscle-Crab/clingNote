// Pure helpers for subtasks. Subtasks are optional ({ id, title, done }[]) on a task, so old tasks work unchanged.
// They never count toward the active-task cap or the progress percentage (those only look at top-level tasks).
export const subtasksOf = (t) => (Array.isArray(t?.subtasks) ? t.subtasks : []);

export const subtaskProgress = (t) => {
  const list = subtasksOf(t);
  return { done: list.filter((s) => s.done).length, total: list.length };
};

const makeId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Each helper returns a NEW array (safe to hand to the persistence patch helper).
export const addSubtask = (list, title) => {
  const clean = (title || '').trim();
  return clean ? [...(list || []), { id: makeId(), title: clean, done: false }] : [...(list || [])];
};
export const renameSubtask = (list, id, title) => {
  const clean = (title || '').trim();
  if (!clean) return [...(list || [])];
  return (list || []).map((s) => (s.id === id ? { ...s, title: clean } : s));
};
export const toggleSubtask = (list, id) => (list || []).map((s) => (s.id === id ? { ...s, done: !s.done } : s));
export const removeSubtask = (list, id) => (list || []).filter((s) => s.id !== id);

// True when the task opted in, is still open, has subtasks and all of them are done.
export const shouldAutoComplete = (t) => {
  const { done, total } = subtaskProgress(t);
  return !!t?.autoCompleteParent && !t?.completed && total > 0 && done === total;
};

// Recurring tasks start each day fresh: clear subtask check marks when the task is reset.
export const resetSubtasks = (t) => {
  const list = subtasksOf(t);
  return list.length ? { ...t, subtasks: list.map((s) => ({ ...s, done: false })) } : t;
};
