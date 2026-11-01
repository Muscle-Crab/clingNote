// Settings → "Calendar sync" (off by default). iOS app: two-way sync with a "ClingNote" calendar through EventKit (ClingNative.calSync*);
// the sync logic itself is the pure src/utils/calendarSync.js. Web (no device calendar): .ics export of the same events + .ics import.
// State per user in localStorage `cn.calsync.<uid>` (links between tasks and event ids never leave the device).
// Writes are the ones the app already makes: users/{uid}.scheduledTasks (mutateScheduled) and weeklyRoutines day docs (merge),
// never on a day under the 8-hour lock, never during shutdown, and calendar-created tasks respect the daily task limit.
import { ref } from 'vue';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { loadScheduled, mutateScheduled } from '@/composables/useScheduledTasks';
import { isDayLocked, isShutdown, currentLock } from '@/utils/eightHourLock';
import { focusBlocks, lockBlock } from '@/utils/timeBlocks';
import { countTasksForDay } from '@/utils/taskLimits';
import { dailyTaskLimit } from '@/config/pricing';
import { weekDates, buildScheduledEntry, makeScheduledId, isValidDate } from '@/utils/scheduling';
import { runCalendarSync, applyPullUpdates, applySkips, buildLocalEvents, parseIcs, EVENT_URL_PREFIX } from '@/utils/calendarSync';
import { buildCalendar } from '@/utils/ics';
import { saveTextFile } from '@/utils/fileSave';
import { clingNative, nativeAvailable } from '@/native/clingNative';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MIN_GAP_MS = 2 * 60 * 1000; // auto sync at most every 2 minutes
const keyFor = (uid) => `cn.calsync.${uid}`;
const ls = () => { try { return window.localStorage; } catch (e) { return null; } };
export const loadSyncState = (uid) => { try { const s = JSON.parse(ls()?.getItem(keyFor(uid)) || 'null'); return s && typeof s === 'object' ? s : { enabled: false }; } catch (e) { return { enabled: false }; } };
const saveSyncState = (uid, s) => { try { ls()?.setItem(keyFor(uid), JSON.stringify(s)); } catch (e) { /* storage full / private mode */ } };

export const calSyncState = ref({ enabled: false, lastSyncMs: 0, busy: false, message: '' });
const publish = (uid) => { const s = loadSyncState(uid); calSyncState.value = { ...calSyncState.value, enabled: !!s.enabled, lastSyncMs: s.lastSyncMs || 0 }; };

const loadAll = async (uid) => {
  const lists = await Promise.all(DAYS.map((d) => loadDayTasks(uid, d)));
  return { dayLists: Object.fromEntries(DAYS.map((d, i) => [d, lists[i]])), scheduled: await loadScheduled(uid) };
};

// B44 time blocking: focus blocks for the next 14 days (working hours from users/{uid}.timeBlocks) + the running lock-in.
const blocksFor = async (uid, calendarId, local) => {
  const out = []; const now = Date.now();
  try {
    const lb = lockBlock(currentLock(), now); if (lb) out.push(lb);
    const u = await getDoc(doc(db, 'users', uid)); const tb = u.exists() ? u.data().timeBlocks : null;
    if (tb && tb.focusMin) {
      const today = new Date().toLocaleDateString('en-CA'); const to = now + 15 * 86400000;
      const busy = ((await clingNative.busy(now, to, calendarId)) || {}).busy || [];
      const taken = buildLocalEvents({ ...local, nowMs: now }).map((e) => ({ startMs: e.startMs, endMs: e.endMs }));
      out.push(...focusBlocks({ settings: tb, fromDate: today, days: 14, busy, taken: lb ? [...taken, lb] : taken, nowMs: now }));
    }
  } catch (e) { /* blocks are optional */ }
  return out;
};

const ioFor = (uid, calendarId, { pro = false } = {}) => {
  let snapshot = null;
  return {
    loadLocal: async () => { snapshot = await loadAll(uid); const wd = weekDates(new Date()); return { ...snapshot, weekDates: wd, blocks: await blocksFor(uid, calendarId, { ...snapshot, weekDates: wd }) }; },
    list: async (fromMs, toMs) => { const r = await clingNative.calSyncList(calendarId, fromMs, toMs); if (r.error) throw new Error(r.error); return r.events || []; },
    upsert: async (ev, id) => { const r = await clingNative.calSyncUpsert({ calendarId, id: id || '', title: ev.title, startMs: ev.startMs, endMs: ev.endMs, notes: ev.notes || '', url: EVENT_URL_PREFIX + ev.key }); if (r.error) throw new Error(r.error); return r.id; },
    remove: async (id) => { const r = await clingNative.calSyncRemove(id); if (r.error) throw new Error(r.error); },
    lockedDays: () => DAYS.filter((d) => isDayLocked(d)),
    makeId: () => makeScheduledId(),
    buildEntry: (f, id) => {
      const lists = DAYS.map((d) => snapshot.dayLists[d] || []);
      if (countTasksForDay(f.date, lists, snapshot.scheduled) >= dailyTaskLimit(pro)) return null; // day is full: event stays calendar-only
      const e = buildScheduledEntry({ title: f.title, estimateMin: f.minutes, notes: f.notes || '', source: 'calendar' }, f.date, f.time, id);
      if (e) snapshot.scheduled = [...snapshot.scheduled, e];
      return e;
    },
    saveLocal: async ({ changedDays, scheduledChanged, pulls, created, skips = [] }) => {
      const locked = DAYS.filter((d) => isDayLocked(d));
      for (const d of changedDays) { // re-read right before writing, then re-apply the calendar edits to the fresh list
        if (locked.includes(d)) continue;
        const fresh = await loadDayTasks(uid, d);
        const r = applyPullUpdates([], { [d]: fresh }, pulls, { lockedDays: locked });
        if (r.changedDays.has(d)) await setDoc(doc(db, 'weeklyRoutines', `${uid}_${d}`), { tasks: r.dayLists[d], updatedAt: serverTimestamp() }, { merge: true });
      }
      if (scheduledChanged) {
        await mutateScheduled(uid, (list) => {
          const r = applyPullUpdates(applySkips(list, skips), {}, pulls.filter((p) => p.key.startsWith('s-')));
          const ids = new Set(r.scheduled.map((e) => e && e.id));
          return [...r.scheduled, ...created.filter((e) => !ids.has(e.id))].slice(0, 300);
        });
      }
    },
  };
};

let inflight = null;
// -> { ok, message, summary? }
export const syncCalendarNow = async (uid, { pro = false, force = false } = {}) => {
  if (!uid || !nativeAvailable()) return { ok: false, message: 'Calendar sync needs the iOS app.' };
  const st = loadSyncState(uid);
  if (!st.enabled || !st.calendarId) return { ok: false, message: 'Calendar sync is off.' };
  if (!force && st.lastSyncMs && Date.now() - st.lastSyncMs < MIN_GAP_MS) return { ok: true, message: '' };
  if (isShutdown()) return { ok: false, message: 'Paused until your next day starts.' };
  if (inflight) return inflight;
  calSyncState.value = { ...calSyncState.value, busy: true };
  inflight = (async () => {
    try {
      const r = await runCalendarSync(ioFor(uid, st.calendarId, { pro }), st);
      const cur = loadSyncState(uid); if (!cur.enabled) return { ok: false, message: 'Calendar sync is off.' }; // turned off mid-run
      saveSyncState(uid, { ...cur, ...r.state, enabled: true, calendarId: st.calendarId });
      const s = r.summary; const bits = [s.pushed && `${s.pushed} added`, s.updated && `${s.updated} updated`, s.removed && `${s.removed} removed`, (s.pulled + s.imported) && `${s.pulled + s.imported} from Calendar`, s.merged && `${s.merged} merged`].filter(Boolean);
      return { ok: !r.error, message: r.error ? 'Sync failed, will retry.' : bits.length ? `Synced: ${bits.join(', ')}.` : 'Up to date.', summary: s };
    } catch (e) { return { ok: false, message: 'Sync failed, will retry.' }; }
    finally { inflight = null; publish(uid); calSyncState.value = { ...calSyncState.value, busy: false }; }
  })();
  const res = await inflight; calSyncState.value = { ...calSyncState.value, message: res.message }; return res;
};

export const setCalendarSync = async (uid, on, opts = {}) => {
  if (!uid) return { ok: false, message: '' };
  const st = loadSyncState(uid);
  if (!on) { saveSyncState(uid, { ...st, enabled: false }); publish(uid); return { ok: true, message: 'Calendar sync off. Existing events stay in your ClingNote calendar.' }; }
  if (!nativeAvailable()) return { ok: false, message: 'Calendar sync needs the iOS app. Use .ics export / import here.' };
  const a = await clingNative.calendarAccess();
  if (!a.granted) return { ok: false, message: 'Allow Calendar access in iOS Settings → ClingNote.' };
  const c = await clingNative.calSyncEnsure(st.calendarId || '');
  if (!c.calendarId) return { ok: false, message: 'Could not create the ClingNote calendar.' };
  const keep = c.calendarId === st.calendarId; // new calendar: old links are meaningless
  saveSyncState(uid, { enabled: true, calendarId: c.calendarId, links: keep ? st.links || {} : {}, suppressed: keep ? st.suppressed || {} : {}, lastSyncMs: 0 });
  publish(uid);
  return syncCalendarNow(uid, { ...opts, force: true });
};

export const initCalendarSync = (uid) => { if (uid) publish(uid); };

// ── Web fallback ──
// Export: the same events the device sync would push, as one .ics (opens in Apple/Google/Outlook calendar).
export const exportIcs = async (uid, { native = false } = {}) => {
  const all = await loadAll(uid);
  const ev = buildLocalEvents({ ...all, weekDates: weekDates(new Date()) }).map((e) => {
    const d = new Date(e.startMs); const p = (n) => String(n).padStart(2, '0');
    return { uid: e.key, title: e.title, date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}`, minutes: Math.round((e.endMs - e.startMs) / 60000), notes: e.notes };
  });
  const res = await saveTextFile(buildCalendar(ev, 'ClingNote'), 'clingnote-tasks.ics', 'text/calendar', { native });
  return { result: res, count: ev.length };
};
// Import: one-off events -> scheduled tasks (recurring events become one task on their first date). Dedupes against existing scheduled
// tasks by title+date+time and by the event UID (kept as icsUid); respects the daily task limit and shutdown.
export const importIcs = async (uid, text, { pro = false } = {}) => {
  const p = parseIcs(text);
  if (!p.ok) return { ok: false, message: p.error };
  if (isShutdown()) return { ok: false, message: 'Paused until your next day starts.' };
  const all = await loadAll(uid); const lists = DAYS.map((d) => all.dayLists[d] || []); const limit = dailyTaskLimit(pro);
  const today = new Date().toLocaleDateString('en-CA');
  const sig = (title, date, time) => `${String(title).trim().toLowerCase()}|${date}|${time || ''}`;
  const seen = new Set(all.scheduled.map((e) => sig(e.title, e.scheduledDate, e.scheduledTime)));
  const uids = new Set(all.scheduled.map((e) => e.icsUid).filter(Boolean));
  let added = 0; let dup = 0; let full = 0; let past = 0; const fresh = [];
  for (const ev of p.events) {
    if (!isValidDate(ev.date) || ev.date < today) { past += 1; continue; }
    const k = sig(ev.title, ev.date, ev.time);
    if (seen.has(k) || (ev.uid && uids.has(ev.uid))) { dup += 1; continue; }
    if (countTasksForDay(ev.date, lists, [...all.scheduled, ...fresh]) >= limit) { full += 1; continue; }
    const e = buildScheduledEntry({ title: ev.title, estimateMin: ev.minutes || undefined, notes: ev.notes || '', icsUid: ev.uid ? ev.uid.slice(0, 120) : undefined, source: 'ics' }, ev.date, ev.time);
    if (!e) continue; Object.keys(e).forEach((x) => e[x] === undefined && delete e[x]);
    fresh.push(e); seen.add(k); if (ev.uid) uids.add(ev.uid); added += 1;
  }
  if (fresh.length) await mutateScheduled(uid, (list) => [...list, ...fresh].slice(0, 300));
  const bits = [`${added} added`, dup && `${dup} already there`, full && `${full} skipped (day full)`, past && `${past} in the past`, p.skipped && `${p.skipped} unreadable`].filter(Boolean);
  return { ok: true, message: `Calendar import: ${bits.join(', ')}.`, counts: { added, duplicates: dup, skippedFull: full, skippedPast: past } };
};
