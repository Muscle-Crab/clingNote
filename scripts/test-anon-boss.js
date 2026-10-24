// Run: node scripts/test-anon-boss.js — "Anonymous for boss": viewers get placeholder title + hashed key; owner data untouched.
const assert = require('assert');
const M = require('../netlify/functions/lib/managerPal');
const NOW = new Date(2026, 9, 23, 20, 0);
const secret = { title: 'ZZTEST Secret therapy', notes: 'ZZTEST private notes', anonymous: true, createdAt: '2026-10-20T10:00:00Z', points: 40, estimateMin: 45, completed: true, reminder: { date: '2026-10-23', time: '09:00' } };
const normal = { title: 'ZZTEST Gym', notes: 'legs', createdAt: '2026-10-20T11:00:00Z', points: 10 };
const owner = JSON.parse(JSON.stringify([secret, normal]));
const out = M.viewTasks([{ day: 'Friday', tasks: owner }], NOW);
const a = out.find((t) => t.anonymous), n = out.find((t) => !t.anonymous);
assert.strictEqual(a.title, 'Anonymous task'); assert.strictEqual(a.points, 40); assert.strictEqual(a.estimateMin, 45);
assert.strictEqual(a.completed, true); assert.strictEqual(a.day, 'Friday'); assert.deepStrictEqual(a.reminder, { date: '2026-10-23', time: '09:00' });
const blob = JSON.stringify(out); assert(!blob.includes('Secret') && !blob.includes('private notes'), 'no leak in boss view');
assert(a.key.startsWith('anon:') && !a.key.includes('ZZTEST'));
assert.strictEqual(M.viewTasks([{ day: 'Friday', tasks: [secret] }], NOW)[0].key, a.key, 'stable key (nudges)');
assert.strictEqual(n.title, 'ZZTEST Gym'); assert(!('anonymous' in n)); assert(!blob.includes('legs'));
assert.strictEqual(owner[0].title, 'ZZTEST Secret therapy'); assert.strictEqual(owner[0].notes, 'ZZTEST private notes'); // owner doc not mutated
assert.strictEqual(M.viewTasks([{ day: 'Friday', tasks: [{ ...secret, anonymous: 'yes' }] }], NOW)[0].title, 'ZZTEST Secret therapy'); // only === true
const sch = M.viewScheduled([{ id: 's1', title: 'ZZTEST Hidden sched', anonymous: true, scheduledDate: '2026-10-24', scheduledTime: '10:00' }, { id: 's2', title: 'ZZTEST Open', scheduledDate: '2026-10-24' }], NOW);
assert.strictEqual(sch[0].title, 'Anonymous task'); assert.strictEqual(sch[0].scheduled.time, '10:00'); assert(!JSON.stringify(sch).includes('Hidden'));
assert(sch.some((x) => x.title === 'ZZTEST Open'));
assert(M.nudgeText('Boss', 'remind', a.title).includes('"Anonymous task"'));
console.log('ok - anon boss redaction (8 groups)');
