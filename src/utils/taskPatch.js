// Pure helpers for saving inline task edits without losing quick successive ones.
import { taskKey } from '@/utils/taskPlanning';

// Run async jobs one at a time per key (a failed job never blocks the next one).
export const createKeyedQueue = () => {
  const tails = new Map();
  return (key, job) => {
    const prev = tails.get(key) || Promise.resolve();
    const run = prev.then(job, job);
    const tail = run.catch(() => {});
    tails.set(key, tail);
    tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    return run;
  };
};

// Merge `patch` into the stored task matching `task` (by key, falling back to index); returns a new list or null.
export const applyTaskPatch = (tasks, task, fallbackIndex, patch) => {
  const list = Array.isArray(tasks) ? tasks.slice() : [];
  let i = list.findIndex((t) => taskKey(t) === taskKey(task));
  if (i < 0) i = fallbackIndex;
  if (!list[i]) return null;
  list[i] = { ...list[i], ...patch };
  return list;
};
