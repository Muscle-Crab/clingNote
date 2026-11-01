// b44: daily points goal suggested in the morning report
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b44pg-'));
fs.copyFileSync(path.join(here, '../src/utils/dailyReport.js'), path.join(dir, 'dailyReport.mjs'));
const D = await import(path.join(dir, 'dailyReport.mjs'));
let n = 0; const t = (name, fn) => { fn(); n++; };
t('empty day -> minimum', () => assert.equal(D.suggestPointsGoal([]).goal, D.POINTS_GOAL_MIN));
t('light day never below minimum', () => assert.equal(D.suggestPointsGoal([{ points: 10 }, { points: 5 }]).goal, 50));
t('heavy day scales up (80%, rounded to 5)', () => { const r = D.suggestPointsGoal([{ points: 40 }, { points: 30 }, { points: 30 }]); assert.equal(r.goal, 80); assert.equal(r.load, 100); assert.equal(r.tasks, 3); });
t('unpointed tasks count as default', () => assert.equal(D.suggestPointsGoal(Array(10).fill({})).load, 100));
t('completed/pending excluded', () => assert.equal(D.suggestPointsGoal([{ points: 90, completed: true }, { points: 90, status: 'pending' }, { points: 100 }]).load, 100));
t('custom minimum respected', () => assert.equal(D.suggestPointsGoal([{ points: 10 }], 70).goal, 70));
t('goal grows monotonically', () => { let prev = 0; for (let k = 0; k < 30; k++) { const g = D.suggestPointsGoal(Array(k).fill({ points: 15 })).goal; assert.ok(g >= prev && g >= 50); prev = g; } });
t('morning message mentions goal', () => { const r = D.buildRecap({ today: '2026-10-31', todayTasks: Array(8).fill({ title: 'x', points: 20 }) }); assert.equal(r.pointsGoal.goal, 130); assert.match(r.text, /🎯 Today's goal: 130 pts \(8 tasks, 160 pts planned\)/); });
t('spoken goal', () => { assert.equal(D.goalSpeech(D.suggestPointsGoal([])), "Today's points goal is 50."); assert.equal(D.goalSpeech(D.suggestPointsGoal(Array(8).fill({ points: 20 }))), "Today's points goal is 130, based on 8 tasks worth 160 points."); });
console.log(`${n} b44 points-goal tests passed`);
