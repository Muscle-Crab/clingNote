// Coach points count until the end of the eight-hour day the user actually started (not the plan's fixed close).
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpw-'));
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
fs.writeFileSync(path.join(dir, 'vue.mjs'), 'export const ref = (value) => ({ value });\n');
fs.writeFileSync(path.join(dir, 'gp.mjs'), src('src/utils/gamePlan.js').replace("from 'vue'", "from './vue.mjs'"));
for (const f of ['sessionGoal.js', 'aiEstimate.js', 'taskSections.js']) fs.writeFileSync(path.join(dir, f), src(`src/utils/${f}`));
const G = await import(path.join(dir, 'gp.mjs'));
const at = (h, m = 0) => new Date(2026, 10, 2, h, m).getTime();
const gp = G.normPlan({ dayStart: '09:00' }); // plan closes 17:00
const task = (h, size = 'm') => ({ title: 'ZZTEST', size, completed: true, completedAt: at(h) });
// start anytime: the game-plan day IS the session the user started (no fixed day start / plan close / late window).
// 1. session started at 12:00 for 8 h (ends 20:00): a task at 18:00 (after the old 17:00 plan close) counts; nothing after 20:00.
const lock = { startMs: at(12), endMs: at(20), index: 0 };
G.setSessionWindow(lock);
const ph = G.phaseAt(gp, at(18, 30), null, G.lateWindow(gp, lock));
assert.notStrictEqual(ph.phase, 'closed'); assert.strictEqual(ph.closeMs, at(20), 'close = the session end');
const close = G.pointsCloseMs(ph.closeMs, lock);
assert.strictEqual(G.earnedPoints([task(10)], { closeMs: close }).points, 20);
const after = G.earnedPoints([task(10), task(18)], { closeMs: close });
assert.strictEqual(after.points, 40, 'points go up after the old plan close'); assert.strictEqual(after.afterClose, 0);
assert.strictEqual(G.earnedPoints([task(21)], { closeMs: close }).points, 0, 'nothing after the session end');
// 2. an evening session (18:00 -> 23:00) is just a session: it earns points, no special "late" window needed
const eve = { startMs: at(18), endMs: at(23), index: 1 };
G.setSessionWindow(eve);
const p2 = G.phaseAt(gp, at(19), null, G.lateWindow(gp, eve)); assert.strictEqual(p2.closeMs, at(23));
assert.strictEqual(G.earnedPoints([task(19, 'l')], { closeMs: G.pointsCloseMs(p2.closeMs, eve) }).points, 40);
assert.strictEqual(G.lateWindow(gp, eve), null, 'late windows are gone');
// 3. no session running: closed, nothing gated by a clock (closeMs 0 = uncapped)
G.setSessionWindow(null);
const p3 = G.phaseAt(gp, at(10)); assert.strictEqual(p3.phase, 'closed'); assert.strictEqual(p3.closeMs, 0);
assert.strictEqual(G.pointsCloseMs(at(17), { ...lock, settled: true }), at(17));
// wiring
const hv = src('src/views/HomeView.vue');
assert(/closeMs: GP\.pointsCloseMs\(gpPhase\.value\.closeMs, eh\.running\.value \? eh\.lock\.value : null\)/.test(hv));
assert(/const gpLate = computed\(\(\) => \{ GP\.setSessionWindow\(eh\.lock\.value\)/.test(hv));
console.log('coach points window: ok');
