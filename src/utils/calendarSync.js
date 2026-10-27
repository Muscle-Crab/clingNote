// Two-way sync between ClingNote timed tasks and a "ClingNote" calendar on the device (iOS EventKit via ClingNative). Pure: no Firestore,
// no native calls; useCalendarSync.js injects the I/O. Off by default (Settings → Calendar sync).
// Push: every open, timed task in the sync window -> one event (scheduled one-offs with a time, one-time day-list tasks with a start time).
// Pull: edits to a linked event (title / start / length) flow back to its task; events created in the ClingNote calendar become scheduled
//       tasks; deleting a linked event in Calendar is respected (that task is not pushed again until it changes in ClingNote).
// Conflicts: when both sides changed since the last sync, the calendar edit wins (it is the newer, explicit edit of a time).
// Identity: link key `s-<scheduledId>` (also used once a scheduled task is materialized into a day list) or `t-<widgetTaskId>`.
// Each link stores the event id and the event signature (title|start|end) at the last sync, which is how "changed" is detected.
import { widgetTaskId } from './widgetSnapshot';
import { isValidDate, isValidTime, isTemplate, isMaterialized } from './scheduling';

export const SYNC_WINDOW_DAYS = { back: 1, ahead: 60 };
export const DEFAULT_MINUTES = 30;
export const EVENT_URL_PREFIX = 'clingnote://task/';
const MIN = 60000;
const pad = (n) => String(n).padStart(2, '0');
export const localMs = (date, time) => { const [y, m, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, m - 1, d, h, mi).getTime(); };
export const msToLocal = (ms) => { const d = new Date(ms); return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
export const sigOf = (ev) => `${String(ev.title || '').trim()}|${Math.round(Number(ev.startMs) / MIN)}|${Math.round(Number(ev.endMs) / MIN)}`;
const minutesOf = (t) => { const n = Math.round(Number(t.estimateMin) || Number(t.minutes) || 0); return n >= 5 && n <= 24 * 60 ? n : DEFAULT_MINUTES; };
export const keyOfDayTask = (t) => (t.scheduledId ? `s-${t.scheduledId}` : `t-${widgetTaskId(t)}`);
export const keyFromUrl = (url) => (typeof url === 'string' && url.startsWith(EVENT_URL_PREFIX) ? url.slice(EVENT_URL_PREFIX.length) : '');

export const syncWindow = (nowMs) => ({ fromMs: nowMs - SYNC_WINDOW_DAYS.back * 86400000, toMs: nowMs + SYNC_WINDOW_DAYS.ahead * 86400000 });

// Local events. scheduled: users/{uid}.scheduledTasks.tasks; dayLists: { Sun: task[] ... }; weekDates: ['YYYY-MM-DD' x7] (Sun..Sat of this week).
export const buildLocalEvents = ({ scheduled = [], dayLists = {}, weekDates = [], nowMs = Date.now() }) => {
  const { fromMs, toMs } = syncWindow(nowMs); const out = new Map();
  const add = (key, t, date, time, src) => {
    if (!isValidDate(date) || !isValidTime(time) || out.has(key)) return;
    const startMs = localMs(date, time); if (startMs < fromMs || startMs > toMs) return;
    const ev = { key, title: String(t.title || '').trim().slice(0, 200), startMs, endMs: startMs + minutesOf(t) * MIN, notes: String(t.notes || '').slice(0, 1000), src };
    if (!ev.title) return; ev.sig = sigOf(ev); out.set(key, ev);
  };
  for (const e of scheduled || []) {
    if (!e || isTemplate(e) || isMaterialized(e) || e.done || e.templateId) continue;
    add(`s-${e.id}`, e, e.scheduledDate, e.scheduledTime, { kind: 'scheduled', id: e.id });
  }
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day, i) => {
    for (const t of dayLists[day] || []) {
      if (!t || t.completed || t.status === 'wontdo' || t.type === 'recurring' || t.templateId) continue;
      const date = isValidDate(t.scheduledFor) ? t.scheduledFor : isValidDate(t.dueDate) ? t.dueDate : weekDates[i];
      add(keyOfDayTask(t), t, date, t.startTime, { kind: 'day', day, ref: `${t.createdAt || ''}|${t.title || ''}` });
    }
  });
  return [...out.values()];
};

// local: buildLocalEvents(); remote: [{ id, title, startMs, endMs, notes?, url? }] listed from the ClingNote calendar over syncWindow();
// state: { links: { key: { id, sig } }, suppressed: { key: sig } }.
// -> { creates: [ev], updates: [{ id, ev }], removes: [id], pullUpdates: [{ key, id, fields, src }], pullCreates: [{ id, fields }],
//      links, suppressed }   (links for creates / pullCreates are filled in by the caller once ids are known)
export const planSync = (local, remote, state = {}) => {
  const links = { ...(state.links || {}) }; const suppressed = { ...(state.suppressed || {}) };
  const L = new Map(local.map((e) => [e.key, e])); const R = new Map((remote || []).filter((e) => e && e.id).map((e) => [e.id, e]));
  const linkedIds = new Set(); const plan = { creates: [], updates: [], removes: [], pullUpdates: [], pullCreates: [] };
  // re-link events that carry our URL marker but lost their link (reinstall / cleared storage)
  for (const r of R.values()) {
    const k = keyFromUrl(r.url);
    if (k && !links[k] && L.has(k) && !Object.values(links).some((l) => l.id === r.id)) links[k] = { id: r.id, sig: L.get(k).sig };
  }
  for (const [key, link] of Object.entries(links)) {
    const loc = L.get(key); const rem = R.get(link.id);
    if (rem) linkedIds.add(rem.id);
    if (!rem) {
      delete links[key];
      if (loc && loc.sig === link.sig) suppressed[key] = loc.sig; // deleted in Calendar: respect it
      else if (loc) plan.creates.push(loc); // changed in ClingNote since: push again
      continue;
    }
    if (!loc) { plan.removes.push(rem.id); delete links[key]; continue; } // completed / deleted / moved out of the window in ClingNote
    const rsig = sigOf(rem); const remoteChanged = rsig !== link.sig; const localChanged = loc.sig !== link.sig;
    if (remoteChanged) {
      const a = msToLocal(rem.startMs); const mins = Math.max(5, Math.min(24 * 60, Math.round((rem.endMs - rem.startMs) / MIN)));
      const fields = { title: String(rem.title || '').trim().slice(0, 200) || loc.title, date: a.date, time: a.time, minutes: mins };
      plan.pullUpdates.push({ key, id: rem.id, fields, src: loc.src });
      links[key] = { id: rem.id, sig: rsig };
    } else if (localChanged) { plan.updates.push({ id: rem.id, ev: loc }); links[key] = { id: rem.id, sig: loc.sig }; }
  }
  for (const loc of L.values()) {
    if (links[loc.key] || plan.creates.includes(loc)) continue;
    if (suppressed[loc.key] !== undefined) { if (suppressed[loc.key] === loc.sig) continue; delete suppressed[loc.key]; } // changed since: sync again
    plan.creates.push(loc);
  }
  for (const r of R.values()) {
    if (linkedIds.has(r.id) || Object.values(links).some((l) => l.id === r.id)) continue;
    if (keyFromUrl(r.url)) { plan.removes.push(r.id); continue; } // our own event whose task is gone
    const title = String(r.title || '').trim(); if (!title || !(r.endMs > r.startMs)) continue;
    const a = msToLocal(r.startMs);
    plan.pullCreates.push({ id: r.id, fields: { title: title.slice(0, 200), date: a.date, time: a.time, minutes: Math.max(5, Math.min(24 * 60, Math.round((r.endMs - r.startMs) / MIN))), notes: String(r.notes || '').slice(0, 1000) } });
  }
  for (const k of Object.keys(suppressed)) if (!L.has(k)) delete suppressed[k];
  return { ...plan, links, suppressed };
};

// Apply calendar edits to the stored data (pure). pulls: planSync().pullUpdates. lockedDays: days under the 8-hour lock (skipped).
// -> { scheduled, dayLists, changedDays: Set, scheduledChanged, skipped: [key] }
export const applyPullUpdates = (scheduled, dayLists, pulls, { lockedDays = [] } = {}) => {
  const sched = (scheduled || []).slice(); const lists = { ...dayLists }; const changedDays = new Set(); let scheduledChanged = false; const skipped = [];
  for (const p of pulls || []) {
    const f = p.fields; let done = false;
    if (p.key.startsWith('s-')) {
      const sid = p.key.slice(2); const i = sched.findIndex((e) => e && e.id === sid && !isMaterialized(e));
      if (i >= 0) { sched[i] = { ...sched[i], title: f.title, scheduledDate: f.date, scheduledTime: f.time, estimateMin: f.minutes }; scheduledChanged = true; done = true; }
    }
    if (!done) {
      for (const day of Object.keys(lists)) {
        const j = (lists[day] || []).findIndex((t) => t && keyOfDayTask(t) === p.key);
        if (j < 0) continue;
        if (lockedDays.includes(day)) { skipped.push(p.key); done = true; break; }
        const t = lists[day][j]; const next = { ...t, title: f.title, startTime: f.time, estimateMin: f.minutes };
        if (p.key.startsWith('t-') && !t.id) next.id = p.key.slice(2); // pin the link key: widgetTaskId would change with the title
        if (t.scheduledFor) next.scheduledFor = f.date; else next.dueDate = f.date;
        lists[day] = lists[day].slice(); lists[day][j] = next; changedDays.add(day); done = true; break;
      }
    }
    if (!done) skipped.push(p.key);
  }
  return { scheduled: sched, dayLists: lists, changedDays, scheduledChanged, skipped };
};

// Orchestrator with injected I/O (tested with fakes in scripts/test-calendar-sync.js).
// io: { loadLocal() -> { scheduled, dayLists, weekDates }, list(fromMs, toMs) -> remote[], upsert(ev, id?) -> id, remove(id),
//       saveLocal({ scheduled, dayLists, changedDays, scheduledChanged, pulls, created }) (may re-apply pulls/created on a fresh read), makeId() -> scheduled id, lockedDays() -> [day], buildEntry(fields, id) }
export const runCalendarSync = async (io, state = {}, nowMs = Date.now()) => {
  const data = await io.loadLocal(); const { fromMs, toMs } = syncWindow(nowMs);
  const local = buildLocalEvents({ ...data, nowMs }); const remote = await io.list(fromMs, toMs);
  const plan = planSync(local, remote, state); const links = plan.links; const summary = { pushed: 0, updated: 0, removed: 0, pulled: 0, imported: 0, failed: 0 };
  // pulls first, so a pushed event never overwrites a calendar edit
  let scheduled = data.scheduled || []; let dayLists = data.dayLists || {};
  if (plan.pullUpdates.length || plan.pullCreates.length) {
    const r = applyPullUpdates(scheduled, dayLists, plan.pullUpdates, { lockedDays: io.lockedDays ? io.lockedDays() : [] });
    for (const k of r.skipped) { const l = (state.links || {})[k]; if (l) links[k] = l; else delete links[k]; } // retry next time
    scheduled = r.scheduled; dayLists = r.dayLists; let scheduledChanged = r.scheduledChanged; const created = [];
    for (const pc of plan.pullCreates) {
      const id = io.makeId(); const entry = io.buildEntry(pc.fields, id); if (!entry) continue;
      scheduled = [...scheduled, entry]; created.push(entry); scheduledChanged = true; links[`s-${id}`] = { id: pc.id, sig: sigOf({ title: pc.fields.title, startMs: localMs(pc.fields.date, pc.fields.time), endMs: localMs(pc.fields.date, pc.fields.time) + pc.fields.minutes * MIN }) };
      summary.imported += 1;
    }
    try { await io.saveLocal({ scheduled, dayLists, changedDays: r.changedDays, scheduledChanged, pulls: plan.pullUpdates.filter((p) => !r.skipped.includes(p.key)), created }); summary.pulled = plan.pullUpdates.length - r.skipped.length; }
    catch (e) { summary.failed += 1; return { state: { ...state }, summary, error: String((e && e.message) || e) }; } // nothing linked: retried next run
  }
  for (const ev of plan.creates) { try { const id = await io.upsert(ev); if (id) { links[ev.key] = { id, sig: ev.sig }; summary.pushed += 1; } } catch (e) { summary.failed += 1; } }
  for (const u of plan.updates) { try { await io.upsert(u.ev, u.id); summary.updated += 1; } catch (e) { summary.failed += 1; links[u.ev.key] = (state.links || {})[u.ev.key]; } }
  for (const id of plan.removes) { try { await io.remove(id); summary.removed += 1; } catch (e) { summary.failed += 1; } }
  return { state: { links, suppressed: plan.suppressed, lastSyncMs: nowMs }, summary };
};

// Web fallback import: parse VEVENTs from an .ics file -> [{ title, date, time, minutes, notes, uid }] (timed and all-day events).
const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const parseIcsDate = (v, params) => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim()); if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined || /VALUE=DATE(?!-)/.test(params)) return { date: `${y}-${mo}-${d}`, time: '', ms: new Date(+y, +mo - 1, +d).getTime() };
  const ms = z ? Date.UTC(+y, +mo - 1, +d, +h, +mi) : new Date(+y, +mo - 1, +d, +h, +mi).getTime(); // TZID / floating -> device local time
  const l = msToLocal(ms); return { ...l, ms };
};
export const parseIcs = (text, { max = 500 } = {}) => {
  if (typeof text !== 'string' || !/BEGIN:VCALENDAR/i.test(text)) return { ok: false, error: 'Not a calendar (.ics) file.', events: [] };
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = []; let cur = null; let skipped = 0;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur && cur.title && cur.start && events.length < max) {
        const mins = cur.end && cur.start.time ? Math.round((cur.end.ms - cur.start.ms) / MIN) : (cur.duration || 0);
        events.push({ title: cur.title.slice(0, 200), date: cur.start.date, time: cur.start.time, minutes: mins > 0 ? Math.min(mins, 24 * 60) : (cur.start.time ? DEFAULT_MINUTES : 0), notes: (cur.notes || '').slice(0, 1000), uid: cur.uid || '', rrule: cur.rrule || '' });
      } else skipped += 1;
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const head = line.slice(0, i); const val = line.slice(i + 1); const name = head.split(';')[0].toUpperCase(); const params = head.slice(name.length);
    if (name === 'SUMMARY') cur.title = unescape(val).trim();
    else if (name === 'DESCRIPTION') cur.notes = unescape(val);
    else if (name === 'UID') cur.uid = val.trim();
    else if (name === 'DTSTART') cur.start = parseIcsDate(val, params);
    else if (name === 'DTEND') cur.end = parseIcsDate(val, params);
    else if (name === 'RRULE') cur.rrule = val.trim();
    else if (name === 'DURATION') { const m = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?)$/.exec(val.trim()); if (m) cur.duration = (+(m[1] || 0)) * 60 + (+(m[2] || 0)); }
  }
  return { ok: true, events, skipped };
};
