// Server side of the per-session shutdown rule. The goal math is NOT duplicated: it is src/utils/sessionGoal.js, the same module
// the app uses (esbuild bundles it; Node 22 require()s the ESM file in tests). Parity: scripts/test-session-parity.mjs.
const { sessionGoal, sessionOfTask, taskPoints, overtimePoints } = require('../../../src/utils/sessionGoal.js');
const GRACE_MS = 2 * 3600000;
// tasks = the day's countable tasks (same list the app shows); n = session number.
// goal: the lock's frozen session goal (lock.target when lock.goal is set); omitted for legacy locks.
const sessionGrace = (tasks, { n, sessions = 2, startMs, endMs, goal = 0 } = {}) => {
  const g = sessionGoal(tasks, { n, sessions, startMs, endMs, goal });
  return { n, target: g.target, earned: g.earned, done: g.done, met: g.met, untilMs: g.met || g.target <= 0 ? 0 : endMs + GRACE_MS };
};
module.exports = { GRACE_MS, sessionGrace, sessionOfTask, taskPoints, overtimePoints };
