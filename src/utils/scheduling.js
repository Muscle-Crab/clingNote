// Pure helpers for "schedule for later" tasks. Scheduled tasks live in their own Firestore doc
// (users/{userId}.scheduledTasks -> { tasks: [...] }) and never touch weeklyRoutines until their date arrives.
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

// ── Visibility (single source of truth) ──
// A scheduled task becomes visible from Monday (local) of the Mon–Sun week containing its date.
// Before that it is hidden everywhere (day lists, carry-over, streak, points, discipline/gate counts),
// because it only exists in users/{uid}.scheduledTasks until it is materialized into a day list.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }; // noon: DST-safe
export const addDaysStr = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const mondayOf = (s) => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const sundayOf = (s) => addDaysStr(mondayOf(s), 6);
// Changed (scheduling v2): a scheduled task / recurring occurrence appears ON its date (it used to show from the Monday of its week,
// which put a whole week of daily occurrences on Monday). Future ones show in Upcoming and as week-strip dots.
export const visibleFrom = (dateStr) => dateStr;
export const isScheduledVisible = (dateStr, todayStr) => !isValidDate(dateStr) || visibleFrom(dateStr) <= todayStr;
// For tasks already in a day list: materialized scheduled tasks carry `scheduledFor`.
export const isTaskVisibleOn = (task, todayStr) => !task?.scheduledFor || isScheduledVisible(task.scheduledFor, todayStr);

export const isMaterialized = (e) => !!e?.materializedAt;
export const isTemplate = (e) => !!e?.recurrence;
export const upcomingOf = (list) => (list || []).filter((e) => e && !isTemplate(e) && !isMaterialized(e) && isValidDate(e.scheduledDate));
export const dueOf = (list, todayStr) => upcomingOf(list).filter((e) => isScheduledVisible(e.scheduledDate, todayStr));
// "Upcoming" = due after the current week.
export const futureOf = (list, todayStr) => upcomingOf(list).filter((e) => !isScheduledVisible(e.scheduledDate, todayStr))
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
export const countsByDate = (list, todayStr) => {
  const items = list || [];
  const m = {};
  const have = new Set(items.map((e) => e?.id));
  items.filter((e) => e && !isTemplate(e) && isValidDate(e.scheduledDate) && e.scheduledDate > todayStr).forEach((e) => { m[e.scheduledDate] = (m[e.scheduledDate] || 0) + 1; });
  // template occurrences not yet expanded (next 7 days)
  items.filter((e) => isTemplate(e) && !e.stopped).forEach((t) => occurrencesBetween(t, addDaysStr(todayStr, 1), addDaysStr(todayStr, 7))
    .forEach((d) => { if (!have.has(instanceId(t.id, d))) m[d] = (m[d] || 0) + 1; }));
  return m;
};

// Turn a scheduled entry into a regular one-time task for today's list.
export const toTodayTask = (entry, todayStr, createdAtIso) => {
  const { id, scheduledDate, scheduledTime, materializedAt, ...rest } = entry;
  const { templateId, recurrence, generated, startDate, ...fields } = rest;
  const task = { ...fields, completed: false, important: !!rest.important, type: 'one-time', createdAt: createdAtIso, scheduledId: id, scheduledFor: scheduledDate, dueDate: rest.dueDate || scheduledDate };
  if (templateId) task.templateId = templateId;
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
    if (!e || isTemplate(e) || isMaterialized(e) || !isValidDate(e.scheduledDate) || !isScheduledVisible(e.scheduledDate, todayStr)) return e;
    changed = true;
    if (!have.has(e.id)) {
      toAdd.push(toTodayTask(e, todayStr, new Date(base + toAdd.length).toISOString()));
      have.add(e.id);
    }
    return { ...e, materializedAt: nowIso, materializedDate: todayStr };
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

// Actual calendar dates (YYYY-MM-DD, local) of the Sun..Sat tabs for the week containing `now`.
// Same math as the header: date = today + (tabIndex - today.getDay()).
export const weekDates = (now = new Date()) => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i - now.getDay()));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

// Tabs with `date` filled from the computed week (data.json days carry empty dates).
export const withWeekDates = (days, now = new Date()) => {
  const dates = weekDates(now);
  return (days || []).map((d, i) => ({ ...d, date: dates[i] || d.date }));
};

// Badge text for a materialized task: 'Due Fri Oct 30' (or 'Due today' / 'Overdue · Fri Oct 30').
export const dueBadge = (task, todayStr) => {
  if (!task?.scheduledFor || !isValidDate(task.scheduledFor)) return '';
  const label = parse(task.scheduledFor).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
  if (task.scheduledFor === todayStr) return 'Due today';
  return task.scheduledFor < todayStr ? `Overdue · ${label}` : `Due ${label}`;
};

// Roll-forward: an unfinished scheduled task stays in front of you every day of its week until its date.
// Returns entries whose materialized copy should move from `materializedDate`'s list to today's.
// After the due date it stops moving and is treated like any other overdue task (shutdown carry-over).
export const rollForwardOf = (list, todayStr) => (list || []).filter((e) => isMaterialized(e) && !isTemplate(e) && e.materializedDate
  && e.materializedDate < todayStr && e.scheduledDate >= todayStr && mondayOf(e.materializedDate) === mondayOf(todayStr) && !e.done);

// ── Recurrence ── template entry: { id, title, ..., recurrence: { freq: 'weekly'|'daily'|'monthly', days?: [0-6], dayOfMonth? }, startDate, generated: [dates] }
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const occursOn = (tpl, dateStr) => {
  const r = tpl?.recurrence;
  if (!r || !isValidDate(dateStr) || (tpl.startDate && dateStr < tpl.startDate) || (r.until && dateStr > r.until) || (tpl.skip || []).includes(dateStr)) return false;
  const d = parse(dateStr);
  if (r.freq === 'daily') return true;
  if (r.freq === 'weekly') return (r.days || []).includes(d.getDay());
  if (r.freq === 'monthly') { const dom = Number(r.dayOfMonth) || parse(tpl.startDate || dateStr).getDate(); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return d.getDate() === Math.min(dom, last); }
  return false;
};
export const occurrencesBetween = (tpl, from, to, max = 400) => {
  const out = [];
  for (let d = from; d <= to && out.length < max; d = addDaysStr(d, 1)) if (occursOn(tpl, d)) out.push(d);
  return out;
};
export const nextOccurrences = (tpl, afterDate, n = 4, horizonDays = 120) => occurrencesBetween(tpl, addDaysStr(afterDate, 1), addDaysStr(afterDate, horizonDays)).slice(0, n);
export const instanceId = (templateId, date) => `${templateId}_${date}`;

// Create an instance entry for each occurrence in the current (visible) week. Idempotent: keyed by templateId+date,
// skipped if already generated or already present in the list.
export const expandRecurring = (list, todayStr) => {
  const items = list || [];
  const have = new Set(items.map((e) => e?.id));
  const weekStart = mondayOf(todayStr); const weekEnd = sundayOf(todayStr);
  const added = [];
  const next = items.map((e) => {
    if (!isTemplate(e) || e.stopped) return e;
    const gen = new Set(e.generated || []);
    const from = e.startDate && e.startDate > weekStart ? e.startDate : weekStart;
    let changed = false;
    occurrencesBetween(e, from, weekEnd).forEach((date) => {
      const id = instanceId(e.id, date);
      if (gen.has(date) || have.has(id)) { if (!gen.has(date)) { gen.add(date); changed = true; } return; }
      const { recurrence, generated, startDate, stopped, materializedAt, materializedDate, ...fields } = e;
      const { skip, ...rest } = fields;
      added.push({ ...rest, id, templateId: e.id, scheduledDate: date, repeatText: describeRecurrence(recurrence) });
      have.add(id); gen.add(date); changed = true;
    });
    if (!changed) return e;
    return { ...e, generated: [...gen].filter((d) => d >= addDaysStr(weekStart, -14)).sort() };
  });
  return { list: [...next, ...added], added };
};

export const buildRecurringTemplate = (fields, startDate, recurrence, id = makeScheduledId()) => {
  const base = buildScheduledEntry(fields, startDate, fields?.scheduledTime || '', id);
  if (!base || !recurrence?.freq) return null;
  const r = { freq: recurrence.freq };
  if (r.freq === 'weekly') { r.days = [...new Set((recurrence.days || []).map(Number))].filter((d) => d >= 0 && d <= 6).sort(); if (!r.days.length) r.days = [parse(startDate).getDay()]; }
  if (r.freq === 'monthly') r.dayOfMonth = Number(recurrence.dayOfMonth) || parse(startDate).getDate();
  if (isValidDate(recurrence.until) && recurrence.until >= startDate) r.until = recurrence.until;
  const { scheduledDate, ...rest } = base;
  return { ...rest, startDate, recurrence: r, generated: [], skip: [] };
};
export const describeRecurrence = (r) => {
  if (!r) return '';
  if (r.freq === 'daily') return 'Every day';
  if (r.freq === 'weekly') return `Every ${(r.days || []).map((d) => WEEKDAYS[d]).join(', ')}`;
  if (r.freq === 'monthly') return `Monthly on day ${r.dayOfMonth}`;
  return '';
};

export const templatesOf = (list) => (list || []).filter((e) => isTemplate(e) && !e.stopped);
export const fmtTime = (hhmm) => { if (!isValidTime(hhmm)) return ''; const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
// Small label for a task card / list row: '🔁 Every Mon, Wed · 9:00 AM' or '⏰ 9:00 AM'.
export const scheduleLabel = (t, tpl = null) => {
  if (!t) return '';
  const time = fmtTime(t.scheduledTime || (t.scheduledFor ? t.time : '') || '');
  const rec = tpl?.recurrence || t.recurrence;
  if (rec || t.templateId) return `🔁 ${rec ? describeRecurrence(rec) : (t.repeatText || 'Repeats')}${time ? ` · ${time}` : ''}`;
  if (t.scheduledFor || t.scheduledDate) return time ? `⏰ ${time}` : '⏰ Scheduled';
  return '';
};
// Overdue once the scheduled date+time has passed (date-only: after that day ends).
export const scheduledOverdue = (t, now = new Date()) => {
  const date = t?.scheduledFor || t?.scheduledDate;
  if (!date || !isValidDate(date) || t.completed) return false;
  const time = isValidTime(t.scheduledTime) ? t.scheduledTime : (isValidTime(t.time) && t.scheduledFor ? t.time : '');
  const [y, mo, d] = date.split('-').map(Number);
  const at = time ? new Date(y, mo - 1, d, ...time.split(':').map(Number)) : new Date(y, mo - 1, d + 1);
  return now.getTime() >= at.getTime();
};
