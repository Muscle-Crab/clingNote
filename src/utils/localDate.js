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
  // Completed early for a later day (tomorrow, from the evening planning window): belongs to that day, not to completedAt's.
  if (/^\d{4}-\d{2}-\d{2}$/.test(task.completedFor || '')) return task.completedFor < lastOccurrenceYMD(dayIdx, now);
  const c = new Date(task.completedAt);
  if (Number.isNaN(c.getTime())) return false;
  return localYMD(c) < lastOccurrenceYMD(dayIdx, now);
};

// Day rollover for completed one-time tasks (incl. repeat-series copies, stored as one-time with templateId): they stay in the
// Completed section all day and leave the list once completed before this weekday's latest local occurrence (i.e. after local midnight).
export const pruneStaleDay = (tasks, dayIdx, now = new Date()) => (tasks || []).filter((t) => !(t && t.type === 'one-time' && isStaleCompletion(t, dayIdx, now)));
// Completed one-time tasks leave the active list at rollover, but the record stays on this device.
export const ARCHIVE_KEY = 'cn.completed.archive.v1';
export const rememberCompleted = (storage, tasks) => {
  const add = (tasks || []).filter((t) => t && t.title);
  if (!add.length || !storage) return [];
  let prev = [];
  try { prev = JSON.parse(storage.getItem(ARCHIVE_KEY) || '[]'); } catch (e) { prev = []; }
  if (!Array.isArray(prev)) prev = [];
  const seen = new Set(prev.map((t) => `${t && t.id}|${t && t.createdAt}|${t && t.title}`));
  const next = prev.slice();
  add.forEach((t) => { const k = `${t.id}|${t.createdAt}|${t.title}`; if (!seen.has(k)) { seen.add(k); next.push({ id: t.id, title: t.title, createdAt: t.createdAt, completedAt: t.completedAt, points: t.points, type: t.type }); } });
  const capped = next.slice(-200);
  try { storage.setItem(ARCHIVE_KEY, JSON.stringify(capped)); } catch (e) { /* ignore */ }
  return capped;
};
