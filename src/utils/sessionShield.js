// Shield decision for a session, including the gap after it ends. The progress card only exists while a
// session is running, so the ended session's own result (lock.session) is what keeps the apps open
// until a new session actually starts short of its goal. A missed session keeps the missed-goal hold.
import { sessionUnlock } from './strictDay.js';
import { shouldShield, lockAction } from './appLock.js';
import { shieldBecauseTimerOff } from './pointsVault.js';
import { debtShield, debtHoldPlan } from './appLockDebt.js';
import { focusShieldEnd } from './focusAutoStart.js';

// The session is over and its points goal was met. Prefer the settled session record (what the
// shutdown screen prints) over the day-level earned/target, which can be a different number.
export const endedGoalMet = (lock, now = Date.now()) => {
  if (!lock || lock.placeholder || !(Number(lock.endMs) > 0) || Number(now) < Number(lock.endMs)) return false;
  const s = lock.session;
  // The frozen Start goal is the only bar. A session.target that sums the whole day (200)
  // must not keep the apps locked after this session's own goal (80) was met.
  const frozen = Number(lock.target) > 0 ? Math.round(Number(lock.target)) : (lock.goal && Number(lock.goal.points) > 0 ? Math.round(Number(lock.goal.points)) : 0);
  if (frozen > 0) {
    const earned = s && s.earned != null ? Number(s.earned) : Number(lock.earned) || 0;
    return earned >= frozen;
  }
  if (s && (Number(s.target) > 0 || s.met === true)) {
    const target = Number(s.target) || 0;
    return s.met === true || (target > 0 && Number(s.earned) >= target);
  }
  return false;
};

// The ended session, shaped for the missed-goal hold. Null while it is still running or the goal was missed.
export const settledSession = (lock, now = Date.now()) => {
  if (!endedGoalMet(lock, now)) return null;
  const s = lock.session || {};
  return {
    sessionKey: `${lock.dayKey || ''}#${Number(lock.index) || 0}`,
    startMs: Number(lock.startMs) || 0,
    endMs: Number(lock.endMs) || 0,
    target: Number(s.target) || Number(lock.target) || 0,
    earned: s.earned != null ? Number(s.earned) || 0 : Number(lock.earned) || 0,
    done: s.done != null ? Number(s.done) || 0 : Number(lock.done) || 0,
  };
};

const sessionKeyOf = (lock) => `${(lock && lock.dayKey) || ''}#${Number(lock && lock.index) || 0}`;

// One sync. strictWant null = simple mode (shouldShield). card is the on-screen pair while running, else null.
// Returns the native writes: lock action (lock.state) and the missed-goal hold (clingnote.debtHold.v1).
export const decideShield = ({
  now = Date.now(), enabled = true, selectionCount = 0, unlockedToday = false, onBreak = false, friend = false,
  running = false, endMs = 0, strictWant = null, lock = null, card = null, gate = null, dayEarned = 0,
  debt = null, known = false, focusLocked = null, native = {},
} = {}) => {
  const endedMet = !running && endedGoalMet(lock, now);
  const baselineOpen = !!(gate && sessionUnlock({ dayEarned, earnedAtStart: gate.earned, sessionRequired: gate.target }));
  const openNow = endedMet || (card ? !!card.met : baselineOpen);
  const earned = card ? Number(card.earned) || 0 : Math.max(0, (Number(dayEarned) || 0) - (gate ? Number(gate.earned) || 0 : Number(dayEarned) || 0));
  const required = card ? Number(card.required) || 0 : (gate ? Number(gate.target) || 0 : 0);
  let until = Number(endMs) || 0;
  let want = strictWant == null
    ? shouldShield({ enabled, running, endMs: until, now, selectionCount, earned, required, openTasks: 1, unlockedToday })
    : !!strictWant;
  const liveRunning = running && lock ? {
    sessionKey: sessionKeyOf(lock), startMs: Number(lock.startMs) || 0, endMs: Number(lock.endMs) || 0,
    target: required || Number(lock.target) || 0,
    earned: card ? Number(card.earned) || 0 : Number(lock.session && lock.session.earned) || 0,
    done: Number(lock.session && lock.session.done) || Number(lock.done) || 0,
  } : null;
  const live = liveRunning || settledSession(lock, now);
  const debtResult = debtShield({ debt, now, session: live, enabled, selectionCount, unlockedToday, friend, onBreak });
  if (debtResult.want && !openNow) { want = true; until = Math.max(Number(debtResult.untilMs) || 0, strictWant ? until : 0); }
  const sessionEnded = !!(lock && !running && Number(lock.endMs) > 0 && now >= Number(lock.endMs));
  const idle = shieldBecauseTimerOff({ enabled, selectionCount, accessOpen: false, unlockedToday, onBreak, goalMet: openNow, sessionEnded, now });
  if (idle && !want && !openNow) { want = true; until = Math.max(until, idle.untilMs); }
  const focusEnd = openNow || onBreak ? 0 : focusShieldEnd({ dayWant: !!want, enabled, selectionCount, locked: focusLocked, now });
  const hold = debtHoldPlan({ debt: debtResult.cleared ? null : debt, live, known, now, enabled, selectionCount, unlockedToday, friend, onBreak });
  const action = lockAction({ want: !!(want || focusEnd), endMs: focusEnd || until, st: native, now });
  return {
    openNow, endedMet, want: !!(want || focusEnd), focus: !!focusEnd, endMs: focusEnd || until, action, hold,
    debtCleared: !!debtResult.cleared, debtKey: debtResult.sessionKey || (debt && debt.sessionKey) || '',
  };
};
