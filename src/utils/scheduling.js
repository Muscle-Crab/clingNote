// Pure helpers for "schedule for later" tasks. Scheduled tasks live in their own Firestore doc
// (scheduledTasks/{userId} -> { tasks: [...] }) and never touch weeklyRoutines until their date arrives.
// Entry shape: { id, title, ...task fields, scheduledDate: 'YYYY-MM-DD', scheduledTime: 'HH:MM'|'', materializedAt?: ISO }

export const isValidDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const isValidTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

let seq = 0;
export const makeScheduledId = (now = Date.now()) => `s${now.toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Build a scheduled entry from loose task fields; returns null if the date is invalid.
export const buildScheduledEntry = (fields, date, time, id = makeScheduledId()) => {
  if (!isValidDate(date)) return null;
  const title = String(fields?.title || '').trim();
  if (!title) return null;
  const { materializedAt, scheduledId, scheduledFor, reminder, completed, ...rest } = fields || {};
  return { ...rest, title, id, scheduledDate: date, scheduledTime: isValidTime(time) ? time : '' };
};

export const isMaterialized = (e) => !!e?.materializedAt;
export const upcomingOf = (list) => (list || []).filter((e) => e && !isMaterialized(e) && isValidDate(e.scheduledDate));
export const dueOf = (list, todayStr) => upcomingOf(list).filter((e) => e.scheduledDate <= todayStr);
export const futureOf = (list, todayStr) => upcomingOf(list).filter((e) => e.scheduledDate > todayStr)
  .sort((a, b) => (a.scheduledDate + (a.scheduledTime || '99:99')).localeCompare(b.scheduledDate + (b.scheduledTime || '99:99')));

export const groupByDate = (entries) => {
  const groups = [];
  (entries || []).forEach((e) => {
    let g = groups[groups.length - 1];
    if (!g || g.date !== e.scheduledDate) { g = { date: e.scheduledDate, tasks: [] }; groups.push(g); }
    g.tasks.push(e);
  });
  return groups;
};

// { 'YYYY-MM-DD': count } of future scheduled tasks (week-strip dots).
export const countsByDate = (list, todayStr) => futureOf(list, todayStr).reduce((m, e) => { m[e.scheduledDate] = (m[e.scheduledDate] || 0) + 1; return m; }, {});

// Turn a scheduled entry into a regular one-time task for today's list.
export const toTodayTask = (entry, todayStr, createdAtIso) => {
  const { id, scheduledDate, scheduledTime, materializedAt, ...rest } = entry;
  const task = { ...rest, completed: false, important: !!rest.important, type: 'one-time', createdAt: createdAtIso, scheduledId: id, scheduledFor: scheduledDate };
  if (scheduledTime) {
    task.startTime = rest.startTime || scheduledTime;
    task.time = scheduledTime;
    task.reminder = { date: todayStr, time: scheduledTime, repeat: '' }; // existing reminder field (display only; no delivery here)
  }
  return task;
};

// Idempotent materialization. `todayTasks` = tasks already in today's weeklyRoutines doc.
// Returns { toAdd, scheduled (entries with materializedAt set), changed }.
// An entry whose scheduledId already exists in todayTasks is marked materialized but not added again.
export const materializeDue = ({ scheduled, todayStr, todayTasks, nowIso }) => {
  const have = new Set((todayTasks || []).map((t) => t?.scheduledId).filter(Boolean));
  const base = new Date(nowIso).getTime();
  const toAdd = [];
  let changed = false;
  const next = (scheduled || []).map((e) => {
    if (!e || isMaterialized(e) || !isValidDate(e.scheduledDate) || e.scheduledDate > todayStr) return e;
    changed = true;
    if (!have.has(e.id)) {
      toAdd.push(toTodayTask(e, todayStr, new Date(base + toAdd.length).toISOString()));
      have.add(e.id);
    }
    return { ...e, materializedAt: nowIso };
  });
  return { toAdd, scheduled: next, changed };
};

// Drop materialized records older than `days` so the doc stays small.
export const pruneMaterialized = (list, nowIso, days = 30) => {
  const cutoff = new Date(nowIso).getTime() - days * 86400000;
  return (list || []).filter((e) => !isMaterialized(e) || new Date(e.materializedAt).getTime() >= cutoff);
};

export const removeScheduled = (list, id) => (list || []).filter((e) => e.id !== id);
export const rescheduleEntry = (list, id, date, time) => {
  if (!isValidDate(date)) return list || [];
  return (list || []).map((e) => (e.id === id && !isMaterialized(e) ? { ...e, scheduledDate: date, scheduledTime: isValidTime(time) ? time : '' } : e));
};

export const formatScheduledDate = (s, todayStr) => {
  if (!isValidDate(s)) return s || '';
  if (todayStr) {
    const diff = Math.round((new Date(`${s}T00:00:00Z`) - new Date(`${todayStr}T00:00:00Z`)) / 86400000);
    if (diff === 1) return 'Tomorrow';
  }
  return new Date(`${s}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
