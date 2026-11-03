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
// 1. day locked at 12:00 for 8 h (ends 20:00); a task finished at 18:00 (after plan close, before lock end) counts.
const lock = { startMs: at(12), endMs: at(20), index: 0 };
const ph = G.phaseAt(gp, at(18, 30), null, G.lateWindow(gp, lock));
const before = G.earnedPoints([task(10)], { closeMs: G.pointsCloseMs(ph.closeMs, lock) }).points;
const after = G.earnedPoints([task(10), task(18)], { closeMs: G.pointsCloseMs(ph.closeMs, lock) });
assert.strictEqual(before, 20); assert.strictEqual(after.points, 40, 'points go up after the plan close'); assert.strictEqual(after.afterClose, 0);
// still nothing after the real lock end
assert.strictEqual(G.earnedPoints([task(21)], { closeMs: G.pointsCloseMs(ph.closeMs, lock) }).points, 0);
// old behaviour (no lock) still drops it
assert.strictEqual(G.earnedPoints([task(18)], { closeMs: G.dayWindow(gp, at(18)).closeMs }).points, 0);
// 2. single session (index 0) started after the plan close (18:00 -> 23:00) is a late window and earns points.
const late = { startMs: at(18), endMs: at(23), index: 0 };
const lw = G.lateWindow(gp, late); assert.deepStrictEqual(lw, { startMs: at(18), endMs: at(23) });
const p2 = G.phaseAt(gp, at(19), null, lw); assert.strictEqual(p2.phase, 'late'); assert.strictEqual(p2.closeMs, at(23));
assert.strictEqual(G.earnedPoints([task(19, 'l')], { closeMs: G.pointsCloseMs(p2.closeMs, late) }).points, 40);
// an index-0 day inside the plan window is not "late"; a settled lock is ignored
assert.strictEqual(G.lateWindow(gp, lock), null); assert.strictEqual(G.lateWindow(gp, { ...late, settled: true }), null);
assert.strictEqual(G.pointsCloseMs(at(17), { ...lock, settled: true }), at(17));
// wiring
const hv = src('src/views/HomeView.vue');
assert(/closeMs: GP\.pointsCloseMs\(gpPhase\.value\.closeMs, eh\.running\.value \? eh\.lock\.value : null\)/.test(hv));
assert(/const gpLate = computed\(\(\) => GP\.lateWindow\(gp\.value, eh\.lock\.value\)\)/.test(hv));
console.log('coach points window: ok');
