// Boss points target for the day: f(user's hours today, the tasks' points/minutes, the one-time level). Preview (client) == lock (server formula).
const assert = require('assert');
const { load } = require('./lib/srcRequire');
const core = require('../netlify/functions/lib/eightHourCore');
const { previewDayTarget, sessionTargetOf, remainingEligible } = load('utils/dayTarget.js');
const { sessionUnlock } = load('utils/strictDay.js');
const { vaultView } = load('utils/pointsVault.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const plan = [{ title: 'Write report', estimateMin: 120, points: 90 }, { title: 'Gym', estimateMin: 60, points: 40 }, { title: 'Emails', estimateMin: 30, points: 20 }];
const total = 150;
const t8 = previewDayTarget(plan, 8, {});
ok(t8.total === total && t8.target <= total && t8.target >= 5, 'target within the plan total');
ok(t8.target >= Math.round(total * 0.8), 'demanding: at least the level ratio of all points');
// more spare time (more hours for the same work) -> higher share required
const t4 = previewDayTarget(plan, 4, {}); const t12 = previewDayTarget(plan, 12, {});
ok(t12.target >= t8.target && t8.target >= t4.target && t12.target > t4.target, `hours change the target (${t4.target} <= ${t8.target} <= ${t12.target})`);
ok(t4.hours === 4 && t12.hours === 12, 'hours reported');
// overloaded plan (more minutes than the window): eased but never below 60%
const heavy = [...Array(6)].map((_, i) => ({ title: `Block ${i}`, estimateMin: 120, points: 100 }));
const h3 = previewDayTarget(heavy, 3, {});
ok(h3.target >= Math.round(600 * 0.6) - 5 && h3.target < 600, 'overloaded day eased, floor 60%');
// tasks change it: AI points on the task are used as-is (not a flat 10)
const more = previewDayTarget([...plan, { title: 'Tax filing', estimateMin: 90, points: 120 }], 8, {});
ok(more.total === total + 120 && more.target > t8.target, 'adding a task recomputes');
ok(previewDayTarget([{ title: 'x', points: 10 }, { title: 'y', points: 10 }], 8, {}).total === 20, 'stored points respected');
// one-time level: a higher level only raises the bar; same inputs -> same answer (no drift during the day)
const lvl4 = previewDayTarget(plan, 8, { targetLevel: 4 });
ok(lvl4.target >= t8.target, 'higher level -> stricter');
ok(previewDayTarget(plan, 8, {}).target === t8.target, 'deterministic (locked once at start)');
// preview matches the server formula used at lock time
const srv = core.dailyTarget(plan.map((t) => ({ points: t.points, minutes: t.estimateMin })), {}, 8 * 60);
ok(srv.target === t8.target, 'client preview == server lock formula');
// hours clamped to 3..12 (user's setting)
ok(previewDayTarget(plan, 50, {}).hours === 12 && previewDayTarget(plan, 1, {}).hours === 3, 'hours clamped');
ok(previewDayTarget([], 8, {}).total === 0, 'no tasks');
const done = { title: 'Done', estimateMin: 60, points: 100, completed: true };
const left = { title: 'Left', estimateMin: 30, points: 20, completed: false };
const pending = { title: 'Later', estimateMin: 30, points: 40, status: 'pending' };
ok(remainingEligible([done, left, pending]).map((t) => t.title).join() === 'Left', 'only unfinished eligible tasks');
ok(done.completed === true, 'completed history is not cleared');
const full = previewDayTarget([done, left], 6, {});
const next = sessionTargetOf([done, left, pending], 6, {});
ok(next.total === 20 && next.target > 0 && next.target <= 20 && next.target < full.target, `session target uses remaining only (${next.target} < ${full.target})`);
ok(sessionTargetOf([done], 6, {}).target === 0, 'no remaining tasks -> target 0');
ok(sessionUnlock({ dayEarned: 210, earnedAtStart: 210, sessionRequired: next.target }) === false, 'old 210 does not meet the new target at 0 earned');
ok(sessionUnlock({ dayEarned: 210 + next.target, earnedAtStart: 210, sessionRequired: next.target }) === true, 'new completion reaches the new target');
const priced = [{ id: 'x', label: 'Messages', price: 170, tasks: 9 }];
const held = vaultView({ apps: [{ id: 'x', label: 'Messages' }], priced, points: 0, accessOpen: false, todayYmd: '2026-11-06', nowMs: 0 });
ok(held.items[0].open === false, 'vault stays shut at session 0 even though the day already has 210');
const opened = vaultView({ apps: [{ id: 'x', label: 'Messages' }], priced, points: 210, accessOpen: true, todayYmd: '2026-11-06', nowMs: 0 });
ok(opened.items[0].open === true, 'the same app opens only when this session is allowed to spend its own points');
console.log(`test-day-target: ${pass} passed`);
