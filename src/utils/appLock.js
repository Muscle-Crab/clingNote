// App lock policy (pure): when the shield should be on, and the emergency-unlock penalty.
export const LOCK_PREF = 'cn.appLock.on'; export const PENALTY_KEY = 'cn.appLock.penalties';
export const EMERGENCY_PENALTY = 25;
// on: lock-in running, user opted in, apps chosen, goal not yet met, not emergency-unlocked today
export const shouldShield = ({ enabled, running, endMs, now = Date.now(), selectionCount = 0, earned = 0, required = 0, openTasks = 1, unlockedToday = false }) =>
  !!(enabled && running && selectionCount > 0 && endMs > now + 60000 && !unlockedToday && openTasks > 0 && !(required > 0 && earned >= required));
// busy = [{startMs,endMs}] -> [{start:'HH:MM', end:'HH:MM'}] for one local day
export const busyToDay = (busy = [], day = new Date()) => {
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime(); const d1 = d0 + 86400000;
  const f = (ms) => { const m = Math.round((Math.min(Math.max(ms, d0), d1 - 60000) - d0) / 60000); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  return (busy || []).filter((b) => b.endMs > d0 && b.startMs < d1).map((b) => ({ start: f(b.startMs), end: f(b.endMs) }));
};
