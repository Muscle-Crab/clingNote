// Next session wait: fewer than 8 completed tasks waits 2h. Eight or more is immediate, even if points are short or important tasks remain.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url); const core = require('../netlify/functions/lib/eightHourCore.js');
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const fn0 = fs.readFileSync(new URL('../netlify/functions/eight-hour-day.js', import.meta.url), 'utf8');
const H = 3600000; const M = 60000; const day = '2026-11-04';
const L = (session) => ({ dayKey: day, startMs: 0, endMs: 8 * H, settled: true, tz: 'America/New_York', session });
const miss = (imp) => L({ target: 100, earned: 40, done: 2, missedImportant: imp });
const met = (imp) => L({ target: 100, earned: 120, done: 8, missedImportant: imp });
t('constants', () => { assert.equal(core.SESSION_COOLDOWN_MS, 2 * H); assert.equal(core.IMPORTANT_MISS_MS, 30 * M); });
t('fewer than 8 tasks waits 2h, important tasks do not add time', () => { assert.equal(core.cooldownUntilMs(miss(0)), 10 * H); assert.equal(core.cooldownUntilMs(miss(2)), 10 * H); assert.equal(core.delayBreakdown(core.delayParts(miss(2))), '2h'); });
t('8 tasks starts the next session immediately, even if points are short or important tasks remain', () => {
  assert.equal(core.cooldownUntilMs(met(1)), 0);
  assert.equal(core.cooldownUntilMs(L({ target: 100, earned: 90, done: 8, missedImportant: 3 })), 0);
});
t('points met but 5 tasks: 2h', () => assert.equal(core.cooldownUntilMs(L({ target: 100, earned: 150, done: 5, missedImportant: 2 })) - 8 * H, 2 * H));
t('both met, none open: 0', () => assert.equal(core.cooldownUntilMs(L({ target: 100, earned: 100, done: 9, missedImportant: 0 })), 0));
t('goal floor: never below 8 × average open-task points', () => {
  assert.equal(core.eightTaskFloor([20, 20, 40, 10, 10, 20, 20, 20, 20, 20]), 160); // avg 20 × 8
  assert.equal(core.flooredGoal(60, [20, 20, 40, 10, 10, 20, 20, 20, 20, 20], 200), 160); // AI/fallback 60 raised to 160
  assert.equal(core.flooredGoal(300, Array(12).fill(30), 360), 300); // a higher goal stays
  assert.equal(core.flooredGoal(20, [20, 20, 20], 60), 60); // < 8 open tasks: clamped to what's open
});
t('server floors the frozen goal', () => assert.match(fn0, /target = core\.flooredGoal\(/));
t('heads-up copy', () => assert.equal(core.SESSION_HEADS_UP, 'Finish 8 tasks and the next session can start right away. Fewer than 8 waits 2h.'));
t('no points goal: main task-count fallback', () => { assert.equal(core.cooldownUntilMs(L({ done: 3 })), 10 * H); assert.equal(core.cooldownUntilMs(L({ done: 8 })), 0); });
t('missedImportant counts only unfinished important, countable tasks', () => {
  const tasks = [
    { title: 'imp open', important: true }, { title: 'high open', priority: 'high' }, { title: 'plain open' },
    { title: 'imp done', important: true, completed: true }, { title: 'imp pending', important: true, status: 'pending' },
    { title: 'imp wontdo', important: true, status: 'wontdo' }, { title: 'imp later', important: true, activeFrom: '2026-11-10' }];
  assert.equal(core.missedImportant(tasks, day), 2);
});
t('nextSessionState: cooldown reason, until, message + breakdown', () => {
  const s = core.nextSessionState({ lock: miss(2), nowMs: 9 * H });
  assert.equal(s.reason, 'cooldown'); assert.equal(s.untilMs, 10 * H); assert.equal(s.breakdown, '2h');
  assert.match(s.message, /^Next session opens at .+ · 2h wait$/);
  assert.equal(core.nextSessionState({ lock: miss(2), nowMs: 10 * H }).ok, true);
});
t('waitText countdown', () => assert.match(core.waitText(11 * H, 9 * H, '2h + 2 important × 30m', 'UTC'), /^Next session in 2h · 11:00 AM \(2h \+ 2 important × 30m\)$/));
t('waitText does not repeat the same duration', () => assert.equal(core.waitText(11 * H, 9 * H, '2h', 'UTC'), 'Next session in 2h · 11:00 AM'));
const fn = fs.readFileSync(new URL('../netlify/functions/eight-hour-day.js', import.meta.url), 'utf8');
t('server settle stores missedImportant on the session', () => assert.match(fn, /missedImportant: missImp/));
t('client _session carries the breakdown', () => assert.match(fn, /breakdown: r\.breakdown/));
const { vaultView } = await import('../src/utils/pointsVault.js');
t('vault stays shut until the same delay runs out', () => {
  const apps = [{ id: 'a', label: 'A', price: 10 }]; const w = { untilMs: 11 * H, text: 'Next session in 2h · 11:00 AM (2h + 2 important × 30m)' };
  const v = vaultView({ apps, priced: apps, points: 500, nowMs: 9 * H, wait: w });
  assert.equal(v.canStart, false); assert.equal(v.openCount, 0); assert.equal(v.text, `🔒 Vault · ${w.text}`);
  const after = vaultView({ apps, priced: apps, points: 500, nowMs: 11 * H, wait: w, accessOpen: true });
  assert.equal(after.openCount, 1); assert.equal(after.points, 500);
});
console.log(`session-delay: ${n} passed`);
