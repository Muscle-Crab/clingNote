// App lock policy (pure): when the shield should be on, and the emergency-unlock penalty.
export const LOCK_PREF = 'cn.appLock.on'; export const PENALTY_KEY = 'cn.appLock.penalties';
export const EMERGENCY_PENALTY = 25;
// Emergency-unlock penalties live in Firestore (streaks/{uid}.lockPenalties) with localStorage as the offline copy.
// Merge both (dedupe by day+at, oldest first, keep 60); entries tagged for another account are dropped.
// toPush = local entries the account doesn't have yet (made offline) so the caller can upload them.
const penKey = (p) => `${p.day}|${p.at}`;
export const mergePenalties = (local = [], remote = [], uid = '') => {
  const ok = (p) => p && typeof p.day === 'string' && (!uid || !p.uid || p.uid === uid);
  const r = (Array.isArray(remote) ? remote : []).filter(ok); const have = new Set(r.map(penKey));
  const toPush = (Array.isArray(local) ? local : []).filter((p) => ok(p) && !have.has(penKey(p)));
  const seen = new Set(); const merged = [...r, ...toPush].filter((p) => { const k = penKey(p); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-60);
  return { merged, toPush: toPush.map(({ day, points, at }) => ({ day, points, at })) };
};
export const lastPenaltyDay = (list = []) => (list.length ? list[list.length - 1].day : '');
// on: lock-in running, user opted in, apps chosen, goal not yet met, not emergency-unlocked today
export const shouldShield = ({ enabled, running, endMs, now = Date.now(), selectionCount = 0, earned = 0, required = 0, openTasks = 1, unlockedToday = false }) =>
  !!(enabled && running && selectionCount > 0 && endMs > now + 60000 && !unlockedToday && openTasks > 0 && !(required > 0 && earned >= required));
// busy = [{startMs,endMs}] -> [{start:'HH:MM', end:'HH:MM'}] for one local day
export const busyToDay = (busy = [], day = new Date()) => {
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime(); const d1 = d0 + 86400000;
  const f = (ms) => { const m = Math.round((Math.min(Math.max(ms, d0), d1 - 60000) - d0) / 60000); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  return (busy || []).filter((b) => b.endMs > d0 && b.startMs < d1).map((b) => ({ start: f(b.startMs), end: f(b.endMs) }));
};
// What syncAppLock should do with the native shield. st = clingLock.status() ({ locked, until, monitoring }).
// - an expired native lock (until <= now) is always stopped, whatever day is shown;
// - start only when no clingLock schedule is active or native `until` differs from endMs, and never to push the end
//   later than an active lock's until (a relaunch near the end must not extend it).
export const lockAction = ({ want, endMs = 0, st = {}, now = Date.now() }) => {
  const until = Number(st.until) || 0;
  if (st.locked && until > 0 && until <= now) return 'stop';
  if (!want) return st.locked ? 'stop' : 'none';
  if (st.locked && st.monitoring && until === endMs) return 'none';
  if (st.locked && st.monitoring && until > 0 && endMs > until) return 'none';
  return 'start';
};
