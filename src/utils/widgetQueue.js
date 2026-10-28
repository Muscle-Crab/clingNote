// Widget "complete task" queue drain. Pure (no imports besides widgetSnapshot) so it is unit-tested in node (scripts/test-widget.mjs).
// The iOS 17 widget (CompleteTaskIntent) appends {taskId, day, ts} to the App Group queue and optimistically shows the task done.
// The app drains it on launch/foreground through HomeView's own toggleTaskCompletion (points, streak, boss, daily report, one-time removal).
// The optional widget-complete function may already have written completed=true + widgetEffectsPending=true: then the app still
// runs its completion path once (effects), never a second toggle.
import { widgetTaskId } from './widgetSnapshot.js';

export const MAX_AGE_MS = 36 * 3600 * 1000;
export const entryKey = (e) => `${e && e.taskId}@${e && e.ts}`;

// -> 'complete' | 'effects' | 'already-done' | 'missing' | 'stale' | 'invalid'
// A tap made yesterday (entry.day === yesterday, within MAX_AGE_MS) is 'prior-day' (when classified without its day's tasks):
// it is applied to the day it was made, not dropped. Older days / older than MAX_AGE_MS stay 'stale'.
export const classifyEntry = (entry, tasks, { today, yesterday, now = Date.now() } = {}) => {
  if (!entry || typeof entry.taskId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.taskId)) return 'invalid';
  if (Number(entry.ts) && now - Number(entry.ts) > MAX_AGE_MS) return 'stale';
  if (entry.day && today && entry.day !== today) return (yesterday && entry.day === yesterday) ? 'prior-day' : 'stale';
  const t = (tasks || []).find((x) => x && widgetTaskId(x) === entry.taskId);
  if (!t) return 'missing'; // deleted, or a one-time task already completed and removed
  if (t.completed === true) return t.widgetEffectsPending === true ? 'effects' : 'already-done';
  return 'complete';
};

// queue: entries from the App Group. getTasks(): today's current task list (re-read after every completion — indices shift).
// complete(taskId, mode): runs the app's completion path; resolve true on success, false/throw to retry later.
// Returns { acked: [entryKey], kept: [entryKey], results: [{taskId, action, ok}] }; ack(acked) removes only those entries.
// completePrior(taskId, day): optional; marks the task done on the day the tap was made. Without it prior-day taps are kept.
export const drainQueue = async ({ queue, getTasks, complete, completePrior, today, yesterday, now = Date.now() }) => {
  const acked = [], kept = [], results = [], seen = new Set();
  const list = (Array.isArray(queue) ? queue : []).slice().sort((a, b) => (Number(a && a.ts) || 0) - (Number(b && b.ts) || 0));
  for (const e of list) {
    const k = entryKey(e);
    if (e && seen.has(e.taskId)) { acked.push(k); results.push({ taskId: e.taskId, action: 'duplicate', ok: true }); continue; }
    const action = classifyEntry(e, await getTasks(), { today, yesterday, now });
    if (action === 'prior-day') {
      let ok = false;
      try { ok = !!completePrior && (await completePrior(e.taskId, e.day)) === true; } catch (err) { ok = false; }
      (ok ? acked : kept).push(k); results.push({ taskId: e.taskId, action, ok });
      continue; // a prior-day tap never dedupes a same-id tap for today
    }
    if (e && typeof e.taskId === 'string') seen.add(e.taskId);
    if (action === 'complete' || action === 'effects') {
      let ok = false;
      try { ok = (await complete(e.taskId, action)) === true; } catch (err) { ok = false; }
      (ok ? acked : kept).push(k); results.push({ taskId: e.taskId, action, ok });
      if (!ok) seen.delete(e.taskId);
    } else { acked.push(k); results.push({ taskId: e && e.taskId, action, ok: true }); }
  }
  return { acked, kept, results };
};
