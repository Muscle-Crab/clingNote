// Run: node scripts/test-strict-boss.js  (Strict Boss Mode pure logic)
const path = require('path'); const fs = require('fs'); const os = require('os'); const assert = require('assert');
process.env.TZ = 'America/New_York';
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boss-'));
for (const f of fs.readdirSync(path.join(__dirname, '../src/utils')).filter((f) => f.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"));
const B = await import(path.join(dir, 'strictBoss.mjs')); const D = await import(path.join(dir, 'discipline.mjs'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const at = (s) => new Date(s); const day = '2026-10-21';
t('strict defaults on: discipline, 9 PM, strict', () => { const d = D.normSettings(null); assert.equal(d.enabled, true); assert.equal(d.deadline, '21:00'); assert.equal(d.strict, true); assert.equal(D.normSettings({ enabled: false, strict: false }).strict, false); });
t('morning orders', () => { const m = B.bossMessage(at(`${day}T08:00:00`), day, '21:00', 0, 5); assert.equal(m.phase, 'morning'); assert.ok(m.text.includes('5') && m.text.includes('21:00')); });
t('midday callout only if <2 done', () => { assert.equal(B.bossPhase(at(`${day}T13:00:00`), day, '21:00', 1, 5), 'midday'); assert.equal(B.bossPhase(at(`${day}T13:00:00`), day, '21:00', 2, 5), null); });
t('evening warning within 3h of deadline', () => { assert.equal(B.bossPhase(at(`${day}T18:30:00`), day, '21:00', 3, 5), 'evening'); assert.equal(B.bossPhase(at(`${day}T17:30:00`), day, '21:00', 3, 5), null); assert.ok(B.bossMessage(at(`${day}T20:15:00`), day, '21:00', 3, 5).text.includes('45m')); });
t('done → quiet until verdict', () => { assert.equal(B.bossPhase(at(`${day}T19:00:00`), day, '21:00', 5, 5), null); assert.equal(B.bossPhase(at(`${day}T21:00:00`), day, '21:00', 5, 5), 'verdict'); });
t('verdict passed/failed text', () => { assert.equal(B.bossMessage(at(`${day}T21:30:00`), day, '21:00', 5, 5).kind, 'passed'); assert.equal(B.bossMessage(at(`${day}T21:30:00`), day, '21:00', 2, 5).kind, 'failed'); });
t('grades', () => { assert.deepEqual([8, 5, 3, 2, 0].map((d) => B.verdict({ done: d, min: 5, total: 9 }).grade), ['A+', 'B', 'C', 'D', 'F']); assert.equal(B.verdict({ done: 5, min: 5, total: 5 }).grade, 'A'); assert.equal(B.verdict({ done: 6, min: 5, total: 6 }).grade, 'A+'); assert.equal(B.verdict({ done: 4, min: 5 }).passed, false); });
t('reason required', () => { assert.equal(B.validReason(''), false); assert.equal(B.validReason('x'), false); assert.equal(B.validReason('aaaaaaaaaa'), false); assert.equal(B.validReason('too tired after work'), true); });
t('one carry free, second → boss watching', () => { const a = B.carryTask({ title: 'Taxes' }); assert.equal(a.carryCount, 1); assert.equal(a.bossWatching, false); const b = B.carryTask(a); assert.equal(b.bossWatching, true); assert.equal(b.overdue, true); });
t('watching blocks non-urgent adds only', () => { const tasks = [{ title: 'Taxes', bossWatching: true, completed: false }]; assert.equal(B.canAddTask(tasks, { priority: 'low' }, true).ok, false); assert.ok(B.canAddTask(tasks, { priority: 'low' }, true).message.includes('Taxes')); assert.equal(B.canAddTask(tasks, { priority: 'high' }, true).ok, true); assert.equal(B.canAddTask(tasks, { priority: 'low' }, false).ok, true); assert.equal(B.canAddTask([{ ...tasks[0], completed: true }], {}, true).ok, true); assert.equal(B.canAddTask([{ ...tasks[0], status: 'pending' }], {}, true).ok, true); });
t('idle 30+ min with open tasks', () => { const now = Date.now(); assert.equal(B.isIdle(now - 31 * 60000, now, 2), true); assert.equal(B.isIdle(now - 29 * 60000, now, 2), false); assert.equal(B.isIdle(now - 60 * 60000, now, 0), false); });
t('tone: no insults in any line', () => { const bad = /\b(stupid|idiot|loser|lazy|worthless|pathetic|dumb|fat|ugly)\b/i; for (const k of Object.keys(B.LINES)) for (const l of B.LINES[k]) assert.ok(!bad.test(l), l); });
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
