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

// Native hold (iOS DebtHold / DeviceActivity "clingDebt"): what the app should tell iOS so the shields stay up with ClingNote closed or
// force-quit, for every user. debt = merged appLockDebt; live = the running session { sessionKey, startMs, endMs, target, earned } or null.
//  arm   : an unpaid miss (startMs = its end, already past: shield now), or a running session still short of its goal (startMs = its
//          end: iOS raises / keeps the shield at the end on its own). untilMs = the 14-day safety cap.
//  clear : a later session reached its goal, the lock is off / no apps picked / emergency unlocked today.
//  clear also: the server (known) has no miss and no session runs (a hold pre-armed for a session met with the app closed).
//  none  : nothing to hold, or a temporary exception (friend unlock, break) - the hold stays armed, the app keeps the shield down.
export const holdKey = (sessionKey) => `debt_${String(sessionKey || '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
export const debtHoldPlan = ({ debt, live = null, known = false, now = Date.now(), enabled, selectionCount = 0, unlockedToday = false, friend = false, onBreak = false }) => {
  if (!enabled || !(selectionCount > 0) || unlockedToday) return { action: 'clear' };
  const d = core.debtActive(debt, now) ? debt : null;
  const liveMet = !!(live && core.sessionMet(live));
  if (d && !(live && core.debtCleared(d, live))) return friend || onBreak ? { action: 'none' } : { action: 'arm', key: holdKey(d.sessionKey), startMs: d.sinceMs, untilMs: core.debtUntilMs(d) };
  if (live && live.target > 0 && !liveMet && live.endMs > now + 60000) return { action: 'arm', key: holdKey(live.sessionKey), startMs: live.endMs, untilMs: live.endMs + core.DEBT_CAP_MS };
  if (d || liveMet) return { action: 'clear' };
  // No miss on the server and no short session running: a hold pre-armed for a session that was met with the app closed is stale.
  // Only once the server's answer is in (known), so a cold start / offline open never drops a hold for a miss it can't see yet.
  return known && !live ? { action: 'clear' } : { action: 'none' };
};
// Turning the app lock off (assistant "turn off app lock") must not be a way out of an unpaid missed-goal lock: debtHoldPlan clears the
// hold when the lock is off, so the off switch is refused while a debt is active and no live session has paid it yet.
export const TURN_OFF_BLOCKED_MSG = 'App lock stays on until a session hits its points goal (missed-goal lock).';
export const turnOffBlocked = ({ debt, now = Date.now(), live = null } = {}) => core.debtActive(debt, now) && !(live && core.debtCleared(debt, live));
