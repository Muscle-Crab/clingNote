// Pure iCalendar (RFC 5545) builder for the subscribable feed and per-task "Add to calendar" downloads.
// Times are "floating" local times (no TZID): 3 PM shows as 3 PM in the subscriber's own calendar.
const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const escapeText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
// Fold lines > 75 octets (approximate by chars) with CRLF + space.
export const foldLine = (line) => { const out = []; let s = line; while (s.length > 75) { out.push(s.slice(0, 75)); s = ` ${s.slice(75)}`; } out.push(s); return out.join('\r\n'); };
const d8 = (ds) => ds.replace(/-/g, '');
const addDay = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10); };
const stamp = (now) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const validTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// ev: { uid, title, date: 'YYYY-MM-DD', time?: 'HH:MM', minutes?, notes?, rrule? }
export const eventLines = (ev, now = new Date()) => {
  if (!validDate(ev?.date) || !String(ev?.title || '').trim()) return [];
  const L = ['BEGIN:VEVENT', `UID:${String(ev.uid).replace(/[^\w.@-]/g, '')}@clingnot`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${escapeText(ev.title)}`];
  if (validTime(ev.time)) {
    const [h, m] = ev.time.split(':').map(Number); const mins = Math.max(15, Number(ev.minutes) || 30);
    const start = new Date(Date.UTC(...ev.date.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), h, m));
    const end = new Date(start.getTime() + mins * 60000);
    const f = (d) => d.toISOString().replace(/[-:]/g, '').slice(0, 15);
    L.push(`DTSTART:${f(start)}`, `DTEND:${f(end)}`);
  } else L.push(`DTSTART;VALUE=DATE:${d8(ev.date)}`, `DTEND;VALUE=DATE:${d8(addDay(ev.date))}`);
  if (ev.rrule) L.push(`RRULE:${ev.rrule}`);
  if (ev.notes) L.push(`DESCRIPTION:${escapeText(String(ev.notes).slice(0, 1000))}`);
  L.push('END:VEVENT');
  return L;
};

export const buildCalendar = (events, name = 'ClingNote tasks', now = new Date()) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClingNote//Tasks//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  `X-WR-CALNAME:${escapeText(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ...events.flatMap((e) => eventLines(e, now)), 'END:VCALENDAR',
].map(foldLine).join('\r\n') + '\r\n';

export const rruleFor = (r) => {
  if (!r) return '';
  if (r.freq === 'daily') return 'FREQ=DAILY';
  if (r.freq === 'weekly') return `FREQ=WEEKLY;BYDAY=${(r.days || []).map((d) => WD[d]).join(',')}`;
  if (r.freq === 'interval') return `FREQ=DAILY;INTERVAL=${Math.max(1, Math.min(365, Math.round(Number(r.everyDays)) || 3))}`;
  if (r.freq === 'monthly') return `FREQ=MONTHLY;BYMONTHDAY=${Number(r.dayOfMonth) || 1}`;
  return '';
};

// scheduled: users/{uid}.scheduledTasks.tasks; dayLists: { dayName: tasks[] } from weeklyRoutines (for dueDate tasks).
export const feedEvents = (scheduled = [], dayLists = {}) => {
  const ev = [];
  const seen = new Set();
  for (const e of scheduled || []) {
    if (!e?.title) continue;
    if (e.recurrence?.freq === 'afterCompletion') { if (!e.stopped && e.nextDate) ev.push({ uid: `tpl-${e.id}-${e.nextDate}`, title: e.title, date: e.nextDate, time: e.scheduledTime, minutes: e.estimateMin, notes: e.notes }); continue; } // next due only (date moves on completion)
    if (e.recurrence && !e.stopped) { ev.push({ uid: `tpl-${e.id}`, title: e.title, date: e.startDate, time: e.scheduledTime, minutes: e.estimateMin, notes: e.notes, rrule: rruleFor(e.recurrence) }); continue; }
    if (e.templateId || e.recurrence) continue; // instances are covered by the template's RRULE
    if (e.done) continue;
    ev.push({ uid: `s-${e.id}`, title: e.title, date: e.scheduledDate, time: e.scheduledTime, minutes: e.estimateMin, notes: e.notes });
    seen.add(e.id);
  }
  for (const tasks of Object.values(dayLists || {})) {
    for (const t of tasks || []) {
      if (!t || t.completed || !validDate(t.dueDate) || (t.scheduledId && seen.has(t.scheduledId)) || t.templateId) continue;
      const uid = `t-${String(t.createdAt || '')}-${t.title}`.replace(/[^\w-]/g, '').slice(0, 80);
      if (seen.has(uid)) continue; seen.add(uid);
      ev.push({ uid, title: t.title, date: t.dueDate, time: t.startTime, minutes: t.estimateMin, notes: t.notes });
    }
  }
  return ev.filter((e) => validDate(e.date));
};

// Single task -> .ics (Add to calendar). Date: scheduled date, else due date, else `fallbackDate`.
export const taskIcs = (task, fallbackDate, now = new Date()) => buildCalendar([{
  uid: `one-${String(task.createdAt || now.getTime())}`.replace(/[^\w-]/g, ''), title: task.title,
  date: task.scheduledFor || task.scheduledDate || task.dueDate || fallbackDate, time: task.startTime || task.scheduledTime || '', minutes: task.estimateMin, notes: task.notes,
}], 'ClingNote task', now);

export const isValidToken = (t) => typeof t === 'string' && /^[a-f0-9]{48}$/.test(t);

const icsName = (task) => `${String(task.title || 'task').replace(/[^\w -]/g, '').slice(0, 40) || 'task'}.ics`;
const plainSummary = (task, today) => [task.title, task.scheduledFor || task.scheduledDate || task.dueDate || today, task.startTime || task.scheduledTime || ''].filter(Boolean).join(' · ');

// Browser only: "Add to calendar" for one task. Resolves to 'downloaded' | 'shared' | 'copied' | 'cancelled' | 'failed'.
// Web: downloads an .ics the OS opens in Calendar. iOS app (WKWebView, `opts.native`): blob/<a download> does nothing there, so share the file
// through the share sheet (Add to Calendar / Save to Files); if file sharing is unavailable, copy a plain-text summary instead.
// `opts.env` lets tests inject { navigator, document, URL, File }.
export const downloadTaskIcs = async (task, today, opts = {}) => {
  const env = opts.env || { navigator: typeof navigator !== 'undefined' ? navigator : undefined, document: typeof document !== 'undefined' ? document : undefined, URL: typeof URL !== 'undefined' ? URL : undefined, File: typeof File !== 'undefined' ? File : undefined };
  const text = taskIcs(task, today); const name = icsName(task);
  if (opts.native) {
    const nav = env.navigator;
    try {
      if (nav && nav.share && env.File) {
        const file = new env.File([text], name, { type: 'text/calendar' });
        if (!nav.canShare || nav.canShare({ files: [file] })) { await nav.share({ files: [file], title: task.title || 'ClingNote task' }); return 'shared'; }
      }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* share failed: fall through to copy */ }
    try { await nav.clipboard.writeText(plainSummary(task, today)); return 'copied'; } catch (e) { return 'failed'; }
  }
  const blob = new Blob([text], { type: 'text/calendar' });
  const a = env.document.createElement('a');
  a.href = env.URL.createObjectURL(blob);
  a.download = name;
  env.document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => env.URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
};
