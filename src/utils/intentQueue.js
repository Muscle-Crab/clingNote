// Siri / Shortcuts "Add a task in ClingNote" queue (pure helpers; HomeView does the I/O).
// Swift AddTaskIntent appends {title, ts, start:"HH:MM", date:"YYYY-MM-DD"} to the App Group list "intent.pending"; takeIntents() hands it over AND clears it.
// So the app keeps its own copy (localStorage buffer) until each item is really saved: nothing is lost if the user/day
// is still loading, the network fails, or the daily limit is hit (that one is dropped with a message instead of retried forever).
export const INTENT_BUFFER_KEY = 'cn.intent.buffer';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Normalize one native queue item -> { id, title, start? } or null. Accepts `start` (what Swift writes) and legacy `time`.
export const intentToItem = (it) => {
  if (!it || typeof it !== 'object') return null;
  const title = String(it.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!title) return null;
  const t = String(it.start || it.time || '').trim();
  const ts = Number(it.ts) || 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(it.date || '')) ? it.date : '';
  return { id: `${ts}|${title}`, title, ts, ...(HHMM.test(t) ? { start: t } : {}), ...(date ? { date } : {}) };
};

// Merge freshly drained native items into the saved buffer (dedupe by id; keeps order; caps size).
export const mergeIntents = (buffer = [], fresh = [], cap = 30) => {
  const out = []; const seen = new Set();
  for (const raw of [...(Array.isArray(buffer) ? buffer : []), ...(Array.isArray(fresh) ? fresh : [])]) {
    const it = raw && raw.id && raw.title ? raw : intentToItem(raw);
    if (!it || seen.has(it.id)) continue; seen.add(it.id); out.push(it);
  }
  return out.slice(-cap);
};

// create_tasks args for one buffered item (the assistant validator + executor do limits, dates and saving).
// A Siri date after today -> a scheduled task on that day.
export const intentCreateArgs = (it, today = '') => ({ items: [{ title: it.title, ...(it.start ? { start: it.start } : {}), ...(it.date ? { date: it.date } : {}), ...(it.date && today && it.date > today ? { type: 'schedule' } : {}) }] });

// After trying an item: 'done' (saved), 'drop' (permanent: limit/invalid -> tell the user), 'retry' (transient: keep it).
export const intentOutcome = ({ validated, result, error } = {}) => {
  if (error) return 'retry';
  if (validated && validated.ok === false) return 'drop'; // over the limit / invalid: retrying would never succeed
  const r = result || {};
  if (r.ok || (Number(r.added) || 0) > 0) return 'done';
  const f = (Array.isArray(r.failed) && r.failed[0]) || {};
  const msg = String(f.error || r.error || '');
  if (/limit|cap|full|blocked|shut|locked|upgrade/i.test(msg)) return 'drop';
  return 'retry';
};

// A transient failure keeps the item, but not forever: after MAX_TRIES attempts it is dropped (and reported).
export const MAX_TRIES = 5;
export const bumpTries = (it) => ({ ...it, tries: (Number(it.tries) || 0) + 1 });
export const outOfTries = (it) => (Number(it.tries) || 0) >= MAX_TRIES;

export const readBuffer = (store) => { try { const v = JSON.parse(store.getItem(INTENT_BUFFER_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
export const writeBuffer = (store, list) => { try { if (list.length) store.setItem(INTENT_BUFFER_KEY, JSON.stringify(list)); else store.removeItem(INTENT_BUFFER_KEY); } catch (e) { /* storage full / private mode */ } };
