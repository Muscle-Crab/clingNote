// A lock / shutdown cached on this device for account A must never shut account B.
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { load } = require('./lib/srcRequire.js');
const c = load('utils/ehLockCache.js'); const core = load('utils/eightHour.js');
let n = 0, f = 0; const ok = (cond, m) => { n++; if (!cond) { f++; console.log('FAIL', m); } };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const now = Date.parse('2026-10-26T21:00:00Z');
const lockA = { dayKey: '2026-10-26', dayName: 'Mon', startMs: now - 9 * 3600e3, endMs: now - 3600e3, hours: 8, wakeTime: '07:00', tz: 'America/New_York' };
ok(core.isShut(lockA, now), 'fixture: A is shut');
const s = mem(); c.writeLock('A', lockA, s);
ok(c.readLock('A', s) && core.isShut(c.readLock('A', s), now), 'A still shut for A');
ok(c.readLock('B', s) === null, 'A lock not visible to B');
ok(c.readLock(null, s) === null, 'signed-out sees no lock');
s.setItem(c.LEGACY_KEY, JSON.stringify(lockA)); ok(c.readLock('B', s) === null && s.getItem(c.LEGACY_KEY) === null, 'legacy un-keyed v1 lock ignored + removed');
s.setItem(c.keyFor('B'), JSON.stringify({ ...lockA, uid: 'A' })); ok(c.readLock('B', s) === null, 'entry whose uid != key owner ignored');
ok(c.lockFor({ lock: lockA }, 'A', 'B') === null, 'in-memory A state does not shut B');
ok(c.lockFor({ lock: lockA }, 'A', 'A') === lockA, 'in-memory A state applies to A');
ok(c.lockFor({ lock: lockA }, 'A', null) === null && c.lockFor({ lock: lockA }, null, 'B') === null, 'A state not used after sign-out, and unowned state not used for B');
console.log(`lock-per-account: ${n - f} passed${f ? `, ${f} FAILED` : ''}`); process.exit(f ? 1 : 0);
