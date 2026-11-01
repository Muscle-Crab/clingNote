// Run: node scripts/test-day-result-banner.mjs  (the lazily-settled day result banner + the server's locked-points matching)
import assert from 'assert';
import { createRequire } from 'module';
import { pendingCelebration, dayLabel } from '../src/utils/pressure.js';
const require = createRequire(import.meta.url);
const stats = { lastDay: '2026-10-29', lastResult: 'missed', lastPenalty: { coins: 10, streakLost: true, shieldUsed: false, missRun: 1 }, streak: 0, awards: [] };
// 1) carries the day it refers to and never reads as today's failure
const c = pendingCelebration(stats, {}, '2026-10-30');
assert.strictEqual(c.title, 'Yesterday (Oct 29): goal missed.');
assert.ok(!/today/i.test(c.title) && !c.lines.some((l) => /today/i.test(l)), 'never implies today failed');
assert.ok(/^Yesterday/.test(c.voice) && !/Streak lost/.test(c.lines.join('|')));
assert.strictEqual(c.stale, false);
assert.strictEqual(dayLabel('2026-10-30', '2026-10-30'), 'Today (Oct 30)');
assert.strictEqual(dayLabel('2026-10-26', '2026-10-30'), 'Mon (Oct 26)');
// 2) shows once: after seen.day is set it's gone
assert.strictEqual(pendingCelebration(stats, { day: '2026-10-29' }, '2026-10-30'), null);
// 3) old results come back stale (caller marks them seen without showing)
assert.strictEqual(pendingCelebration(stats, {}, '2026-11-05').stale, true);
const met = pendingCelebration({ ...stats, lastResult: 'met', lastReward: { xp: 10, coins: 5 }, streak: 3 }, {}, '2026-10-30');
assert.strictEqual(met.title, 'Yesterday (Oct 29): goal met. Well done.');
// 4) the Vue chrome marks seen before showing, passes the local date, and skips stale results
const fs = await import('fs');
const vue = fs.readFileSync(new URL('../src/components/eighthour/EightHourChrome.vue', import.meta.url), 'utf8');
assert.ok(/pendingCelebration\(eh\.stats\.value, readSeen\(\), localYMD\(\)\)/.test(vue));
assert.ok(vue.indexOf('localStorage.setItem(SEEN_KEY') < vue.indexOf('cele.value = c;') && /if \(c\.stale\) return;/.test(vue));
// 5) server points matching: slot n -> tasks[lock.indexes[n]] / stable id, never tasks[n]
const { lockedEarned, stableIdOf } = require('../netlify/functions/eight-hour-day.js')._internal;
const tasks = [{ id: 'a', title: 'not locked', completed: true }, { id: 'b', title: 'B', completed: false }, { id: 'c', title: 'C', completed: true }];
const legacy = { indexes: [1, 2], points: [30, 50] }; // no ids: index fallback
assert.deepStrictEqual(lockedEarned(legacy, tasks), { earned: 50, done: 1 }); // old bug gave 30 (tasks[0] counted)
const withIds = { indexes: [1, 2], ids: [stableIdOf(tasks[1]), stableIdOf(tasks[2])], points: [30, 50] };
const reordered = [tasks[2], { id: 'new', completed: true }, tasks[0], tasks[1]]; // inserted + reordered after Start Day
assert.deepStrictEqual(lockedEarned(withIds, reordered), { earned: 50, done: 1 });
const noId = [{ createdAt: '1', title: 'x', completed: true }]; // tasks without an id match by createdAt|title
assert.deepStrictEqual(lockedEarned({ indexes: [5], ids: [stableIdOf(noId[0])], points: [20] }, noId), { earned: 20, done: 1 });
console.log('test-day-result-banner: ok');
