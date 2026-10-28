// Device cache of the last started 8-hour day, scoped per account. A cached lock is only ever used for the uid that
// wrote it, so signing in with another account on the same device can never inherit someone else's shutdown.
// v1 entries ('clingnote.ehLastLock.v1') had no uid and leaked across accounts: they are ignored and removed.
export const LEGACY_KEY = 'clingnote.ehLastLock.v1';
export const keyFor = (uid) => `clingnote.ehLastLock.v2.${uid}`;
const store = (s) => s || (typeof localStorage !== 'undefined' ? localStorage : null);
export const readLock = (uid, s) => {
  const ls = store(s); if (!ls || !uid) return null;
  try { ls.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
  try { const l = JSON.parse(ls.getItem(keyFor(uid)) || 'null'); return l && l.uid === uid && Number.isFinite(l.endMs) && l.dayKey ? l : null; } catch (e) { return null; }
};
export const writeLock = (uid, l, s) => {
  const ls = store(s); if (!ls || !uid || !l || !Number.isFinite(l.endMs)) return;
  try { ls.setItem(keyFor(uid), JSON.stringify({ uid, dayKey: l.dayKey, dayName: l.dayName, startMs: l.startMs, endMs: l.endMs, hours: l.hours, local: !!l.local, wakeTime: l.wakeTime, tz: l.tz, earned: l.earned || 0, target: l.target || 0, done: l.done || 0, taskCount: l.taskCount || 0, totalPoints: l.totalPoints || 0 })); } catch (e) { /* private mode */ }
};
// In-memory server state belongs to one uid too: anything fetched for another uid must not decide the shutdown.
export const lockFor = (data, dataUid, uid) => (data && data.lock && (dataUid || null) === (uid || null) ? data.lock : null);
