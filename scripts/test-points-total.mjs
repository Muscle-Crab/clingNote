// Regression: the session card total must follow a task by its stable id, not by array position (publicLock dropped ids).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url); const core = require('../netlify/functions/lib/eightHourCore.js');
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const day = '2026-11-03';
const tasks0 = [{ id: 'a', title: 'A', points: 20 }, { id: 'b', title: 'B', points: 10 }];
const lock = { dayKey: day, points: [20, 10], ids: [core.stableIdOf(tasks0[0]), core.stableIdOf(tasks0[1])] };
t('completing the 10-pt task adds 10 even after an insert above it', () => {
  const tasks = [{ id: 'new', title: 'New', points: 40 }, ...tasks0.map((x) => ({ ...x }))]; tasks[2].completed = true;
  assert.equal(core.progressOf(lock, tasks).earned, 10);
  assert.notEqual(core.progressOf({ dayKey: day, points: lock.points }, tasks).earned, 10); // the old positional path (the bug)
});
t('un-complete takes it back', () => { assert.equal(core.progressOf(lock, tasks0.map((x) => ({ ...x, completed: false }))).earned, 0); });
const fn = fs.readFileSync(new URL('../netlify/functions/eight-hour-day.js', import.meta.url), 'utf8');
const card = fs.readFileSync(new URL('../src/components/home/EightHourCard.vue', import.meta.url), 'utf8');
t('publicLock sends ids to the client', () => assert.match(fn, /const publicLock[^\n]*\n[^\n]*ids: Array\.isArray\(l\.ids\)/));
t('the card passes ids to progressOf', () => assert.match(card, /progressOf\(\{[^}]*ids: l\.ids/));
// Session access rule: one constant, 2h cooldown, debt + streak.
const H = 3600000; const base = { dayKey: day, startMs: 0, endMs: 8 * H, settled: true, tz: 'America/New_York' };
t('constants', () => { assert.equal(core.TASKS_PER_SESSION, 8); assert.equal(core.SESSION_COOLDOWN_MS, 2 * H); });
t('8+ tasks -> next session right away', () => assert.equal(core.nextSessionState({ lock: { ...base, session: { done: 8 } }, nowMs: 8 * H + 1 }).ok, true));
t('<8 tasks -> 2h wait, then open', () => { const s = core.nextSessionState({ lock: { ...base, session: { done: 5 } }, nowMs: 9 * H });
  assert.equal(s.reason, 'cooldown'); assert.equal(s.untilMs, 10 * H); assert.match(s.message, /^Next session opens at .+ · 2h wait$/);
  assert.equal(core.nextSessionState({ lock: { ...base, session: { done: 5 } }, nowMs: 10 * H }).ok, true); });
t('heads-up copy', () => assert.equal(core.SESSION_HEADS_UP, 'Hit your points goal, or your next session waits 2h, plus 30m per unfinished important task.'));
t('debt clears only with goal met AND 8 tasks', () => { const d = { sessionKey: 'k', sinceMs: 1 };
  assert.equal(core.debtCleared(d, { startMs: 2, target: 50, earned: 60, done: 7 }), false);
  assert.equal(core.debtCleared(d, { startMs: 2, target: 50, earned: 60, done: 8 }), true); });
const { DAILY_STREAK_MIN } = await import('../src/utils/streak.js');
t('streak needs 8 tasks (same constant)', () => assert.equal(DAILY_STREAK_MIN, core.TASKS_PER_SESSION));
t('server rejects Start during the cooldown', () => assert.match(fn, /reason === 'cooldown'\) throw fail\(409/));
console.log(`points total + session rule: ${n} passed`);
