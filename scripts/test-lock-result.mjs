// Agent "lock X" must never report success when nothing was shielded.
import assert from 'assert';
import { describeLock } from '../src/utils/appLockNames.js';
const now = 1e12, until = now + 3600000; let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
let r = describeLock({ plan: { labels: ['Instagram'] }, r: { locked: [] }, until, now }); ok(r.error && !r.summary && /Instagram/.test(r.error), 'empty lock is an error');
r = describeLock({ plan: { labels: ['Instagram'] }, r: { locked: [], error: 'not_authorized' }, now }); ok(/permission/.test(r.error), 'not authorized');
r = describeLock({ plan: { labels: ['Instagram'] }, r: { locked: ['Instagram'], apps: [{ label: 'Instagram', locked: false }] }, now }); ok(r.error, 'native says not locked');
r = describeLock({ plan: { labels: ['instagram'] }, r: { locked: ['Instagram'], apps: [{ label: 'Instagram', locked: true }] }, until, now }); ok(!r.error && r.summary === 'Locked Instagram for 1h.', r.summary);
r = describeLock({ plan: { labels: ['Instagram', 'TikTok'] }, r: { locked: ['TikTok'] }, now }); ok(!r.error && r.failed.join() === 'Instagram' && /Instagram could not be locked/.test(r.summary), 'partial');
r = describeLock({ plan: { labels: ['X'] }, r: {}, now }); ok(r.error, 'plugin failure fallback {} is an error');
console.log(`test-lock-result: ${n} passed`);
