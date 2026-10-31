// b44 strict boss mode: pure policy tests
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b44sb-'));
for (const f of ['strictDay', 'dailyReport']) fs.copyFileSync(path.join(here, `../src/utils/${f}.js`), path.join(dir, `${f}.mjs`));
fs.writeFileSync(path.join(dir, 'strictDay.mjs'), fs.readFileSync(path.join(dir, 'strictDay.mjs'), 'utf8').replace("'./dailyReport.js'", "'./dailyReport.mjs'"));
const S = await import(path.join(dir, 'strictDay.mjs'));
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name); throw e; } };
const H = 3600000; const base = new Date(2026, 9, 31, 7, 0).getTime(); const dayEnd = base + 9 * H;
const common = { running: true, dayEndMs: dayEnd, selectionCount: 3, enabled: true };
t('mode defaults to simple', () => { assert.equal(S.normBossMode(undefined), 'simple'); assert.equal(S.normBossMode('strict'), 'strict'); assert.equal(S.isStrict({ bossMode: 'x' }), false); });
t('emergency unlock default on, toggle off', () => { assert.equal(S.emergencyAllowed({}), true); assert.equal(S.emergencyAllowed({ emergencyUnlock: false }), false); });
t('goal: never below minimum, adjustable', () => { assert.equal(S.suggestGoal([]).goal, 50); assert.equal(S.adjustGoal(20), 50); assert.equal(S.adjustGoal(122), 120); assert.equal(S.goalFor([], { day: 'd', value: 90 }), 90); });
t('window 0 below goal', () => assert.equal(S.earnedWindowMin({ earned: 49, goal: 50, tasksDone: 5 }), 0));
t('window formula', () => { assert.equal(S.earnedWindowMin({ earned: 50, goal: 50, tasksDone: 4 }), 50); assert.equal(S.earnedWindowMin({ earned: 100, goal: 50, tasksDone: 6 }), 90); });
t('window clamped + tunable', () => { assert.equal(S.earnedWindowMin({ earned: 500, goal: 50, tasksDone: 100 }), 180); assert.equal(S.earnedWindowMin({ earned: 50, goal: 50 }, { ...S.STRICT_TUNING, baseMin: 5 }), 15); });
t('window grows with points and tasks', () => { assert.ok(S.earnedWindowMin({ earned: 80, goal: 50, tasksDone: 3 }) > S.earnedWindowMin({ earned: 50, goal: 50, tasksDone: 3 })); assert.ok(S.earnedWindowMin({ earned: 50, goal: 50, tasksDone: 8 }) > S.earnedWindowMin({ earned: 50, goal: 50, tasksDone: 2 })); });
t('locked while working toward goal', () => { const r = S.strictShield({ ...common, now: base + H, goal: 60, earned: 10 }); assert.equal(r.phase, 'locked'); assert.equal(r.want, true); assert.equal(r.untilMs, dayEnd); });
t('earned window unlocks, then relocks to midnight', () => {
  const at = base + 3 * H; const a = S.strictShield({ ...common, now: at + 10 * 60000, goal: 50, earned: 50, tasksDone: 4, goalAt: at });
  assert.equal(a.phase, 'earned'); assert.equal(a.want, false); assert.equal(a.unlockEndMs, at + 50 * 60000);
  const b = S.strictShield({ ...common, now: at + 51 * 60000, goal: 50, earned: 50, tasksDone: 4, goalAt: at });
  assert.equal(b.phase, 'relocked'); assert.equal(b.want, true); assert.equal(b.untilMs, S.endOfDay(at)); });
t('missed goal by end time: locked rest of day', () => { const r = S.strictShield({ ...common, running: false, now: dayEnd + 60000, goal: 60, earned: 30 }); assert.equal(r.phase, 'missed'); assert.equal(r.untilMs, S.endOfDay(dayEnd)); });
t('emergency unlock / off day / no apps -> off', () => { for (const x of [{ unlockedToday: true }, { offDay: true }, { selectionCount: 0 }, { enabled: false }]) assert.equal(S.strictShield({ ...common, now: base + H, goal: 60, ...x }).phase, 'off'); });
t('off day detection + wake auto-start', () => {
  assert.equal(S.isOffDay('2026-10-31', { offDates: ['2026-10-31'] }), true); assert.equal(S.isOffDay('2026-10-31', { skipDate: '2026-10-31' }), true);
  assert.equal(S.wakeAutoOn({ mode: 'strict', wakeAuto: false, dayKey: '2026-10-30', offDates: ['2026-10-31'] }), true);
  assert.equal(S.wakeAutoOn({ mode: 'strict', wakeAuto: true, dayKey: '2026-10-31', offDates: ['2026-10-31'] }), false);
  assert.equal(S.wakeAutoOn({ mode: 'simple', wakeAuto: false, dayKey: '2026-10-30' }), false); });
t('day-end note', () => { const a = S.dayEndNote({ earned: 100, goal: 50, tasksDone: 6 }); assert.match(a.title, /100\/50/); assert.match(a.body, /1h 30m of screen time/); assert.match(S.dayEndNote({ earned: 10, goal: 50 }).body, /locked until midnight/); });
t('greeting + mood', () => { assert.equal(S.wakeGreeting('Sam', 7), 'Good morning, Sam. How are you feeling?'); assert.match(S.moodReply('low', 70), /70 points/); assert.equal(S.MOODS.length, 4); });
console.log(`${n} b44 strict-boss tests passed`);
