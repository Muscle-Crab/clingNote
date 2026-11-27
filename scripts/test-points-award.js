// Completion award, session baseline, and the first Start of a day.
// The stored points field stays the slot value. The award is completed + completedAt (+ overtime).
// A new session shows 0 until a later completion. Start does not clear a completion from today.
// Run: node scripts/test-points-award.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sr = require('./lib/srcRequire');
const { dayAward, sessionAward, taskAward, frozenPoints } = sr.load('utils/pointsAward.js');
const { chipValues } = sr.load('utils/taskEstimate.js');
const { identityCommit } = sr.load('utils/dayList.js');
const { handler } = require('../netlify/functions/eight-hour-day.js');
const core = require('../netlify/functions/lib/eightHourCore.js');

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };
const chip = (task) => chipValues(task).points;

(async () => {
  await t('stored points are the award when they are positive', () => {
    const task = { title: 'Check email', completed: true, points: 20, completedAt: '2026-11-08T15:00:00.000Z' };
    assert.strictEqual(frozenPoints(task), 20);
    assert.strictEqual(taskAward(task, chip), 20);
    assert.strictEqual(dayAward([task, { title: 'Open', completed: false, points: 20 }], chip), 20);
  });

  await t('legacy zero uses the card value for display and does not require a new stored points value', () => {
    const task = { title: 'Check email', completed: true, points: 0, completedAt: '2026-11-08T15:00:00.000Z' };
    assert.strictEqual(frozenPoints(task), 0);
    assert.ok(chip(task) > 0);
    assert.strictEqual(taskAward(task, chip), chip(task));
    const missing = { title: 'Check email', completed: true, completedAt: '2026-11-08T15:00:00.000Z' };
    assert.strictEqual(taskAward(missing, chip), chip(missing));
    assert.strictEqual(taskAward({ title: 'x', completed: true, points: '0' }, chip), chip({ title: 'x', points: '0' }));
  });

  await t('string and numeric stored points, overtime, and a removed row', () => {
    assert.strictEqual(frozenPoints({ points: '20' }), 20);
    assert.strictEqual(taskAward({ completed: true, points: '20', overDurSec: 100, overSec: 100 }, chip), 10);
    assert.strictEqual(taskAward({ completed: true, points: 20, removed: true }, chip), 0);
    assert.strictEqual(taskAward({ completed: false, points: 20 }, chip), 0);
  });

  await t('new session shows 0 at the baseline and the new award after a completion', () => {
    const before = [{ title: 'Done already', completed: true, points: 20 }, { title: 'Left', completed: false, points: 15 }];
    const baseline = dayAward(before, chip);
    assert.strictEqual(sessionAward(baseline, baseline), 0);
    const after = [{ ...before[0] }, { ...before[1], completed: true, completedAt: '2026-11-08T16:00:00.000Z' }];
    assert.strictEqual(sessionAward(dayAward(after, chip), baseline), 15);
    assert.strictEqual(dayAward(after, chip), 35);
  });

  await t('identityCommit keeps a zero or a positive slot value when the completion is stored', () => {
    const zero = [{ id: 'a', createdAt: 'c', title: 'Check email', points: 0, completed: false }];
    const done0 = identityCommit(zero, [{ ...zero[0], completed: true, completedAt: '2026-11-08T16:00:00.000Z', points: 40 }]);
    assert.strictEqual(done0[0].points, 0);
    assert.strictEqual(done0[0].completed, true);
    assert.strictEqual(done0.length, 1);
    const again = identityCommit(done0, done0.map((row) => ({ ...row, completed: true })));
    assert.strictEqual(again.length, 1);
    assert.strictEqual(again[0].points, 0);
    const kept = [{ id: 'a', createdAt: 'c', title: 'Check email', points: 20, completed: false }];
    const done = identityCommit(kept, [{ ...kept[0], completed: true, completedAt: '2026-11-08T16:00:00.000Z', points: 99, overDurSec: 10, overSec: 0 }]);
    assert.strictEqual(done[0].points, 20);
    assert.strictEqual(done[0].createdAt, 'c');
    assert.strictEqual(done[0].completedAt, '2026-11-08T16:00:00.000Z');
    assert.strictEqual(taskAward(done[0], chip), 20);
  });

  await t('a failed write leaves the previous award in place', () => {
    const live = [{ id: 'a', createdAt: 'c', title: 'Check email', points: 20, completed: true, completedAt: '2026-11-08T15:00:00.000Z' }];
    let stored = live;
    try {
      identityCommit(live, [{ ...live[0], completed: false, points: 0 }]);
      throw new Error('rules denied');
    } catch (e) {
      assert.strictEqual(e.message, 'rules denied');
    }
    assert.strictEqual(dayAward(stored, chip), 20);
    assert.strictEqual(stored[0].completed, true);
  });

  class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
  const plain = (o) => o && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype;
  const merge = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) o[k] = plain(b[k]) && plain(o[k]) ? merge(o[k], b[k]) : b[k]; return o; };
  const mkDb = (seed) => {
    const store = { ...seed };
    const ref = (path) => ({ path, get: async () => ({ exists: path in store, data: () => store[path] }), set: async (d, opt) => { store[path] = opt && opt.merge && store[path] ? merge(store[path], d) : d; } });
    return { store, doc: ref, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) };
  };
  const TZ = 'America/New_York';
  const at = (iso) => Date.parse(iso);
  const clock = at('2026-10-23T15:00:00Z');
  const call = async (db, body) => {
    const r = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer good' }, body: JSON.stringify(body) }, {}, { verify: async () => ({ uid: 'u1' }), db, now: () => clock, ts: (ms) => new Ts(ms), serverTime: () => new Ts(clock) });
    return { code: r.statusCode, body: JSON.parse(r.body) };
  };
  const row = (title, extra) => ({ title, completed: false, createdAt: `c-${title}`, type: 'one-time', points: 10, ...extra });

  await t('first Start keeps today\'s award and clears a recurring completion from the previous local day', async () => {
    assert.strictEqual(core.dayKeyIn(TZ, at('2026-10-23T03:00:00Z')), '2026-10-22');
    assert.strictEqual(core.dayKeyIn(TZ, at('2026-10-23T14:00:00Z')), '2026-10-23');
    const todayAt = '2026-10-23T14:00:00.000Z';
    const db = mkDb({
      'users/u1': { isPro: true, lockInEnabled: true },
      'eightHour/u1': { plan: { wakeTime: '07:00', tz: TZ, taskCount: 4 } },
      'weeklyRoutines/u1_Fri': { tasks: [
        row('Yesterday recurring', { type: 'recurring', completed: true, completedAt: '2026-10-22T20:00:00.000Z', points: 30 }),
        row('Late night recurring', { type: 'recurring', completed: true, completedAt: '2026-10-23T03:00:00.000Z', points: 30 }),
        row('Check email', { completed: true, completedAt: todayAt, points: 10 }),
        row('Timestamp today', { type: 'recurring', completed: true, completedAt: { seconds: Math.floor(at(todayAt) / 1000) }, points: 12 }),
        row('No stamp', { type: 'recurring', completed: true, points: 12 }),
        row('Still open'),
      ] },
    });
    await call(db, { action: 'plan', wakeTime: '07:00', taskCount: 4, tz: TZ });
    const r = await call(db, { action: 'start', hours: 5 });
    assert.strictEqual(r.code, 200, JSON.stringify(r.body));
    const tasks = db.store['weeklyRoutines/u1_Fri'].tasks;
    assert.strictEqual(tasks.find((x) => x.title === 'Yesterday recurring').completed, false);
    assert.strictEqual(tasks.find((x) => x.title === 'Late night recurring').completed, false);
    assert.strictEqual(tasks.find((x) => x.title === 'No stamp').completed, false);
    const email = tasks.find((x) => x.title === 'Check email');
    assert.strictEqual(email.completed, true);
    assert.strictEqual(email.completedAt, todayAt);
    assert.ok(email.points >= 5);
    const stamped = tasks.find((x) => x.title === 'Timestamp today');
    assert.strictEqual(stamped.completed, true);
    assert.strictEqual(stamped.completedAt.seconds, Math.floor(at(todayAt) / 1000));
    const progress = await call(db, { action: 'progress' });
    assert.ok(progress.body.lock.earned > 0);
    assert.strictEqual(progress.body.lock.done, 2);
    const shown = dayAward(tasks.filter((x) => x.completed), (x) => x.points);
    assert.strictEqual(sessionAward(shown, shown), 0);
    const earned = tasks.map((x) => (x.title === 'Still open' ? { ...x, completed: true, completedAt: '2026-10-23T16:00:00.000Z' } : x));
    assert.ok(sessionAward(dayAward(earned.filter((x) => x.completed), (x) => x.points), shown) > 0);
  });

  await t('Home uses one award tally for the baseline and stores overtime without rewriting points', () => {
    const hv = fs.readFileSync(path.join(__dirname, '../src/views/HomeView.vue'), 'utf8');
    assert.ok(hv.includes('const baseline = awardOfList(tasksNow)'));
    assert.ok(hv.includes('const daily = awardOfList(tasks)'));
    assert.ok(hv.includes('sessionAward(pointsAccumulated.value, g.earned)'));
    assert.ok(hv.includes('overDurSec: task.overDurSec ?? null, overSec: task.overSec ?? null'));
    const fn = fs.readFileSync(path.join(__dirname, '../netlify/functions/eight-hour-day.js'), 'utf8');
    assert.ok(fn.includes('const clear = !later && staleRecurring(prev)'));
    assert.ok(!fn.includes('...(later ? {} : { completed: false, completedAt: null })'));
  });

  console.log(`points award: ${n} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
