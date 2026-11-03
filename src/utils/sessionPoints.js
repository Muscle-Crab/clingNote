// Per-session points (game plan, pure). Session 1 = the morning session: the Morning section's tasks, its own bar, only points
// earned inside its window count. Session 2 (afternoon/evening) = the rest of the tasks (Noon + Afternoon), same rules, judged
// on its own (a missed morning never changes the afternoon bar). One session a day (gamePlan.sessions = 1): all tasks.
// Target = the sum of the session's tasks' points (SIZE_POINTS, same as the day bar). Shutdown rule: a session that ends
// with earned < target keeps the locked apps locked SESSION_RULES.graceMs (2 h) past its end, then they unlock on their own.
import { dayWindow, lastSessionWindow } from './gamePlan.js';
import { SESSION1_SECTIONS, sessionOfTask as goalSessionOf, sessionGoal } from './sessionGoal.js';

export const SESSION_RULES = Object.freeze({ graceMs: 2 * 3600000, names: Object.freeze(['Morning', 'Afternoon']), session1Sections: SESSION1_SECTIONS });
export const sessionOfTask = (t, sessions = 2) => goalSessionOf(t, sessions);
// Windows: the day split in half (session 2 starts at the midpoint, like the focus blocks); with 1 session, the whole day.
export const sessionWindows = (gp, nowMs = Date.now()) => {
  // anchored to the session the user started (running or last ended); no fixed day start
  const l = lastSessionWindow(); const w = l ? { startMs: l.startMs, closeMs: l.endMs, dayKey: dayWindow(gp, l.startMs).dayKey } : dayWindow(gp, nowMs); if (gp.sessions === 1) return [{ n: 1, startMs: w.startMs, endMs: w.closeMs, dayKey: w.dayKey }];
  const mid = w.startMs + (w.closeMs - w.startMs) / 2;
  return [{ n: 1, startMs: w.startMs, endMs: mid, dayKey: w.dayKey }, { n: 2, startMs: mid, endMs: w.closeMs, dayKey: w.dayKey }];
};
// Exactly the server's function (sessionGoal.js: same task->session map, same per-task points). Extra opts are ignored on purpose.
export const sessionPoints = (tasks, win, { sessions = 2 } = {}) => sessionGoal(tasks, { ...win, sessions });
export const sessionsOf = (gp, tasks, nowMs = Date.now(), opts = {}) => sessionWindows(gp, nowMs).map((w) => ({ ...w, ...sessionPoints(tasks, w, { sessions: gp.sessions, ...opts }) }));
// The session now: the one whose window holds now; after the last ends, the last (its grace may still run); before the day, session 1.
export const currentSession = (list, nowMs = Date.now()) => list.find((s) => nowMs >= s.startMs && nowMs < s.endMs) || (nowMs >= list[list.length - 1].endMs ? list[list.length - 1] : list[0]);
// Grace lock: { want, untilMs, n, target, earned } for a session that ended missed and whose 2 h are still running, else want: false.
export const graceLock = (list, nowMs = Date.now(), r = SESSION_RULES) => {
  const s = (list || []).filter((x) => x.endMs > x.startMs && !x.met && x.target > 0 && nowMs >= x.endMs && nowMs < x.endMs + r.graceMs).pop();
  return s ? { want: true, untilMs: s.endMs + r.graceMs, n: s.n, target: s.target, earned: s.earned } : { want: false, untilMs: 0 };
};
// Background hold after a short session: native DebtHold, planned by debtHoldPlan (src/utils/appLockDebt.js), for every user.
export const sessionLabel = (s, sessions = 2, r = SESSION_RULES) => (sessions === 1 ? `${s.earned}/${s.target} pts` : `${r.names[s.n - 1]} ${s.earned}/${s.target} pts`);
const clock = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
// Shutdown screen result line: "Missed 215 pts: apps open at 7:27 PM" / "Goal met · 220/215 pts".
export const graceText = ({ met, earned, target, untilMs }, fmt = clock) => (met ? `Goal met · ${earned}/${target} pts` : `Missed ${target} pts: apps open at ${fmt(untilMs)}`);
