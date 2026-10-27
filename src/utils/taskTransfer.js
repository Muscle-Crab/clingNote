// Task export/import (pure; no Firestore). Export = JSON backup (re-importable) or CSV (spreadsheets).
// Import = JSON only, validated field by field, deduped against what the user already has and within the file.
// Shape: { app: 'ClingNote', kind: 'tasks', version: 1, exportedAt, days: { Sun: [task], ... Sat: [task] }, scheduled: [entry] }
export const EXPORT_VERSION = 1;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const IMPORT_LIMITS = { bytes: 2 * 1024 * 1024, tasks: 2000, perDay: 200, scheduled: 300, title: 300, text: 4000 };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = IMPORT_LIMITS.text) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, lo = 0, hi = 100000) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/; const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const date = (v) => (typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? v : '');
const time = (v) => (typeof v === 'string' && TIME.test(v) ? v : '');
const iso = (v) => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : '');
const oneOf = (v, list) => (list.includes(v) ? v : undefined);
const IMPORTANCE = ['low', 'medium', 'high', 'critical'];
const TYPES = ['one-time', 'recurring'];

// Keep only known task fields with the right types (drops timers, boss flags, materialization links, unknown keys).
export const cleanTask = (raw) => {
  if (!isObj(raw)) return null;
  const title = str(raw.title, IMPORT_LIMITS.title);
  if (!title) return null;
  const t = { title };
  const type = oneOf(raw.type, TYPES); if (type) t.type = type;
  const imp = oneOf(raw.importance, IMPORTANCE); if (imp) t.importance = imp;
  const pr = oneOf(raw.priority, IMPORTANCE); if (pr) t.priority = pr;
  for (const k of ['category', 'nextAction']) { const v = str(raw[k], 120); if (v) t[k] = v; }
  const notes = str(raw.notes); if (notes) t.notes = notes;
  for (const [k, hi] of [['estimateMin', 24 * 60], ['points', 10000], ['complexity', 10]]) { const v = num(raw[k], 0, hi); if (v !== undefined) t[k] = v; }
  const st = time(raw.startTime); if (st) t.startTime = st;
  const tm = time(raw.time); if (tm) t.time = tm;
  const due = date(raw.dueDate) || date(raw.scheduledFor); if (due) t.dueDate = due;
  if (Array.isArray(raw.labels)) { const l = raw.labels.map((x) => str(x, 40)).filter(Boolean).slice(0, 20); if (l.length) t.labels = l; }
  if (Array.isArray(raw.repeatDays)) { const r = [...new Set(raw.repeatDays.filter((x) => DAY_NAMES.includes(x) || (Number.isInteger(x) && x >= 0 && x <= 6)))]; if (r.length) t.repeatDays = r; }
  if (Array.isArray(raw.subtasks)) {
    const s = raw.subtasks.filter(isObj).map((x, i) => ({ id: str(x.id, 40) || `i${i}`, title: str(x.title, 200), done: x.done === true })).filter((x) => x.title).slice(0, 50);
    if (s.length) t.subtasks = s;
  }
  const c = iso(raw.createdAt); if (c) t.createdAt = c;
  const id = str(raw.id, 80); if (id) t.id = id;
  t.completed = raw.completed === true;
  return t;
};

const cleanScheduled = (raw) => {
  if (!isObj(raw)) return null;
  const base = cleanTask(raw); if (!base) return null;
  const d = date(raw.scheduledDate); if (!d) return null;
  const { completed, dueDate, ...rest } = base; // eslint-disable-line no-unused-vars
  const e = { ...rest, scheduledDate: d, scheduledTime: time(raw.scheduledTime) };
  if (raw.done === true) e.done = true;
  if (!e.id) e.id = '';
  return e;
};

const normTitle = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const dayKey = (t) => `${normTitle(t.title)}|${t.startTime || t.time || ''}|${t.dueDate || ''}`;
const refKey = (t) => (t.createdAt ? `${t.createdAt}|${t.title}` : '');
const schedKey = (e) => `${normTitle(e.title)}|${e.scheduledDate}|${e.scheduledTime || ''}`;

// Build the export object. dayLists: { Sun: task[], ... }, scheduled: entry[].
export const buildExport = ({ dayLists = {}, scheduled = [], now = new Date() } = {}) => ({
  app: 'ClingNote', kind: 'tasks', version: EXPORT_VERSION, exportedAt: now.toISOString(),
  days: Object.fromEntries(DAY_NAMES.map((d) => [d, (dayLists[d] || []).map(cleanTask).filter(Boolean)])),
  scheduled: (scheduled || []).filter((e) => e && !e.materializedAt).map((e) => ({ ...cleanScheduled(e), ...(e.recurrence ? { recurrence: e.recurrence } : {}) })).filter((e) => e && e.title),
});

export const CSV_COLUMNS = ['list', 'title', 'date', 'time', 'completed', 'type', 'importance', 'category', 'estimateMin', 'points', 'labels', 'notes', 'createdAt', 'id'];
const csvCell = (v) => {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (exp) => {
  const rows = [CSV_COLUMNS.join(',')];
  const push = (list, t, d, tm, done) => rows.push([list, t.title, d, tm, done ? 'yes' : 'no', t.type || '', t.importance || '', t.category || '', t.estimateMin ?? '', t.points ?? '',
    (t.labels || []).join('; '), t.notes || '', t.createdAt || '', t.id || ''].map(csvCell).join(','));
  for (const d of DAY_NAMES) for (const t of (exp.days || {})[d] || []) push(d, t, t.dueDate || '', t.startTime || t.time || '', t.completed);
  for (const e of exp.scheduled || []) push(e.recurrence ? 'repeating' : 'scheduled', e, e.scheduledDate, e.scheduledTime, e.done);
  return `${rows.join('\r\n')}\r\n`;
};

// Parse + validate an import file. -> { ok, error?, data: { days, scheduled }, skipped, warnings }
export const parseImport = (text) => {
  if (typeof text === 'string' && text.length > IMPORT_LIMITS.bytes) return { ok: false, error: 'The file is too large (max 2 MB).' };
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
  let raw; try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { return { ok: false, error: 'Not a valid JSON file. Import a ClingNote JSON export.' }; }
  if (!isObj(raw)) return { ok: false, error: 'Unrecognized file: expected a ClingNote export.' };
  if (raw.app !== undefined && raw.app !== 'ClingNote') return { ok: false, error: 'This file is not a ClingNote export.' };
  if (typeof raw.version === 'number' && raw.version > EXPORT_VERSION) return { ok: false, error: 'This export is from a newer version of ClingNote. Update the app and try again.' };
  if (!isObj(raw.days) && !Array.isArray(raw.scheduled)) return { ok: false, error: 'No tasks found in this file.' };
  let skipped = 0; const days = {}; let total = 0;
  for (const d of DAY_NAMES) {
    const list = isObj(raw.days) && Array.isArray(raw.days[d]) ? raw.days[d] : [];
    days[d] = [];
    for (const r of list) { const t = cleanTask(r); if (!t) { skipped += 1; continue; } days[d].push(t); total += 1; }
  }
  const scheduled = [];
  for (const r of Array.isArray(raw.scheduled) ? raw.scheduled : []) {
    const e = cleanScheduled(r); if (!e) { skipped += 1; continue; }
    if (isObj(r.recurrence) && ['daily', 'weekly', 'monthly'].includes(r.recurrence.freq)) e.recurrence = { freq: r.recurrence.freq, ...(Array.isArray(r.recurrence.days) ? { days: r.recurrence.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) } : {}), ...(date(r.recurrence.until) ? { until: r.recurrence.until } : {}) };
    scheduled.push(e); total += 1;
  }
  if (total > IMPORT_LIMITS.tasks) return { ok: false, error: `Too many tasks (${total}); the limit is ${IMPORT_LIMITS.tasks}.` };
  if (!total) return { ok: false, error: skipped ? 'No valid tasks found (every row was missing a title or had bad fields).' : 'No tasks found in this file.' };
  return { ok: true, data: { days, scheduled }, skipped, total };
};

// Merge parsed import into the user's current data. existing: { days: {Sun: task[]...}, scheduled: entry[] }
// opts: { lockedDays: ['Fri'], now: Date, makeId: () => string }. Completed one-time tasks are skipped (the app removes them on completion);
// imported tasks arrive open. -> { days: {Day: newTasksToAppend}, scheduled: newEntries, counts: { added, duplicates, skippedLocked, skippedDone, skippedFull, skippedLimit } }
export const planImport = (data, existing = {}, opts = {}) => {
  const now = opts.now || new Date(); let seq = 0;
  const makeId = opts.makeId || (() => `s${now.getTime().toString(36)}i${(seq++).toString(36)}`);
  const locked = new Set(opts.lockedDays || []);
  const counts = { added: 0, duplicates: 0, skippedLocked: 0, skippedDone: 0, skippedFull: 0, skippedLimit: 0 };
  // Daily task limit: tasks without a createdAt are stamped now and count toward today (freshRoom = remaining today);
  // scheduled one-offs count on their date (scheduledRoom(date) = remaining that day). Missing options = no limit.
  let fresh = Number.isFinite(opts.freshRoom) ? Math.max(0, opts.freshRoom) : Infinity;
  const roomUsed = {}; const room = (d) => (typeof opts.scheduledRoom === 'function' ? opts.scheduledRoom(d) - (roomUsed[d] || 0) : Infinity);
  const out = { days: {}, scheduled: [] };
  let stamp = now.getTime() - 1000 * 60; // distinct createdAt for tasks missing one (identity is createdAt|title)
  for (const d of DAY_NAMES) {
    const have = (existing.days || {})[d] || [];
    const seenRef = new Set(have.map(refKey).filter(Boolean)); const seenKey = new Set(have.map(dayKey));
    const add = [];
    for (const t0 of (data.days || {})[d] || []) {
      if (locked.has(d)) { counts.skippedLocked += 1; continue; }
      if (t0.completed && t0.type !== 'recurring') { counts.skippedDone += 1; continue; }
      const r = refKey(t0); const k = dayKey(t0);
      if ((r && seenRef.has(r)) || seenKey.has(k)) { counts.duplicates += 1; continue; }
      if (have.length + add.length >= IMPORT_LIMITS.perDay) { counts.skippedFull += 1; continue; }
      if (!t0.createdAt) { if (fresh <= 0) { counts.skippedLimit += 1; continue; } fresh -= 1; }
      const t = { ...t0, completed: false, status: 'active', type: t0.type || 'one-time', createdAt: t0.createdAt || new Date(stamp += 7).toISOString() };
      delete t.id; // ids are per-account; identity falls back to createdAt|title
      if (r) seenRef.add(r); seenKey.add(k); add.push(t); counts.added += 1;
    }
    if (add.length) out.days[d] = add;
  }
  const haveS = existing.scheduled || [];
  const ids = new Set(haveS.map((e) => e && e.id).filter(Boolean)); const keys = new Set(haveS.map((e) => e && schedKey(e)));
  for (const e0 of data.scheduled || []) {
    if (e0.done) { counts.skippedDone += 1; continue; }
    if ((e0.id && ids.has(e0.id)) || keys.has(schedKey(e0))) { counts.duplicates += 1; continue; }
    if (haveS.length + out.scheduled.length >= IMPORT_LIMITS.scheduled) { counts.skippedFull += 1; continue; }
    if (!e0.recurrence) { if (room(e0.scheduledDate) <= 0) { counts.skippedLimit += 1; continue; } roomUsed[e0.scheduledDate] = (roomUsed[e0.scheduledDate] || 0) + 1; }
    const e = { ...e0, id: e0.id && /^[A-Za-z0-9_-]{1,40}$/.test(e0.id) ? e0.id : makeId() };
    if (ids.has(e.id)) e.id = makeId();
    ids.add(e.id); keys.add(schedKey(e)); out.scheduled.push(e); counts.added += 1;
  }
  return { ...out, counts };
};

export const importSummary = (c, skippedInvalid = 0) => {
  const parts = [`Imported ${c.added} task${c.added === 1 ? '' : 's'}`];
  if (c.duplicates) parts.push(`${c.duplicates} duplicate${c.duplicates === 1 ? '' : 's'} skipped`);
  if (c.skippedDone) parts.push(`${c.skippedDone} completed skipped`);
  if (c.skippedLocked) parts.push(`${c.skippedLocked} skipped (locked day)`);
  if (c.skippedFull) parts.push(`${c.skippedFull} skipped (list full)`);
  if (c.skippedLimit) parts.push(`${c.skippedLimit} over the daily task limit`);
  if (skippedInvalid) parts.push(`${skippedInvalid} invalid`);
  return `${parts.join(' · ')}.`;
};

export const exportFileName = (ext, now = new Date()) => `clingnote-tasks-${now.toISOString().slice(0, 10)}.${ext}`;
