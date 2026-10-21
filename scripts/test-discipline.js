// Run: node scripts/test-discipline.js  (Discipline Mode pure logic)
const path = require('path'); const fs = require('fs'); const os = require('os');
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-'));
const files = fs.readdirSync(path.join(__dirname, '../src/utils')).filter((f) => f.endsWith('.js'));
for (const f of files) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(__dirname, '../src/utils', f), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'"));
const D = await import(path.join(dir, 'discipline.mjs'));
const S = await import(path.join(dir, 'streak.mjs'));
const R = await import(path.join(dir, 'ranking.mjs'));
const extra = fs.existsSync(path.join(dir, 'rewards.mjs')) ? await import(path.join(dir, 'rewards.mjs')) : null;
const assert = require('assert'); let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
process.env.TZ = 'America/New_York';
const at = (s) => new Date(s); // local time strings
t('default deadline 9 PM', () => { assert.equal(D.normSettings({}).deadline, '21:00'); assert.equal(D.normSettings({ deadline: 'x' }).deadline, '21:00'); });
t('warnings 2h / 30m / none', () => { assert.equal(D.warningFor(at('2026-10-21T18:30:00'), '2026-10-21', '21:00', false), null); assert.equal(D.warningFor(at('2026-10-21T19:10:00'), '2026-10-21', '21:00', false), '2h'); assert.equal(D.warningFor(at('2026-10-21T20:40:00'), '2026-10-21', '21:00', false), '30m'); assert.equal(D.warningFor(at('2026-10-21T20:40:00'), '2026-10-21', '21:00', true), null); assert.equal(D.warningFor(at('2026-10-21T21:01:00'), '2026-10-21', '21:00', false), null); });
t('dates to settle: today only after deadline', () => { const st = { lastSettled: '2026-10-19', enabledOn: '2026-10-01' }; assert.deepEqual(D.datesToSettle(st, '2026-10-21', at('2026-10-21T20:00:00'), '21:00'), ['2026-10-20']); assert.deepEqual(D.datesToSettle(st, '2026-10-21', at('2026-10-21T21:00:00'), '21:00'), ['2026-10-20', '2026-10-21']); });
t('not before enabledOn', () => assert.deepEqual(D.datesToSettle({ enabledOn: '2026-10-21' }, '2026-10-21', at('2026-10-21T10:00:00'), '21:00'), []));
t('4 done by deadline = missed; 5 = ok', () => { let s = null; for (let i = 0; i < 4; i++) s = S.applyTaskToggle(s, '2026-10-21', { key: 'k' + i, completed: true }); assert.deepEqual(D.settleDays(['2026-10-21'], s.counted).missed, ['2026-10-21']); s = S.applyTaskToggle(s, '2026-10-21', { key: 'k9', completed: true }); assert.deepEqual(D.settleDays(['2026-10-21'], s.counted).missed, []); });
t('gate=false blocks counting', () => { let s = null; for (let i = 0; i < 6; i++) s = S.applyTaskToggle(s, '2026-10-21', { key: 'k' + i, completed: true, gate: false }); assert.equal(s.streak, 0); assert.deepEqual(s.counted, []); });
t('-50 penalty, idempotent, tier can drop', () => { let d = { month: '2026-10', done: Array.from({ length: 52 }, (_, i) => `2026-10-01|t${i}`) }; assert.equal(R.computeStats(d).tier, 'Silver'); d = R.applyAdjust(d, '2026-10', 'missed:2026-10-21', D.MISSED_DEADLINE_PENALTY); d = R.applyAdjust(d, '2026-10', 'missed:2026-10-21', D.MISSED_DEADLINE_PENALTY); const s = R.computeStats(d); assert.equal(s.points, 520 + 25 - 50); assert.equal(s.tier, 'Bronze'); assert.equal(R.computeStats(R.applyAdjust(null, '2026-10', 'missed:x', -50)).points, 0); });
t('log capped', () => { let l = []; for (let i = 0; i < 250; i++) l = D.pushLog(l, D.logEntry('missed', '2026-10-21')); assert.equal(l.length, D.LOG_KEEP); });
if (D.bossHp) {
  t('boss HP drains with subtasks', () => { assert.equal(D.bossHp({ subtasks: [{ done: true }, { done: false }, { done: false }, { done: false }] }), 75); assert.equal(D.bossHp({ completed: true }), 0); assert.equal(D.bossHp({ subtasks: [] }), 100); });
  t('boss gate only with discipline on', () => { assert.equal(D.streakGate({ enabled: false }, { bossSet: true, bossCleared: false }), true); assert.equal(D.streakGate({ enabled: true }, { bossSet: true, bossCleared: false }), false); assert.equal(D.streakGate({ enabled: true }, { bossSet: true, bossCleared: true }), true); assert.equal(D.streakGate({ enabled: true }, { bossSet: false }), true); assert.equal(D.streakGate({ enabled: true }, { missedToday: true }), false); });
}
if (D.earnedBreakMinutes) {
  t('breaks: 2/task, +10 for 5, streak escalation', () => { assert.equal(D.earnedBreakMinutes(3, 0), 6); assert.equal(D.earnedBreakMinutes(5, 0), 20); assert.equal(D.earnedBreakMinutes(5, 7), 25); assert.equal(D.earnedBreakMinutes(5, 30), 30); assert.equal(D.earnedBreakMinutes(4, 30), 8); assert.equal(D.earnedBreakMinutes(6, 0, 5), 27); });
  t('gate state', () => { const now = at('2026-10-21T15:00:00'); assert.equal(D.gateState({ count: 2, earned: 4, used: 0, now, today: '2026-10-21', deadline: '21:00' }).mode, 'locked'); assert.equal(D.gateState({ count: 2, earned: 4, used: 0, now, today: '2026-10-21', deadline: '21:00' }).left, 3); assert.equal(D.gateState({ count: 5, earned: 20, used: 5, now, today: '2026-10-21', deadline: '21:00' }).mode, 'can-break'); assert.equal(D.gateState({ count: 5, earned: 20, used: 20, now, today: '2026-10-21', deadline: '21:00' }).mode, 'no-minutes'); assert.equal(D.gateState({ count: 5, earned: 20, used: 0, now, today: '2026-10-21', deadline: '21:00', breakEndsAt: now.getTime() + 60000 }).mode, 'on-break'); });
}
if (extra) {
  t('level curve', () => { assert.equal(extra.levelFor(0).level, 1); assert.equal(extra.levelFor(99).level, 1); assert.equal(extra.levelFor(100).level, 2); assert.equal(extra.levelFor(300).level, 3); assert.equal(extra.levelFor(299).toNext, 1); });
  t('milestone rewards', () => { assert.deepEqual(extra.rewardsFor(2).unlocked, []); assert.deepEqual(extra.rewardsFor(7).unlocked.map((r) => r.days), [3, 7]); assert.equal(extra.rewardsFor(7).freezes, 1); assert.equal(extra.rewardsFor(30).breakBonus, 5); assert.deepEqual(extra.rewardsFor(14).themes, ['ember', 'ocean']); });
  t('freeze bridges one missed day', () => { const r = extra.useFreeze({ streak: 8, bestStreak: 8, lastCompletionDate: '2026-10-19' }, '2026-10-20', { freezes: 1, used: 0 }); assert.equal(r.used, true); assert.equal(r.state.lastCompletionDate, '2026-10-20'); assert.equal(r.state.streak, 8); assert.equal(extra.useFreeze({ streak: 8 }, '2026-10-20', { freezes: 1, used: 1 }).used, false); });
  t('share card has no email', () => { const c = extra.shareCardData({ displayName: 'a@b.com', streak: 4, level: 3, tier: 'Gold' }); assert.equal(c.name, 'Anonymous'); assert.ok(!JSON.stringify(c).includes('@')); });
}
const SC = await import(path.join(dir, 'shareCard.mjs'));
t('procrastination log labels cover all logged types', () => { for (const k of ['missed-deadline', 'gate-open-locked', 'boss-failed', 'freeze-used']) assert.ok(SC.LOG_LABELS[k]); });
console.log(`${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
