// Shared local-calendar date helpers (the phone's own timezone, never UTC).
// Pure (no imports) so node tests can import it.
const pad = (n) => String(n).padStart(2, '0');
// Local YYYY-MM-DD for a Date (default: now).
export const localYMD = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Local YYYY-MM-DD n days from d (DST-safe: uses calendar setDate, not ms math).
export const localYMDOffset = (n, d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() + n); return localYMD(x); };
// Local YYYY-MM-DD of the most recent occurrence (today included) of weekday dayIdx (0=Sun..6=Sat).
export const lastOccurrenceYMD = (dayIdx, now = new Date()) => localYMDOffset(-(((now.getDay() - dayIdx) % 7) + 7) % 7, now);
// A completed task on weekday dayIdx is left over from an older week when its completedAt local date is
// before that weekday's most recent occurrence. Tasks without a parsable completedAt are never treated as stale.
export const isStaleCompletion = (task, dayIdx, now = new Date()) => {
  if (!task || !task.completed || !task.completedAt) return false;
  const c = new Date(task.completedAt);
  if (Number.isNaN(c.getTime())) return false;
  return localYMD(c) < lastOccurrenceYMD(dayIdx, now);
};
