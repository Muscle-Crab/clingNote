// Standalone reminders (text + time): device-local list in localStorage + an on-device notification (localNotify.scheduleLocal).
// Not tasks: they never touch weeklyRoutines / the scheduled list, so they don't count toward the daily task limit or points.
export const REM_KEY = 'clingnote.reminders.v1';
const read = (store) => { try { const a = JSON.parse(store.getItem(REM_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
export const listReminders = (store = (typeof window !== "undefined" ? window.localStorage : null)) => (store ? read(store) : []);
export const atOf = (remindAt) => { const m = String(remindAt || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; };
// deps: { store, schedule(key, opts) -> Promise<boolean>, now }
export async function saveReminder({ title, remindAt }, { store = (typeof window !== "undefined" ? window.localStorage : null), schedule, now = new Date() } = {}) {
  const at = atOf(remindAt);
  if (!title || !at) return { ok: false, error: 'Pick a time for the reminder.' };
  if (at.getTime() <= now.getTime()) return { ok: false, error: 'That time has already passed.' };
  const id = `r${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const rem = { id, title: String(title).slice(0, 140), remindAt, createdAt: now.toISOString() };
  const keep = read(store).filter((r) => { const t = atOf(r.remindAt); return t && t.getTime() > now.getTime() - 86400000; });
  store.setItem(REM_KEY, JSON.stringify([...keep, rem].slice(-100)));
  const scheduled = schedule ? !!(await schedule(`rem:${id}`, { title: 'Reminder', body: rem.title, at, route: '/home', type: 'reminder' }).catch(() => false)) : false;
  return { ok: true, reminder: rem, scheduled };
}
