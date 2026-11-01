// Daily task limits + server-side Pro check
import assert from 'assert';
import { createRequire } from 'module';
import { countTasksForDay, checkDailyLimit } from '../src/utils/taskLimits.js';
import { TASK_LIMITS } from '../src/config/pricing.js';
const require = createRequire(import.meta.url);
const { isProDoc, requirePro } = require('../netlify/functions/lib/requirePro.js');
const day = '2026-10-22'; const at = (h) => new Date(2026, 9, 22, h).toISOString();
const t = (h, title = 'x' + h) => ({ title, createdAt: at(h) });
assert.equal(TASK_LIMITS.free, 5); assert.equal(TASK_LIMITS.pro, 5);
assert.equal(countTasksForDay(day, [[t(9), t(10)], [t(9)]], []), 2, 'multi-day copy counted once');
assert.equal(countTasksForDay(day, [[{ ...t(9), scheduledId: 's' }]], [{ scheduledDate: day }]), 1, 'materialized counted via schedule');
assert.equal(countTasksForDay(day, [[{ title: 'old', createdAt: '2026-10-01T10:00:00Z' }]], [{ scheduledDate: day, recurrence: {} }]), 0, 'old + templates ignored');
const many = (n) => Array.from({ length: n }, (_, i) => ({ title: 'x' + i, createdAt: new Date(2026, 9, 22, 8, i).toISOString() }));
assert.equal(checkDailyLimit(false, day, [many(5)], []).ok, false, 'free 6th blocked');
assert.equal(checkDailyLimit(false, day, [many(4)], []).ok, true, 'free 5th ok');
assert.equal(checkDailyLimit(false, day, [[t(8), t(9), t(10), t(11)]], []).ok, true, 'free 5th ok');
assert.equal(checkDailyLimit(false, day, [[t(8), t(9), t(10)]], []).ok, true, 'free 4th ok (limit is 5)');
assert.equal(checkDailyLimit(true, day, [[t(8), t(9), t(10), t(11)]], []).ok, true, 'pro 5th ok');
assert.equal(checkDailyLimit(true, day, [many(5)], []).ok, false, 'pro 6th blocked');
assert.ok(isProDoc({ isPro: true, plan: 'lifetime', proExpiresAt: new Date(0) }));
assert.ok(!isProDoc({ isPro: true, plan: 'monthly', proExpiresAt: { _seconds: 1 } }));
assert.ok(isProDoc({ isPro: true, plan: 'yearly', proExpiresAt: new Date(Date.now() + 1e6) }));
assert.ok(!isProDoc({ isPro: false }) && !isProDoc(null));
const db = (d) => ({ doc: () => ({ get: async () => ({ exists: !!d, data: () => d }) }) });
const verify = async (x) => { if (x !== 'good') throw new Error('bad'); return { uid: 'u' }; };
const st = async (p) => p.then(() => 200, (e) => e.status);
assert.equal(await st(requirePro({ headers: {} }, { verify, db: db({ isPro: true }) })), 401);
assert.equal(await st(requirePro({ headers: { authorization: 'Bearer good' } }, { verify, db: db({ isPro: false }) })), 402);
assert.equal(await st(requirePro({ headers: { authorization: 'Bearer good' } }, { verify, db: db({ isPro: true, plan: 'yearly' }) })), 200);
// Repeat-series occurrences (templateId) never use up the daily limit (build 36 bug: 8 daily repeats blocked every add).
{ const occ = [...Array(8)].map((_, i) => ({ id: `t${i}_2026-10-29`, templateId: `t${i}`, scheduledDate: '2026-10-29' }));
  const r = checkDailyLimit(true, '2026-10-29', [[]], [...occ, { id: 'one', scheduledDate: '2026-10-29' }]);
  assert.equal(r.ok, true); assert.equal(r.count, 1); }
console.log('test-limits: ok');
