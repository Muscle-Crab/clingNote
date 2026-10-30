// B41: PUBG-style streak rank tiers inside the streak medal + automatic streak recheck (pure logic + wiring).
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { RANK_TIERS, rankFor, rankIndex, rankUp, RANK_SHAPES } = await import('../src/utils/streakRank.js');
const { recheckDay, countableDoneKeys, recheckChanges, applyTaskToggle, STREAK_CAP, DAILY_STREAK_MIN } = await import('../src/utils/streak.js');
// tiers: all six, in order, each its own medal (colours + shape path) and burst colour
const names = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'];
assert.deepEqual(RANK_TIERS.map((t) => t.name), names);
assert.equal(new Set(RANK_TIERS.map((t) => t.fill)).size, 6, 'distinct medal fills');
assert.equal(new Set(RANK_TIERS.map((t) => t.burst)).size, 6, 'distinct bursts');
for (const t of RANK_TIERS) { assert.ok(RANK_SHAPES[t.shape], t.name + ' shape'); assert.ok(t.rim && t.glow, t.name + ' rim/glow'); }
for (let n = 0; n <= STREAK_CAP; n += 1) assert.equal(rankFor(n).name, names[n]);
assert.equal(rankFor(99).name, 'Master'); assert.equal(rankFor(-3).name, 'Bronze'); assert.equal(rankIndex('x'), 0);
for (let n = 0; n < STREAK_CAP; n += 1) assert.equal(rankUp(n, n + 1), true, `burst ${names[n + 1]}`);
assert.equal(rankUp(3, 3), false); assert.equal(rankUp(4, 2), false);
// ProgressBar: emblem + burst live inside the existing medal svg (no new box), label carries the rank
const pb = fs.readFileSync(new URL('../src/components/home/ProgressBar.vue', import.meta.url), 'utf8');
const medal = pb.slice(pb.indexOf('<svg viewBox="0 0 64 64" class="streak-medal"'), pb.indexOf('</svg>', pb.indexOf('class="streak-medal"')));
for (const s of ['data-test="streak-rank"', 'class="rank-emblem"', 'data-test="rank-burst"', 'medal-fill']) assert.ok(medal.includes(s), s);
for (const s of ['rankUp(from, to)', '@keyframes rank-burst', '@keyframes rank-pop', "sfx('charge'", "sfx('impact')", 'scene--zoom']) assert.ok(pb.includes(s), s);
// recheck: only tasks done after Start Day
const key = (t) => t.id; const start = Date.parse('2026-10-30T09:00:00');
const mk = (id, at, extra = {}) => ({ id, completed: true, completedAt: at, ...extra });
const tasks = [mk('a', '2026-10-30T08:00:00'), mk('b', '2026-10-30T09:30:00'), mk('c', '2026-10-30T10:00:00'), mk('d', '2026-10-30T11:00:00'), mk('e', '2026-10-30T11:30:00'), mk('f', '2026-10-30T12:00:00', { status: 'pending' }), { id: 'g', completed: false }];
assert.deepEqual(countableDoneKeys(tasks, { started: false, startMs: start, keyOf: key }).keys, []);
let r = countableDoneKeys(tasks, { started: true, startMs: start, keyOf: key });
assert.deepEqual(r.keys, ['b', 'c', 'd', 'e']); assert.ok(r.drop.includes('a') && r.drop.includes('f') && r.drop.includes('g'));
// legacy (no completedAt): counts only if already counted
assert.deepEqual(countableDoneKeys([{ id: 'x', completed: true }], { started: true, startMs: start, keyOf: key, prevDone: ['x'] }).keys, ['x']);
assert.deepEqual(countableDoneKeys([{ id: 'x', completed: true }], { started: true, startMs: start, keyOf: key }).keys, []);
// gate blocked: 5 done but boss not cleared -> not counted; gate clears -> recheck counts it with no tap
const today = '2026-10-30'; let st = { streak: 2, bestStreak: 2, lastCompletionDate: '2026-10-29' };
const five = ['b', 'c', 'd', 'e', 'h'];
for (const k of five) st = applyTaskToggle(st, today, { key: k, completed: true, gate: false });
assert.equal(st.streak, 2); assert.equal(st.dayDone.length, DAILY_STREAK_MIN);
const blocked = recheckDay(st, today, { keys: five, gate: false }); assert.equal(blocked.streak, 2); assert.equal(recheckChanges(st, blocked, today), false);
const cleared = recheckDay(st, today, { keys: five, gate: true }); assert.equal(cleared.streak, 3); assert.equal(cleared.lastCompletionDate, today); assert.equal(recheckChanges(st, cleared, today), true);
// idempotent: rechecking again changes nothing (no extra writes, no double count)
const again = recheckDay(cleared, today, { keys: five, gate: true }); assert.equal(again.streak, 3); assert.equal(recheckChanges(cleared, again, today), false);
// pre-Start-Day completions dropped from dayDone; a later deadline (gate false) never un-counts a counted day
const dropped = recheckDay({ ...cleared }, today, { keys: five, drop: ['a'], gate: false }); assert.equal(dropped.streak, 3);
const pre = recheckDay({ streak: 1, lastCompletionDate: '2026-10-29', dayDate: today, dayDone: ['a', 'b', 'c', 'd', 'e'] }, today, { keys: ['b', 'c', 'd', 'e'], drop: ['a'], gate: true });
assert.equal(pre.streak, 1); assert.deepEqual(pre.dayDone.sort(), ['b', 'c', 'd', 'e']);
// HomeView wiring: reactive watchers + periodic + resume/visibility + toggle respects Start Day
const hv = fs.readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8');
for (const s of ["scheduleRecheck('gate')", "scheduleRecheck('day-start')", "scheduleRecheck('tasks')", "scheduleRecheck('new-day')", "scheduleRecheck('visible')", "scheduleRecheck('resume')", "recheckStreak('timer')", 'STREAK_RECHECK_MS = 45000', "App.addListener('resume', onRecheckResume)", 'clearInterval(streakTick)', 'completedAfterStart(task)']) assert.ok(hv.includes(s), s);
const ms = Number(hv.match(/STREAK_RECHECK_MS = (\d+)/)[1]); assert.ok(ms >= 30000 && ms <= 60000);
console.log('test-b41-streak: ok');
