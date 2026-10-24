// Strict 8-hour day: estimates/chips, hard stop (shutUntil + guards + rules), rewards/consequences, pressure UI state, pill/overlay wiring.
// Run: node scripts/test-strict-day.js  (no network, no real notifications)
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const root = path.join(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const core = require('../netlify/functions/lib/eightHourCore.js');
sr.stubs['firebase/firestore'] = { doc: () => ({}), serverTimestamp: () => 'TS', getDoc: async () => ({ exists: () => false }), setDoc: async () => {}, updateDoc: async () => {} };
sr.stubs['@/firebaseConfig'] = { db: {} };
const lockMod = sr.load('utils/eightHourLock.js');
const est = sr.load('utils/taskEstimate.js');
const pr = sr.load('utils/pressure.js');
const chrome = sr.load('utils/eightHourChrome.js');

t('estimates: computed on create, typed estimateMin never overwritten, stored values win for chips', () => {
  const e = est.estimateFor({ title: 'ZZTEST write report', notes: 'draft and review', priority: 'high' });
  assert(Number.isFinite(e.minutes) && e.minutes > 0 && Number.isFinite(e.points) && e.points > 0 && e.complexity);
  assert(!('estimateMin' in e), 'estimateFor must not set the user-typed estimateMin');
  const typed = est.withEstimate({ title: 'ZZTEST x', estimateMin: 45 }); assert.strictEqual(typed.estimateMin, 45);
  assert.strictEqual(est.chipValues({ title: 'a', estimateMin: 45, minutes: 10, points: 7 }).minutes, 45);
  assert.strictEqual(est.chipValues({ title: 'a', minutes: 10, points: 7 }).points, 7);
  const back = est.chipValues({ title: 'ZZTEST legacy task' }); assert(back.minutes > 0 && back.points > 0, 'display-only backfill');
  assert.strictEqual(est.fmtMin(90), '1h 30m'); assert.strictEqual(est.fmtMin(25), '25m');
});

const tz = 'America/New_York'; const dayKey = '2026-10-23';
const start = core.wakeInstant(dayKey, core.parseWake('07:00'), tz); const end = start + core.WINDOW_MS;
const lock = { dayKey, dayName: 'Fri', startMs: start, endMs: end, wakeTime: '07:00', tz, earned: 40, target: 60 };
t('shutUntil = next wake time; shut only after a started day ends; survives midnight', () => {
  const until = core.shutUntilMs(lock);
  assert.strictEqual(until, core.wakeInstant('2026-10-24', core.parseWake('07:00'), tz));
  assert(!core.isShut(lock, end - 1)); assert(core.isShut(lock, end)); assert(core.isShut(lock, end + 6 * 3600000), 'still shut after midnight');
  assert(!core.isShut(lock, until)); assert(!core.isShut(null, end)); assert.strictEqual(core.nextDayKey('2026-12-31'), '2027-01-01');
});
t('guards: every task mutation refused while shut (add/edit/complete/timers), allowed again at wake', () => {
  let now = end + 1000; lockMod.setLockSource(() => ({ lock, nowMs: now }));
  assert(lockMod.isShutdown());
  assert.throws(() => lockMod.assertNotShut(), lockMod.isLockError);
  assert.throws(() => lockMod.assertDayUnlocked('Sat', 'add'), lockMod.isLockError, 'any day, not only the locked one');
  assert.throws(() => lockMod.assertPatchAllowed('Fri', { completed: true }), lockMod.isLockError, 'completion blocked');
  assert.throws(() => lockMod.assertPatchAllowed('Sat', { timerStart: 1 }), lockMod.isLockError, 'timers blocked');
  assert.throws(() => lockMod.assertTasksChangeAllowed('Fri', [], [{ title: 'x' }]), lockMod.isLockError);
  now = core.shutUntilMs(lock); assert(!lockMod.isShutdown()); lockMod.assertPatchAllowed('Sat', { completed: true });
  lockMod.setLockSource(null); assert(!lockMod.isShutdown(), 'users who never started a day are never shut');
});
t('HomeView/useScheduledTasks/useEightHour wiring for the hard stop', () => {
  const h = read('src/views/HomeView.vue'); const c = (h.match(/if \(blockIfShut\(\)\) return/g) || []).length; assert(c >= 10, 'blockIfShut in task actions: ' + c);
  assert(/assertNotShut\(\)/.test(read('src/composables/useScheduledTasks.js')));
  const u = read('src/composables/useEightHour.js'); assert(/LAST_LOCK_KEY/.test(u) && /shutdown/.test(u), 'cached lock keeps the stop across reloads');
  const fn = read('netlify/functions/eight-hour-day.js'); assert(/shutUntil: ctx\.ts\(core\.shutUntilMs/.test(fn) && /core\.isShut\(/.test(fn));
});
t('rules: shut day blocks weeklyRoutines writes (server time)', () => {
  const r = read('firestore.rules'); assert(/function eightHourShut\(uid\)/.test(r));
  assert(((r.match(/!eightHourShut\(/g) || []).length) >= 3);
});

t('settleDay: met => xp/coins/shield/badge; missed => coin penalty, shield saves streak at >=50%, warning after 3', () => {
  let s = core.settleDay({ streak: 2, coins: 0 }, { dayKey: 'd1', earned: 60, target: 60, allDone: true });
  assert.strictEqual(s.lastResult, 'met'); assert(s.xp > 0 && s.coins > 0); assert.strictEqual(s.shields, 1); assert.strictEqual(s.streak, 3); assert.strictEqual(s.badges[0], 'streak-3');
  assert.deepStrictEqual(core.settleDay(s, { dayKey: 'd1', earned: 0, target: 60 }), s, 'idempotent');
  const coins = s.coins;
  s = core.settleDay(s, { dayKey: 'd2', earned: 35, target: 60 });
  assert.strictEqual(s.lastPenalty.shieldUsed, true); assert.strictEqual(s.streak, 3); assert.strictEqual(s.shields, 0); assert(s.coins < coins);
  s = core.settleDay(s, { dayKey: 'd3', earned: 10, target: 60 }); assert.strictEqual(s.streak, 0); assert.strictEqual(s.lastPenalty.streakLost, true);
  s = core.settleDay(s, { dayKey: 'd4', earned: 0, target: 60 }); assert(s.warning, 'boss warning after 3 misses'); assert(s.coins >= 0, 'never negative');
  s = core.settleDay(s, { dayKey: 'd5', earned: 99, target: 60 }); assert.strictEqual(s.warning, ''); assert.strictEqual(s.missRun, 0);
  assert(s.log.length <= 14); assert.strictEqual(core.penaltyForMiss(10, 3), 3);
});

t('pressure: one alert, priority risk > behind > boss; nothing offline', () => {
  const base = { running: true, earned: 0, target: 100, startMs: 0, endMs: 8 * 3600000, streak: 4, warning: 'Boss: recover' };
  assert.strictEqual(pr.topAlert({ ...base, nowMs: 7 * 3600000 }).level, 'risk');
  assert.strictEqual(pr.topAlert({ ...base, nowMs: 4 * 3600000 }).level, 'behind');
  assert(/Behind pace by 50/.test(pr.topAlert({ ...base, nowMs: 4 * 3600000 }).text));
  assert.strictEqual(pr.topAlert({ ...base, earned: 60, nowMs: 4 * 3600000 }).level, 'boss');
  assert.strictEqual(pr.topAlert({ ...base, nowMs: 7 * 3600000, offline: true }), null);
  const p = pr.paceOf({ earned: 25, target: 100, startMs: 0, endMs: 100, nowMs: 50 }); assert.deepStrictEqual([p.expected, p.behindBy, p.timePct, p.pointsPct], [50, 25, 50, 25]);
});
t('celebrations: manager award first (voice line), then day result, each once', () => {
  const stats = { lastDay: 'd1', lastResult: 'met', streak: 3, lastReward: { xp: 20, coins: 8, shield: true, badge: 'streak-3' }, awards: [{ at: 111, bonus: 25, badge: 'mvp', note: 'nice', from: 'Sam' }] };
  const a = pr.pendingCelebration(stats, {}); assert.strictEqual(a.key, 'award'); assert.strictEqual(a.voice, 'Your manager sent you a bonus'); assert(a.lines.some((l) => /MVP/.test(l)));
  const d = pr.pendingCelebration(stats, { award: '111' }); assert.strictEqual(d.key, 'day'); assert(d.lines.some((l) => /Streak shield/.test(l)));
  assert.strictEqual(pr.pendingCelebration(stats, { award: '111', day: 'd1' }), null);
});
t('pill state: countdown + target running, "Starts X" before, hidden with no plan, Shut after', () => {
  assert.deepStrictEqual(chrome.pillState({ running: true, countdown: '03:00:00', earned: 10, target: 60, hasPlan: true }).sub, '10/60');
  assert.strictEqual(chrome.pillState({ phase: 'before', startsLabel: '7:00 AM', hasPlan: true }).main, 'Starts 7:00 AM');
  assert.strictEqual(chrome.pillState({ phase: 'before', hasPlan: false }), null);
  assert.strictEqual(chrome.pillState({ shut: true, untilLabel: '7:00 AM' }).kind, 'shut');
  for (const r of ['home', 'upcoming', 'rankings', 'discipline', 'pals', 'addiction', 'manager-home', 'manager-person']) assert(chrome.PILL_ROUTES.includes(r), r);
  for (const r of ['Login', 'onboarding', 'welcome', 'paywall', 'subs', 'Profile', 'support']) { assert(!chrome.PILL_ROUTES.includes(r)); assert(!chrome.SHUT_ROUTES.includes(r)); }
  assert(!chrome.SHUT_ROUTES.includes('manager-person'), 'managers keep their read-only team view');
});
t('App/Card/Manager wiring', () => {
  assert(/<EightHourChrome \/>/.test(read('src/App.vue')));
  const ch = read('src/components/eighthour/EightHourChrome.vue'); assert(/eh-shutdown/.test(ch) && /Come back tomorrow at/.test(ch) && /signOut/.test(ch) && /safe-area-inset-top/.test(ch));
  const card = read('src/components/home/EightHourCard.vue'); assert(/eh-drain/.test(card) && /eh-history/.test(card) && /v-if="alert"/.test(card));
  const mv = read('src/views/ManagerView.vue'); assert(/managerAward/.test(mv) && /award\.eligible/.test(mv));
  assert(/data-test="est-chips"/.test(read('src/components/home/TaskCard.vue')));
});
console.log(`${n} strict-day tests passed`);
