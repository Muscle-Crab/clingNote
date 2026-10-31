// Coach game plan (fixed week, focus block, breaks, hard close, size points + goal, locking, close picker, shift day): pure + wiring tests.
import assert from 'assert'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.join(here, '..'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-'));
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
fs.writeFileSync(path.join(dir, 'vue.mjs'), 'export const ref = (value) => ({ value });\n');
fs.writeFileSync(path.join(dir, 'gp.mjs'), src('src/utils/gamePlan.js').replace("from 'vue'", "from './vue.mjs'"));
const G = await import(path.join(dir, 'gp.mjs'));
let n = 0; const t = (name, fn) => { try { fn(); n++; console.log('ok ', name); } catch (e) { console.error('FAIL', name); throw e; } };
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime(); // Nov 2026, box-local
const MIN = 60000;

t('1 defaults + onboarding wake time as day start', () => {
  const g = G.normPlan({}); assert.strictEqual(g.dayStart, '09:00'); assert.strictEqual(g.reviewDow, 0); assert.strictEqual(g.reviewTime, '18:00'); assert.strictEqual(g.minGoal, 50);
  assert.strictEqual(G.normPlan({}, '07:30').dayStart, '07:30'); assert.strictEqual(G.normPlan({ dayStart: '10:00' }, '07:30').dayStart, '10:00');
});
t('6 friend approval is optional and OFF by default', () => {
  assert.strictEqual(G.normPlan({}).friendUnlock, false); assert.strictEqual(G.normPlan({ friend: { name: 'ZZTEST Sam' } }).friendUnlock, false);
  assert.strictEqual(G.normPlan({ friendUnlock: true }).friendUnlock, true); assert.strictEqual(G.normPlan({ friendUnlock: 'yes' }).friendUnlock, false);
  const row = fs.readFileSync(new URL('../src/components/home/GamePlanRow.vue', import.meta.url), 'utf8'); assert(/v-if="locked && friendOn"/.test(row));
});
t('1 edits are queued, applied only at the weekly review', () => {
  let g = G.normPlan({ dayStart: '09:00', lastReview: G.reviewKey(G.normPlan({}), at(2, 12)) }); // Mon Nov 2: reviewed Sun Nov 1
  g = G.queueEdit(g, { dayStart: '06:00', friend: { name: 'x' } }, at(3, 10));
  assert.strictEqual(g.dayStart, '09:00'); assert.strictEqual(g.pending.dayStart, '06:00'); assert(!('friend' in g.pending));
  assert.strictEqual(G.dayWindow(g, at(4, 12)).startMs, at(4, 9)); // still the old schedule mid-week
  assert(!G.reviewDue(g, at(7, 12))); assert(G.reviewDue(g, at(8, 18, 1))); // Sun Nov 8 18:00
  const s = G.weekSummary({}, g, at(8, 18, 1)); assert.strictEqual(s.proposals[0].id, 'queued');
  const g2 = G.applyReview(g, at(8, 18, 1)); assert.strictEqual(g2.dayStart, '06:00'); assert.strictEqual(g2.pending, null); assert(!G.reviewDue(g2, at(9, 9)));
});
t('1 weekly review shows results and proposes raise / lower', () => {
  const g = G.normPlan({ minGoal: 50 }); const log = {}; for (let d = 2; d <= 7; d++) log[`2026-11-0${d}`] = { earned: 100, goal: 80 };
  const s = G.weekSummary(log, g, at(8, 19)); assert.strictEqual(s.days.length, 6); assert.strictEqual(s.hit, 6); assert.strictEqual(s.total, 600);
  assert(s.proposals.find((p) => p.id === 'raise' && p.patch.minGoal === 60));
  const low = {}; for (let d = 2; d <= 7; d++) low[`2026-11-0${d}`] = { earned: 10, goal: 80, penalty: d === 3 ? 25 : 0 };
  const s2 = G.weekSummary(low, g, at(8, 19)); assert(s2.proposals.find((p) => p.id === 'lower' && p.patch.minGoal === 40)); assert.strictEqual(s2.penalties, 25);
});
t('2+3 focus 50 / break 10 / focus 50 / break 10 from the day start', () => {
  const g = G.normPlan({ dayStart: '09:00' });
  assert.strictEqual(G.phaseAt(g, at(2, 8, 30)).phase, 'before');
  const f1 = G.phaseAt(g, at(2, 9, 10)); assert.strictEqual(f1.phase, 'focus'); assert.strictEqual(f1.n, 1); assert.strictEqual(f1.leftMin, 40);
  assert.strictEqual(G.phaseAt(g, at(2, 9, 55)).phase, 'work'); // no automatic break
  assert.strictEqual(G.phaseAt(g, at(2, 10, 5)).phase, 'focus'); assert.strictEqual(G.phaseAt(g, at(2, 10, 5)).n, 2);
  assert.strictEqual(G.phaseAt(g, at(2, 10, 55)).phase, 'work'); assert.strictEqual(G.phaseAt(g, at(2, 11, 0)).phase, 'work');
  assert.deepStrictEqual(G.quietWindows(g, at(2, 9)), [[at(2, 9), at(2, 9, 50)], [at(2, 10), at(2, 10, 50)]]);
  const n = G.breakNote(1); assert(/break earned/.test(n.title) && !/start/i.test(n.title) && /never cost points/.test(n.body));
});
t('earned breaks: banked, user-started, no stacking past earned, capped at close, relock to prior', () => {
  const g = G.normPlan({ dayStart: '09:00' }); const day = G.dayWindow(g, at(2, 9)).dayKey;
  assert.strictEqual(G.breakBank(g, null, at(2, 9, 10)).balance, 0);
  assert.strictEqual(G.breakBank(g, null, at(2, 9, 55)).balance, 10);
  assert.strictEqual(G.breakBank(g, null, at(2, 12)).balance, 20); // used later, both sessions
  assert(/10m break ready/.test(G.rowText(G.phaseAt(g, at(2, 9, 55)), { earned: 0, goal: 130, bank: 10 })));
  const prior = { locked: true, until: at(2, 17), label: 'ClingNote lock-in' };
  const b = G.takeBreak(g, null, at(2, 9, 55), prior); assert.strictEqual(b.used, 10); assert.strictEqual(b.endMs, at(2, 10, 5)); assert.deepStrictEqual(b.prior, prior);
  assert.strictEqual(G.phaseAt(g, at(2, 10, 0), b).phase, 'break'); assert(/Break · 5:00 left/.test(G.rowText(G.phaseAt(g, at(2, 10, 0), b), {})));
  assert.strictEqual(G.breakBank(g, b, at(2, 10, 0)).balance, 0);
  assert.strictEqual(G.takeBreak(g, b, at(2, 10, 6)), null); // no stacking: used it up
  assert.strictEqual(G.relockPlan(b, at(2, 10, 0)), null);
  assert.deepStrictEqual(G.relockPlan(b, at(2, 10, 5)), { untilMs: at(2, 17), label: 'ClingNote lock-in' });
  assert.strictEqual(G.relockPlan({ ...b, relocked: true }, at(2, 11)), null);
  assert.deepStrictEqual(G.relockPlan({ ...b, prior: { locked: false } }, at(2, 11)), { untilMs: 0, label: '' });
  const late = G.takeBreak(g, null, at(2, 16, 55)); assert.strictEqual(late.endMs, at(2, 17)); assert.strictEqual(late.used, 5); // close caps it
  assert.strictEqual(G.takeBreak(g, null, at(2, 17, 1)), null);
  assert.strictEqual(G.normBreak({ ...b, day: 'old' }, day).used, 0);
});
t('2 notifications inside focus are held to the session end (gp/timer pass)', () => {
  G.setQuietWindows([[at(2, 9), at(2, 9, 50)]]); assert.strictEqual(G.quietDefer(at(2, 9, 20)), at(2, 9, 50)); assert.strictEqual(G.quietDefer(at(2, 9, 55)), at(2, 9, 55)); G.setQuietWindows([]);
  const ln = src('src/utils/localNotify.js'); assert(/holdForFocus/.test(ln) && /'gp'/.test(ln) && /'timer'/.test(ln));
});
t('3 breaks never cost points (earned only from completed tasks)', () => {
  const e = G.earnedPoints([{ title: 'a', size: 'm', completed: true, completedAt: at(2, 9, 55) }], { closeMs: at(2, 17) }); assert.strictEqual(e.points, 20);
});
t('4+8 hard close 8 h after the day start, nothing earned after it, shift crossing midnight', () => {
  const g = G.normPlan({ dayStart: '09:00' }); const w = G.dayWindow(g, at(2, 12)); assert.strictEqual(w.closeMs, at(2, 17));
  assert.strictEqual(G.phaseAt(g, at(2, 17)).phase, 'closed');
  const tasks = [{ size: 's', completed: true, completedAt: at(2, 16, 59) }, { size: 'l', completed: true, completedAt: at(2, 17, 0) }];
  const e = G.earnedPoints(tasks, { closeMs: w.closeMs }); assert.strictEqual(e.points, 10); assert.strictEqual(e.afterClose, 40);
  const n = G.normPlan({ dayStart: '20:00' }); const w2 = G.dayWindow(n, at(3, 2)); assert.strictEqual(w2.startMs, at(2, 20)); assert.strictEqual(w2.closeMs, at(3, 4)); assert.strictEqual(w2.dayKey, '2026-11-02');
  assert.strictEqual(G.phaseAt(n, at(3, 5)).phase, 'closed'); assert.strictEqual(G.phaseAt(n, at(2, 20, 30)).phase, 'focus');
  assert.strictEqual(G.addHours('20:00', 8), '04:00');
});
t('5 sizes S10 M20 L40; user size wins over the estimate; size mode is Coach-only', () => {
  assert.deepStrictEqual(G.SIZE_POINTS, { s: 10, m: 20, l: 40 });
  assert.strictEqual(G.sizeFromMinutes(15), 's'); assert.strictEqual(G.sizeFromMinutes(25), 's'); assert.strictEqual(G.sizeFromMinutes(45), 'm'); assert.strictEqual(G.sizeFromMinutes(90), 'l'); assert.strictEqual(G.sizeFromMinutes(0), 'm');
  assert.strictEqual(G.sizeOf({ estimateMin: 120, size: 's' }), 's'); assert.strictEqual(G.sizePoints({ estimateMin: 120 }), 40);
  assert.strictEqual(G.earnedPoints([{ size: 'l' }]).points, 0, 'not completed -> 0');
  G.setSizeMode(false); assert.strictEqual(G.sizeModeOn(), false); G.setSizeMode(true); assert(G.sizeModeOn()); G.setSizeMode(false);
  const te = src('src/utils/taskEstimate.js'); assert(/sizeModeOn\(\) \? sizePoints/.test(te));
});
t('5 daily goal = max(min, min(round5(90% median 14d), planned load)); new users 80% of load', () => {
  assert.deepStrictEqual(G.dailyGoal({ history: [], load: 160, min: 50 }).goal, 130);
  assert.strictEqual(G.dailyGoal({ history: [], load: 20, min: 50 }).goal, 50);
  assert.strictEqual(G.dailyGoal({ history: [100, 120, 140], load: 300, min: 50 }).goal, 110); // 0.9 x 120 = 108 -> 110
  assert.strictEqual(G.dailyGoal({ history: [100, 120, 140], load: 80, min: 50 }).goal, 80); // capped by today's load
  assert.strictEqual(G.dailyGoal({ history: [10, 10, 10], load: 80, min: 50 }).goal, 50); // floor
  const log = {}; for (let i = 1; i <= 20; i++) log[`2026-10-${String(i).padStart(2, '0')}`] = { earned: i }; log['2026-10-21'] = { earned: 999 };
  const h = G.historyFrom(log, '2026-10-21'); assert.strictEqual(h.length, 14); assert.strictEqual(h[0], 7); assert(!h.includes(999));
});
t('5 midday pacing checkpoint at the half-way point', () => {
  const w = G.dayWindow(G.normPlan({ dayStart: '09:00' }), at(2, 10)); assert.strictEqual(G.checkpointAt(w), at(2, 13));
  assert(G.pacingNote({ earned: 70, goal: 130 }).ahead); assert(!G.pacingNote({ earned: 20, goal: 130 }).ahead); assert(/goal already hit/.test(G.pacingNote({ earned: 140, goal: 130 }).title));
});
t('6 checklist gate, revoke detection + penalty once a day, friction countdown', () => {
  assert(!G.checklistDone([{ done: true }, { done: false }])); assert(G.checklistDone([{ done: true }])); assert(G.checklistDone([]));
  assert.deepStrictEqual(G.authCheck({ prev: 'approved', now: 'denied', day: 'd1' }), { revoked: true, penalty: 25 });
  assert.strictEqual(G.authCheck({ prev: 'approved', now: 'denied', day: 'd1', bookedDay: 'd1' }).penalty, 0);
  assert.strictEqual(G.authCheck({ prev: 'approved', now: 'approved', day: 'd1' }).penalty, 0); assert.strictEqual(G.authCheck({ prev: '', now: 'denied', day: 'd1' }).penalty, 0);
  assert.strictEqual(G.authCheck({ prev: 'approved', now: 'unsupported', day: 'd1' }).penalty, 0);
  assert.strictEqual(G.countdown(0, 0), 8); assert.strictEqual(G.countdown(0, 7500), 1); assert.strictEqual(G.countdown(0, 9000), 0); assert(G.FRICTION_SEC >= 5 && G.FRICTION_SEC <= 10);
});
t('7 close picker: nothing automatic; picked copies dedupe by title, reset completion', () => {
  const today = [{ title: 'A', createdAt: 'c1' }, { title: 'B', completed: true }, { title: 'C', status: 'wontdo' }, { title: 'D', templateId: 'x' }, { title: 'E', createdAt: 'c5', completedAt: 5, timerActive: true }];
  assert.deepStrictEqual(G.leftovers(today).map((x) => x.title), ['A', 'E']);
  const out = G.carryOver([today[0], today[4]], [{ title: 'a' }], 77);
  assert.deepStrictEqual(out.map((x) => x.title), ['a', 'E']); assert.strictEqual(out[1].completedAt, null); assert.strictEqual(out[1].timerActive, false); assert.strictEqual(out[1].carriedFrom, 'c5'); assert(/^gp-carry-77/.test(out[1].createdAt));
  assert.strictEqual(G.nextDayName('2026-11-07'), 'Sun');
});
t('wiring: earned break (take-break action, shield lift, relock on expiry/launch, native re-shield, earned note)', () => {
  const h = src('src/views/HomeView.vue'); const r = src('src/components/home/GamePlanRow.vue');
  assert(/@take-break="gpTakeBreak"/.test(h) && /data-test="gp-take-break"/.test(r) && /data-test="gp-ready"/.test(r));
  assert(/GP\.breakActive\(gpBreak\.value, Date\.now\(\)\)\) r = \{ \.\.\.r, want: false, phase: 'break' \}/.test(h));
  assert(/st = await gpBreakRelock\(st\)/.test(h) && /clingLock\.scheduleLock\(\{ startMs: b\.endMs, untilMs: prior\.until/.test(h));
  assert(/at: new Date\(s\.endMs\)/.test(h) && !/s\.kind === 'break'/.test(h));
  assert(/claimedAt: sd\.claimedAt/.test(h) && /@claim-screen="claimScreenTime"/.test(h));
});
t('row text per phase', () => {
  const g = G.normPlan({ dayStart: '09:00' });
  assert(/Focus 1\/2/.test(G.rowText(G.phaseAt(g, at(2, 9, 5)), { earned: 0, goal: 130 })));
  assert(/Break/.test(G.rowText(G.phaseAt(g, at(2, 9, 56), { day: 'x', startMs: at(2, 9, 55), endMs: at(2, 10, 5) }), {}))); assert(/Closed/.test(G.rowText(G.phaseAt(g, at(2, 18)), {})));
});
t('wiring: Home row, Coach-only, earned/close, gate, carry, review, ask; Profile row; TaskCard chips; report', () => {
  const h = src('src/views/HomeView.vue'); assert(/<GamePlanRow v-if="gpOn && isViewingToday"/.test(h)); assert(/const gpOn = computed\(\(\) => isStrictMode\.value\)/.test(h));
  assert(/GP\.setSizeMode\(on\)/.test(h)); assert(/gpEarned\.value\.points/.test(h)); assert(/phase: 'checklist'/.test(h)); assert(/gpAuthCheck\(st\)/.test(h)); assert(/isShutdown\(\) \|\| gpOn\.value/.test(h));
  assert(/fnUrl\('friend-unlock'\)/.test(h)); assert(/GP\.countdown/.test(h)); assert(/!gpQuiet/.test(h));
  const p = src('src/views/Profile.vue'); assert(/data-test="gp-settings"/.test(p)); assert(/GP\.queueEdit/.test(p));
  const c = src('src/components/home/TaskCard.vue'); assert(/data-test="size-edit"/.test(c));
  assert.equal(G.sizeOf({ points: 20 }), 'm'); assert.equal(G.sizeOf({ points: 10 }), 's'); assert.equal(G.sizeOf({ points: 60 }), 'l'); assert.equal(G.sizeOf({ points: 60, estimateMin: 10 }), 's'); assert.equal(G.sizeOf({ size: 'l', points: 10 }), 'l');
  const m = src('src/components/home/MorningReport.vue'); assert(/mr-penalty/.test(m) && /mr-goal-why/.test(m));
  const sw = src('ios/App/App/ClingLockPlugin.swift'); assert(/everApproved/.test(sw)); const sh = src('ios/App/ClingShieldConfig/ClingShieldConfig.swift'); assert(/clingShieldFriend/.test(sh) && /Ask your friend/.test(sh) && /Open ClingNote to see your plan/.test(sh), 'shield friend line follows the toggle'); assert(/setShieldFriend/.test(sw) && /clingShieldFriend/.test(sw));
});
console.log(`\ngameplan: ${n} ok`);
