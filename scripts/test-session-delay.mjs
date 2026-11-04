// Session-end delay: 2h when the points goal is missed + 30m per unfinished IMPORTANT task (stacking); goal met -> only the 30m each.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url); const core = require('../netlify/functions/lib/eightHourCore.js');
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const H = 3600000; const M = 60000; const day = '2026-11-04';
const L = (session) => ({ dayKey: day, startMs: 0, endMs: 8 * H, settled: true, tz: 'America/New_York', session });
const miss = (imp) => L({ target: 100, earned: 40, done: 2, missedImportant: imp });
const met = (imp) => L({ target: 100, earned: 120, done: 2, missedImportant: imp });
t('constants', () => { assert.equal(core.SESSION_COOLDOWN_MS, 2 * H); assert.equal(core.IMPORTANT_MISS_MS, 30 * M); });
t('goal missed, no important misses: 2h', () => { assert.equal(core.cooldownUntilMs(miss(0)), 10 * H); assert.equal(core.delayBreakdown(core.delayParts(miss(0))), '2h'); });
t('goal missed + 2 important: 3h', () => { assert.equal(core.cooldownUntilMs(miss(2)) - 8 * H, 3 * H); assert.equal(core.delayBreakdown(core.delayParts(miss(2))), '2h + 2 important × 30m'); });
t('goal missed + 3 important: 3h 30m', () => { assert.equal(core.cooldownUntilMs(miss(3)) - 8 * H, 3.5 * H); assert.match(core.cooldownText(miss(3), 11.5 * H, 'UTC'), /· 3h 30m wait \(2h \+ 3 important × 30m\)$/); });
t('goal met + 1 important: 30m only', () => { assert.equal(core.cooldownUntilMs(met(1)) - 8 * H, 30 * M); assert.equal(core.delayBreakdown(core.delayParts(met(1))), '1 important × 30m'); });
t('goal met, nothing important missed: no wait', () => assert.equal(core.cooldownUntilMs(met(0)), 0));
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
  assert.equal(s.reason, 'cooldown'); assert.equal(s.untilMs, 11 * H); assert.equal(s.breakdown, '2h + 2 important × 30m');
  assert.match(s.message, /^Next session opens at .+ · 3h wait \(2h \+ 2 important × 30m\)$/);
  assert.equal(core.nextSessionState({ lock: miss(2), nowMs: 11 * H }).ok, true);
});
t('waitText countdown', () => assert.match(core.waitText(11 * H, 9 * H, '2h + 2 important × 30m', 'UTC'), /^Next session in 2h · 11:00 AM \(2h \+ 2 important × 30m\)$/));
const fn = fs.readFileSync(new URL('../netlify/functions/eight-hour-day.js', import.meta.url), 'utf8');
t('server settle stores missedImportant on the session', () => assert.match(fn, /missedImportant: missImp/));
t('client _session carries the breakdown', () => assert.match(fn, /breakdown: r\.breakdown/));
const { vaultView } = await import('../src/utils/pointsVault.js');
t('vault stays shut until the same delay runs out', () => {
  const apps = [{ id: 'a', label: 'A', price: 10 }]; const w = { untilMs: 11 * H, text: 'Next session in 2h · 11:00 AM (2h + 2 important × 30m)' };
  const v = vaultView({ apps, priced: apps, points: 500, nowMs: 9 * H, wait: w });
  assert.equal(v.canStart, false); assert.equal(v.openCount, 0); assert.equal(v.text, `🔒 Vault · ${w.text}`);
  assert.equal(vaultView({ apps, priced: apps, points: 500, nowMs: 11 * H, wait: w }).openCount, 1);
});
console.log(`session-delay: ${n} passed`);
