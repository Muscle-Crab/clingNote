// Missed-goal app lock, client half. The server (eightHour/{uid}.appLockDebt, server clock) is the source of truth; this keeps a
// per-account device cache so the shields stay up offline / on a cold start, and lifts them the moment a later session hits its goal
// (before the server round trip). Pure helpers + a tiny localStorage cache. The rule itself lives in eightHourCore (shared with the server).
import core from '../../netlify/functions/lib/eightHourCore.js';

export const DEBT_KEY = 'cn.appLockDebt.v1';
const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
// cache = { uid, debt, cleared: [sessionKey], scheduled: [{ key, endMs }] }
export const readDebtCache = (uid, ls = store()) => {
  try { const c = JSON.parse((ls && ls.getItem(DEBT_KEY)) || 'null'); return c && c.uid === uid ? { uid, debt: core.normDebt(c.debt), cleared: Array.isArray(c.cleared) ? c.cleared.slice(-20) : [], scheduled: Array.isArray(c.scheduled) ? c.scheduled.slice(-20) : [] } : { uid, debt: null, cleared: [], scheduled: [] }; }
  catch (e) { return { uid, debt: null, cleared: [], scheduled: [] }; }
};
export const writeDebtCache = (c, ls = store()) => { try { if (ls && c && c.uid) ls.setItem(DEBT_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } return c; };

// The debt to act on: the server's when this account's state has loaded online, else the cached one. A debt this device already
// saw paid (cleared) is ignored, so a server reply that raced the clearing progress call cannot re-lock the apps.
export const mergeDebt = ({ server, serverKnown, cache }) => {
  const c = cache || {}; const d = serverKnown ? core.normDebt(server) : core.normDebt(c.debt);
  return d && (c.cleared || []).includes(d.sessionKey) ? null : d;
};
// Fold a new server/merged value into the cache (idempotent: same input -> same cache).
export const cacheWithDebt = (c, debt) => ({ ...c, debt: core.normDebt(debt) });
export const cacheCleared = (c, sessionKey) => ({ ...c, debt: null, cleared: (c.cleared || []).includes(sessionKey) ? c.cleared : [...(c.cleared || []), sessionKey].slice(-20) });

// What the shield should do for the debt. session = the live session { startMs, target, earned } (or null).
export const debtShield = ({ debt, now = Date.now(), session = null, enabled, selectionCount = 0, unlockedToday = false, friend = false, onBreak = false }) => {
  if (!core.debtActive(debt, now)) return { want: false, cleared: false, untilMs: 0 };
  if (session && core.debtCleared(debt, session)) return { want: false, cleared: true, untilMs: 0, sessionKey: debt.sessionKey };
  if (!enabled || !(selectionCount > 0) || unlockedToday || friend || onBreak) return { want: false, cleared: false, untilMs: 0 };
  return { want: true, cleared: false, untilMs: core.debtUntilMs(debt) };
};
