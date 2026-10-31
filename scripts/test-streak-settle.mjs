// B43: deadline settle vs automatic recheck. Work done before the Discipline deadline on another device / the widget
// counts even when the app is first opened after the deadline; taps after it still never count; midnight is clean.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const src = path.join(here, '../src/utils');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settle-'));
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.js'))) fs.writeFileSync(path.join(dir, f.replace(/\.js$/, '.mjs')), fs.readFileSync(path.join(src, f), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'").replace(/from '@\/utils\/(\w+)'/g, "from './$1.mjs'"));
const S = await import(path.join(dir, 'streak.mjs')); const D = await import(path.join(dir, 'discipline.mjs'));
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok', name); };
const key = (x) => x.title; const at = (d, hh, mm) => new Date(...d.split('-').map((v, i) => (i === 1 ? v - 1 : +v)), hh, mm).getTime();
const D0 = '2026-10-29'; const D1 = '2026-10-30';
const start = at(D0, 8, 0); const dl = D.deadlineAt(D0, '21:00').getTime();
const done = (k, hh, mm = 0, d = D0) => ({ title: `t${k}`, completed: true, completedAt: new Date(at(d, hh, mm)).toISOString() });
const five = (hh) => [1, 2, 3, 4, 5].map((k) => done(k, hh, k));
const st0 = { streak: 2, bestStreak: 2, lastCompletionDate: '2026-10-28', counted: ['2026-10-28'] };

// (a) done elsewhere before 21:00, app opened 21:30 / 23:10: qualifies, recheck counts it, settle has nothing missed
for (const [hh, mm] of [[21, 30], [23, 10]]) t(`(a) opened ${hh}:${mm}: day counts, streak 2 -> 3`, () => {
  const now = new Date(at(D0, hh, mm));
  assert.ok(D.isPastDeadline(now, D0, '21:00'));
  assert.equal(D.streakGate({ enabled: true }, { missedToday: true }), false, 'old gate refused any count past the deadline');
  assert.ok(S.dayQualifies(five(19), { started: true, startMs: start, endMs: dl, keyOf: key, gate: true }));
  const { keys } = S.countableDoneKeys(five(19), { started: true, startMs: start, endMs: dl, keyOf: key });
  const s = S.recheckDay(st0, D0, { keys, gate: true });
  assert.equal(s.streak, 3); assert.equal(s.lastCompletionDate, D0);
  const dates = D.datesToSettle({ lastSettled: '2026-10-28', enabledOn: '2026-10-01' }, D0, now, '21:00');
  assert.deepEqual(dates, [D0]); assert.deepEqual(D.settleDays(dates, s.counted).missed, [], 'counted before settle -> not missed');
});
t('(a) boss set and not cleared: does not qualify', () => assert.equal(S.dayQualifies(five(19), { started: true, startMs: start, endMs: dl, keyOf: key, gate: D.streakGate({ enabled: true }, { bossSet: true, bossCleared: false }) }), false));
t('(a) day never started: does not qualify', () => assert.equal(S.dayQualifies(five(19), { started: false, startMs: start, endMs: dl, keyOf: key }), false));
t('(a) done before Start Day: does not qualify', () => assert.equal(S.dayQualifies(five(7), { started: true, startMs: start, endMs: dl, keyOf: key }), false));

// (b) same device: a 5th task finished after the deadline never counts; a short day is still missed and breaks the streak
t('(b) 4 before + 1 after the deadline: not counted, settled as missed', () => {
  const tasks = [...five(19).slice(0, 4), done(5, 21, 10)];
  assert.equal(S.dayQualifies(tasks, { started: true, startMs: start, endMs: dl, keyOf: key }), false);
  const { keys } = S.countableDoneKeys(tasks, { started: true, startMs: start, endMs: dl, keyOf: key });
  assert.equal(keys.length, 4); const s = S.recheckDay(st0, D0, { keys, gate: true });
  assert.equal(s.lastCompletionDate, '2026-10-28');
  assert.deepEqual(D.settleDays([D0], s.counted).missed, [D0]);
});
t('(b) tap flow before the deadline unchanged: 5th tap counts once', () => {
  let s = st0; for (let k = 1; k <= 5; k += 1) s = S.applyTaskToggle(s, D0, { key: `t${k}`, completed: true, gate: true });
  assert.equal(s.streak, 3); const again = S.applyTaskToggle(s, D0, { key: 't6', completed: true, gate: true }); assert.equal(again.streak, 3);
});
t('(b) tap after the deadline: gate closed (missedToday) -> not counted', () => {
  let s = st0; for (let k = 1; k <= 5; k += 1) s = S.applyTaskToggle(s, D0, { key: `t${k}`, completed: true, gate: D.streakGate({ enabled: true }, { missedToday: true }) });
  assert.equal(s.lastCompletionDate, '2026-10-28');
});
t('(b) no deadline window (before 21:00): recheck behaves as B41', () => {
  const { keys } = S.countableDoneKeys([...five(19), done(6, 22)], { started: true, startMs: start, endMs: null, keyOf: key }); assert.equal(keys.length, 6);
});
t('(b) a task already counted keeps counting past the deadline (never un-counted)', () => {
  const { keys } = S.countableDoneKeys([done(9, 21, 30)], { started: true, startMs: start, endMs: dl, keyOf: key, prevDone: ['t9'] }); assert.deepEqual(keys, ['t9']);
});

// (c) midnight
t('(c) 23:59 counted, 00:01 next day: yesterday settled with nothing missed, no double count', () => {
  const s = S.recheckDay(st0, D0, { keys: five(19).map(key), gate: true }); assert.equal(s.streak, 3);
  const now = new Date(at(D1, 0, 1));
  const dates = D.datesToSettle({ lastSettled: '2026-10-28', enabledOn: '2026-10-01' }, D1, now, '21:00');
  assert.deepEqual(dates, [D0]); assert.deepEqual(D.settleDays(dates, s.counted).missed, []);
  assert.equal(S.recordCompletion(s, D0).streak, 3, 'crediting the same day again is a no-op');
  const s2 = S.recheckDay(s, D1, { keys: [], gate: true }); assert.equal(s2.streak, 3); assert.equal(s2.dayDone.length, 0);
  assert.equal(S.evaluateStreak(s2, D1).status, 'at-risk');
});
t('(c) yesterday done elsewhere, first open 00:01: credit yesterday -> streak 3, once', () => {
  const s = S.recordCompletion(st0, D0); assert.equal(s.streak, 3); assert.equal(s.lastCompletionDate, D0);
  assert.deepEqual(s.counted, ['2026-10-28', D0]); const again = S.recordCompletion(s, D0); assert.equal(again.streak, 3); assert.deepEqual(again.counted, s.counted);
});
t('(c) 23:59 tasks before a 23:59 deadline count; at 00:01 the new day starts empty', () => {
  const dl2 = D.deadlineAt(D0, '23:59').getTime();
  assert.ok(S.dayQualifies(five(23).map((x, i) => ({ ...x, completedAt: new Date(at(D0, 23, 50 + i)).toISOString() })), { started: true, startMs: start, endMs: dl2, keyOf: key }));
  assert.equal(D.isPastDeadline(new Date(at(D0, 23, 58)), D0, '23:59'), false);
  assert.deepEqual(D.datesToSettle({ lastSettled: '2026-10-28', enabledOn: '2026-10-01' }, D0, new Date(at(D0, 23, 58)), '23:59'), []);
});

// wiring
const home = fs.readFileSync(path.join(here, '../src/views/HomeView.vue'), 'utf8');
const disc = fs.readFileSync(path.join(here, '../src/composables/useDiscipline.js'), 'utf8');
t('wiring: tick awaits the recheck before settling, passes qualifies', () => {
  const i = home.indexOf("await recheckStreak('settle')"); const j = home.indexOf('await settleDeadlines(');
  assert.ok(i > 0 && j > i); assert.match(home.slice(j, j + 400), /qualifies: \(d, st, sd\) => storedDayQualifies/);
});
t('wiring: recheck uses the deadline window (endMs)', () => assert.match(home, /const \{ gate, endMs \} = recheckWindow\(today\)/) || assert.match(home, /startMs: dayStartMs\(\), endMs,/));
t('wiring: settle credits qualifying days instead of killing the streak', () => { assert.match(disc, /ok && await creditDay\(uid, d\)/); assert.match(disc, /dayDiff\(d, today\) <= 1/); });
t('wiring: first-run defaults never overwrite a stored deadline', () => assert.match(disc, /const fresh = await tx\.get\(settingsRef\(uid\)\); const cur = fresh\.exists\(\) \? fresh\.data\(\)\.discipline : null;\n\s*if \(cur\) return normSettings\(cur\);/));
console.log(`streak-settle: ${n} ok`);
