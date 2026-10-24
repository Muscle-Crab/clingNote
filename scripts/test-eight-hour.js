// Unit tests for the 8-hour day core: countdown/start phases (before/at/after wake), restart persistence, day rollover, DST, estimator, target, settlement.
const assert = require('assert');
const c = require('../netlify/functions/lib/eightHourCore');
let pass = 0; const ok = (v, m) => { assert.ok(v, m); pass++; }; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };
const TZ = 'America/New_York';
const at = (iso) => Date.parse(iso);
// 2026-10-23 is EDT (UTC-4): 07:00 local = 11:00Z
const WAKE = '07:00';

// wake parsing + clock formatting
eq(c.parseWake('07:00'), { h: 7, m: 0 }); eq(c.parseWake('7:05'), { h: 7, m: 5 }); eq(c.parseWake('24:00'), null); eq(c.parseWake(''), null); eq(c.parseWake('7am'), null);
eq(c.fmtWakeLabel('07:00'), '7:00 AM'); eq(c.fmtWakeLabel('00:30'), '12:30 AM'); eq(c.fmtWakeLabel('15:00'), '3:00 PM');
ok(c.WAKE_PICKER_PRESELECT === '07:00', 'picker preselect is only a UI value');

// no wake chosen => phase none (user must pick explicitly; there is no fixed 5 AM start)
eq(c.evaluatePhase({ wakeTime: '', tz: TZ, nowMs: at('2026-10-23T11:00:00Z'), lock: null }).phase, 'none');
eq(c.evaluatePhase({ wakeTime: WAKE, tz: 'Not/AZone', nowMs: at('2026-10-23T11:00:00Z'), lock: null }).phase, 'none');
ok(c.evaluatePhase({ wakeTime: '05:00', tz: TZ, nowMs: at('2026-10-23T09:30:00Z'), lock: null }).phase === 'ready', '5 AM is just one possible pick, not a fixed start');

// before wake time
let p = c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T10:59:59Z'), lock: null });
eq(p.phase, 'before'); eq(p.wakeMs, at('2026-10-23T11:00:00Z'));
// exactly at wake time
p = c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T11:00:00Z'), lock: null });
eq(p.phase, 'ready'); eq(p.endMs - p.startMs, 8 * 3600e3); eq(p.startMs, at('2026-10-23T11:00:00Z'));
// after wake time, app opened late: window starts when the app sees it (open mode) ...
p = c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T14:30:00Z'), lock: null, mode: 'open' });
eq(p.phase, 'ready'); eq(p.startMs, at('2026-10-23T14:30:00Z')); eq(p.endMs, at('2026-10-23T22:30:00Z'));
// ... or at the wake time itself in strict 'wake' anchoring
p = c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T14:30:00Z'), lock: null, mode: 'wake' });
eq(p.startMs, at('2026-10-23T11:00:00Z')); eq(p.endMs, at('2026-10-23T19:00:00Z'));
eq(c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T20:00:00Z'), lock: null, mode: 'wake' }).phase, 'ended'); // wake-anchored window already over
// UI end label: wake 7 => "Ends 3:00 PM"
eq(c.fmtClock(at('2026-10-23T11:00:00Z') + c.WINDOW_MS, TZ), '3:00 PM');

// persistence across restarts / backgrounding: remaining time derives from the stored start, never from a restart
const lock = { dayKey: '2026-10-23', startMs: at('2026-10-23T11:02:00Z'), endMs: at('2026-10-23T19:02:00Z') };
for (const [now, left] of [['2026-10-23T11:02:00Z', 8 * 3600], ['2026-10-23T13:02:00Z', 6 * 3600], ['2026-10-23T19:01:59Z', 1]]) {
  p = c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at(now), lock });
  eq(p.phase, 'running'); eq(Math.round((p.endMs - at(now)) / 1000), left); eq(p.startMs, lock.startMs, 'start never moves');
}
// changing the wake time afterwards does not touch a running window
eq(c.evaluatePhase({ wakeTime: '12:00', tz: TZ, nowMs: at('2026-10-23T13:00:00Z'), lock }).endMs, lock.endMs);
// a different time zone / device clock quirk cannot move the window (it is epoch based)
eq(c.evaluatePhase({ wakeTime: WAKE, tz: 'Asia/Tokyo', nowMs: at('2026-10-23T13:00:00Z'), lock }).endMs, lock.endMs);
// at end: ended (no second window today)
eq(c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T19:02:00Z'), lock }).phase, 'ended');
eq(c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-23T23:59:00Z'), lock }).phase, 'ended');

// day rollover: next local calendar day => before / ready again
eq(c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-24T03:59:59Z'), lock }).phase, 'ended', '11:59:59 PM local still the same day');
p = c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-24T04:00:00Z'), lock });
eq(p.phase, 'before'); eq(p.dayKey, '2026-10-24');
eq(c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-24T11:00:00Z'), lock }).phase, 'ready');
// a window that crosses local midnight is still running after midnight
const late = { dayKey: '2026-10-23', startMs: at('2026-10-24T01:00:00Z'), endMs: at('2026-10-24T09:00:00Z') };
eq(c.evaluatePhase({ wakeTime: WAKE, tz: TZ, nowMs: at('2026-10-24T05:00:00Z'), lock: late }).phase, 'running');
// day keys follow the user's zone, not UTC
eq(c.dayKeyIn(TZ, at('2026-10-24T03:30:00Z')), '2026-10-23'); eq(c.dayKeyIn('Asia/Tokyo', at('2026-10-24T03:30:00Z')), '2026-10-24');
eq(c.dayNameIn(TZ, at('2026-10-23T15:00:00Z')), 'Fri');
// DST: wall-clock wake time stays 7:00 local on both sides of the change
eq(c.wakeInstant('2026-11-01', { h: 7, m: 0 }, TZ), at('2026-11-01T12:00:00Z')); // EST
eq(c.wakeInstant('2026-11-02', { h: 7, m: 0 }, TZ), at('2026-11-02T12:00:00Z'));
eq(c.wakeInstant('2026-10-31', { h: 7, m: 0 }, TZ), at('2026-10-31T11:00:00Z')); // EDT
eq(c.wakeInstant('2026-03-08', { h: 7, m: 0 }, TZ), at('2026-03-08T11:00:00Z')); // EDT after spring forward

// estimator: deterministic, bounded, complexity x duration
const e1 = c.estimateTask({ title: 'Write quarterly report' }), e2 = c.estimateTask({ title: 'Reply to Sam' }), e3 = c.estimateTask({ title: 'Reply to Sam', estimateMin: 120 });
ok(e1.points > e2.points, 'harder task earns more'); ok(e3.points > e2.points, 'longer task earns more');
eq(c.estimateTask({ title: 'Write quarterly report' }), e1, 'deterministic');
ok(e1.source === 'heuristic' && e1.complexity >= 1 && e1.complexity <= 5);
for (const t of [{}, { title: '' }, { title: 'x'.repeat(500), notes: 'y'.repeat(500), estimateMin: 99999, priority: 'high' }, { title: 'a', estimateMin: -5 }, { title: 'z', estimateMin: 'abc' }]) {
  const r = c.estimateTask(t); ok(r.points >= 5 && r.points <= 150 && r.points % 5 === 0 && r.minutes >= 1 && r.minutes <= 600, 'bounded ' + JSON.stringify(t).slice(0, 30));
}
eq(c.pointsFor(3, 60), 45); eq(c.pointsFor(5, 600), 150); eq(c.pointsFor(1, 1), 5);

// daily target: fixed share of the planned points, never above them, one-time bump by level
let tg = c.dailyTarget([{ points: 60, minutes: 60 }, { points: 40, minutes: 30 }], { targetLevel: 2 });
eq(tg.total, 100); eq(tg.target, 90); ok(tg.target <= tg.total);
eq(c.dailyTarget([{ points: 60 }, { points: 40 }], { targetLevel: 3 }).target, 95);
eq(c.dailyTarget([{ points: 60 }, { points: 40 }], { targetLevel: 4 }).target, 100);
eq(c.dailyTarget([{ points: 60 }, { points: 40 }], { targetLevel: 99 }).target, 100, 'level clamped');
eq(c.dailyTarget([], {}).target, 0);
ok(c.dailyTarget([{ points: 5, minutes: 5 }], {}).target === 5, 'tiny plans still need all points');
ok(c.dailyTarget([{ points: 50, minutes: 450 }], {}).tight === true && c.dailyTarget([{ points: 5, minutes: 10 }], {}).tight === false, 'tight schedule flag');

// settlement: streak, one-time bump until the goal is met, reward
let s = c.settleDay(null, { dayKey: '2026-10-23', earned: 90, target: 90 });
eq([s.streak, s.best, s.targetLevel, s.bumped, s.lastResult], [1, 1, 2, false, 'met']);
let m = c.settleDay(s, { dayKey: '2026-10-24', earned: 10, target: 90 });
eq([m.streak, m.targetLevel, m.bumped, m.lastResult], [0, 3, true, 'missed']); ok(/harder/i.test(m.notice));
let m2 = c.settleDay(m, { dayKey: '2026-10-25', earned: 10, target: 95 });
eq([m2.targetLevel, m2.bumped], [3, true], 'no second bump while still failing');
let m3 = c.settleDay(m2, { dayKey: '2026-10-26', earned: 95, target: 95 });
eq([m3.streak, m3.bumped, m3.notice, m3.targetLevel], [1, false, '', 3], 'goal met clears the notice; level stays');
eq(c.settleDay(m3, { dayKey: '2026-10-26', earned: 0, target: 95 }), m3, 'idempotent per day');
eq(c.settleDay(null, { dayKey: 'd', earned: 0, target: 0 }).lastResult, 'missed', '0 target never counts as met');
eq(c.rewardFor(0), ''); ok(c.rewardFor(3) && c.rewardFor(7) !== c.rewardFor(3));
console.log(`eight-hour core: ${pass} checks passed`);
// progressOf / countableIndexes (client display == server recount)
{
  const lock = { dayKey: '2026-10-23', points: [20, 40, 30] };
  const tasks = [{ completed: true }, { completed: false }, { activeFrom: '2026-10-30', completed: true }, { completed: true }];
  assert.deepStrictEqual(c.countableIndexes(tasks, '2026-10-23'), [0, 1, 3]);
  assert.deepStrictEqual(c.progressOf(lock, tasks), { earned: 50, done: 2, total: 3 });
  console.log('eight-hour progressOf ok');
}
