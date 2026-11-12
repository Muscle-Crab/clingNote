// Session goal, end prompt, timer handoff, and day rollover. Pure (scripts/test-session-goal-flow.mjs).
// The vault release itself is sessionGoalReached / vaultView in pointsVault.js. This module decides
// the prompt and what happens to the session and the task list around it.
import { isStaleCompletion, pruneStaleDay } from './localDate.js';
import { sessionAward } from './pointsAward.js';
import { beginSessionGate, sessionUnlock } from './strictDay.js';

// Show the end-or-continue prompt only while this session is running and the goal is met,
// and the user has not already chosen for this session. End stays available the whole time it runs.
export const endPrompt = ({ met = false, running = false, sessionKey = '', choice = '' } = {}) => {
  const live = !!running && !!sessionKey;
  const show = !!(live && met && choice !== 'keep' && choice !== 'end');
  return { show, canEnd: live && choice !== 'end' };
};

// Keep going: the countdown continues. End now: stop this session and do not auto-start another.
export const promptChoice = (choice) => (choice === 'end'
  ? { endNow: true, keepRunning: false }
  : { endNow: false, keepRunning: true });

// The user can end a running session at any time, not only from the goal prompt.
export const manualEndAllowed = ({ running = false } = {}) => !!running;

// The timer reached its end. That never starts the next session. The user taps Start next session.
// Fewer than 8 finished tasks still waits 2 hours before that tap is accepted. Eight or more: the tap works right away.
export const timerExpiry = ({ now = 0, endMs = 0, running = false, canStart = false, cooldownUntil = 0, sessionKey = '', skipKey = '' } = {}) => {
  const ended = !running && Number(endMs) > 0 && Number(now) >= Number(endMs);
  if (!ended) return { ended: false, startNext: false, userStart: false, reason: '' };
  if (skipKey && sessionKey && skipKey === sessionKey) return { ended: true, startNext: false, userStart: false, reason: 'manual' };
  if (Number(cooldownUntil) > Number(now)) return { ended: true, startNext: false, userStart: false, reason: 'cooldown', waitUntil: Number(cooldownUntil) };
  if (!canStart) return { ended: true, startNext: false, userStart: false, reason: 'blocked' };
  return { ended: true, startNext: false, userStart: true, reason: 'timer' };
};

// A later session on the same calendar day keeps every completion. The new session's points
// start at 0 because the gate baseline is the day total already on the board.
export const sameDayHandoff = (storage, { tasks = [], fromLock, toLock, dayPoints = 0, nextTarget = 0 } = {}) => {
  const kept = (tasks || []).map((t) => (t ? { ...t } : t));
  const from = beginSessionGate(storage, fromLock, 0, Math.max(0, Number(dayPoints) || 0));
  const to = beginSessionGate(storage, toLock, dayPoints, nextTarget);
  if (!from || !to) {
    return {
      tasks: kept,
      stillComplete: kept.filter((t) => t && t.completed).map((t) => t.title || t.id),
      fromPoints: 0,
      sessionPoints: 0,
      unlocked: false,
    };
  }
  const carried = sessionAward(dayPoints, from.earned);
  return {
    tasks: kept,
    stillComplete: kept.filter((t) => t && t.completed).map((t) => t.title || t.id),
    fromPoints: carried,
    sessionPoints: sessionAward(dayPoints, to.earned),
    unlocked: sessionUnlock({ sessionEarned: sessionAward(dayPoints, to.earned), sessionRequired: to.target }),
  };
};

// New local day: completed one-time tasks leave, older completions reset, points go to 0,
// locks are cleared, and the user is asked to start a fresh session. Same day is a no-op.
export const dayRolloverReset = (tasks, dayIdx, now, prevDay, day) => {
  if (!day || day === prevDay) return { rolled: false, points: 0, tasks: tasks || [], locksReset: false, startFresh: false };
  const when = now instanceof Date ? now : new Date(now || Date.now());
  const pruned = pruneStaleDay(tasks || [], dayIdx, when).map((t) => (isStaleCompletion(t, dayIdx, when)
    ? { ...t, completed: false, completedAt: null, timerActive: false, timerStartedAt: null, timerEndTime: null, timerStoppedAt: null }
    : t));
  return { rolled: true, points: 0, tasks: pruned, locksReset: true, startFresh: true };
};
