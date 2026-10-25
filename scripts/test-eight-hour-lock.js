// Lock tests for the 8-hour day: client lock module, data-layer guards, UI guard presence, Firestore rules (static; there is no emulator on the box).
// Run: node scripts/test-eight-hour-lock.js
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const sr = require('./lib/srcRequire');
const root = path.join(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = async (name, fn) => { await fn(); n++; };

// firebase stubs for the data layer
const calls = []; const docs = {};
sr.stubs['firebase/firestore'] = {
  doc: (db, col, id) => ({ path: `${col}/${id}` }), serverTimestamp: () => 'TS',
  getDoc: async (r) => ({ exists: () => !!docs[r.path], data: () => docs[r.path] }),
  setDoc: async (r, d) => { calls.push(['set', r.path, d]); docs[r.path] = { ...(docs[r.path] || {}), ...d }; },
  updateDoc: async (r, d) => { calls.push(['update', r.path, d]); docs[r.path] = { ...(docs[r.path] || {}), ...d }; },
};
sr.stubs['@/firebaseConfig'] = { db: {} };
const lockMod = sr.load('utils/eightHourLock.js');
const persist = sr.load('composables/useDayPersistence.js');
const sched = sr.load('composables/useScheduledTasks.js');
const core = require('../netlify/functions/lib/eightHourCore.js');

const T = (title, extra = {}) => ({ title, createdAt: `2026-10-23T0${title.length}:00:00Z`, points: 30, complexity: 2, estimateMin: 30, type: 'one-time', completed: false, ...extra });
const start = Date.parse('2026-10-23T11:00:00Z'); const end = start + core.WINDOW_MS;
let clock = start + 60000;
lockMod.setLockSource(() => ({ lock: { dayName: 'Fri', startMs: start, endMs: end }, nowMs: clock }));

(async () => {
  // ── client lock module ──
  await t('locked only for the locked weekday and only inside the window', () => {
    assert.ok(lockMod.isDayLocked('Fri')); assert.ok(!lockMod.isDayLocked('Sat'));
    clock = end; assert.ok(!lockMod.isDayLocked('Fri'), 'unlocks exactly at the end'); clock = start - 1; assert.ok(!lockMod.isDayLocked('Fri'), 'not before the start'); clock = start + 60000;
  });
  await t('no lock source => nothing locked', () => { lockMod.setLockSource(null); assert.ok(!lockMod.isDayLocked('Fri')); lockMod.setLockSource(() => ({ lock: { dayName: 'Fri', startMs: start, endMs: end }, nowMs: clock })); });
  await t('assertDayUnlocked throws LockError', () => { assert.throws(() => lockMod.assertDayUnlocked('Fri', 'x'), (e) => lockMod.isLockError(e) && /Locked/.test(e.message)); lockMod.assertDayUnlocked('Sat'); });
  await t('whole-array writes: reorder, delete, add, swap and retitle are refused; identical or completion-only passes', () => {
    const a = [T('Alpha'), T('Beta'), T('Gamma')];
    assert.throws(() => lockMod.assertTasksChangeAllowed('Fri', a, [a[1], a[0], a[2]]), lockMod.isLockError, 'reorder');
    assert.throws(() => lockMod.assertTasksChangeAllowed('Fri', a, a.slice(0, 2)), lockMod.isLockError, 'delete');
    lockMod.assertTasksChangeAllowed('Fri', a, [...a, T('Delta')]); // add (append) allowed while locked
    lockMod.assertTasksChangeAllowed('Fri', a, [{ ...a[0], title: 'Alpha edited', estimateMin: 5 }, a[1], a[2]]); // edit allowed while locked
    assert.throws(() => lockMod.assertTasksChangeAllowed('Fri', a, [a[0], T('Other'), a[2]]), lockMod.isLockError, 'swap');
    assert.throws(() => lockMod.assertTasksChangeAllowed('Fri', a, [{ ...a[0], points: 99 }, a[1], a[2]]), lockMod.isLockError, 'points');
    lockMod.assertTasksChangeAllowed('Fri', a, [{ ...a[0], completed: true, notes: 'x', timerActive: true }, a[1], a[2]]);
    lockMod.assertTasksChangeAllowed('Sat', a, a.slice(0, 1)); // other day: free
  });
  await t('patches: locked fields refused, completion/notes/timer/boss/subtasks allowed', () => {
    for (const k of ['createdAt', 'points']) assert.throws(() => lockMod.assertPatchAllowed('Fri', { [k]: 1 }), lockMod.isLockError, k);
    lockMod.assertPatchAllowed('Fri', { title: 'edit ok', estimateMin: 5, completed: true, notes: 'n', boss: true, status: 'done', timerActive: true, subtasks: [] });
    lockMod.assertPatchAllowed('Sat', { title: 'free' });
  });

  // ── data layer ──
  await t('patchStoredTask refuses locked fields before any read/write', async () => {
    calls.length = 0; docs['weeklyRoutines/u_Fri'] = { tasks: [T('Alpha')] };
    assert.throws(() => persist.patchStoredTask('u', 'Fri', T('Alpha'), 0, { points: 5 }), lockMod.isLockError);
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(await persist.patchStoredTask('u', 'Fri', T('Alpha'), 0, { completed: true }), true);
    assert.strictEqual(docs['weeklyRoutines/u_Fri'].tasks[0].completed, true);
    assert.strictEqual(docs['weeklyRoutines/u_Fri'].tasks[0].estimateMin, 30);
  });
  await t('carryTasksToDay: copy-only from a locked day; refused into a locked day', async () => {
    calls.length = 0; docs['weeklyRoutines/u_Fri'] = { tasks: [T('Alpha'), T('Beta')] }; delete docs['weeklyRoutines/u_Sat'];
    const made = await persist.carryTasksToDay('u', 'Fri', 'Sat', [T('Alpha')], '2026-10-23');
    assert.strictEqual(made, 1); assert.strictEqual(docs['weeklyRoutines/u_Fri'].tasks.length, 2, 'locked day keeps every task');
    assert.ok(!calls.some((c) => c[1] === 'weeklyRoutines/u_Fri'), 'no write to the locked day');
    await assert.rejects(() => persist.carryTasksToDay('u', 'Sat', 'Fri', [T('Zed')], 'x'), lockMod.isLockError);
    // unlocked: one-time task is moved out as before
    clock = end + 1000; docs['weeklyRoutines/u_Fri'] = { tasks: [T('Alpha'), T('Beta')] };
    await persist.carryTasksToDay('u', 'Fri', 'Sun', [T('Alpha')], '2026-10-24'); assert.strictEqual(docs['weeklyRoutines/u_Fri'].tasks.length, 1); clock = start + 60000;
  });
  await t('materializeDueForToday does not write into the locked day', async () => {
    calls.length = 0; const r = await sched.materializeDueForToday('u', 'Fri', '2026-10-23');
    assert.strictEqual(r.added, 0); assert.ok(!calls.some((c) => /weeklyRoutines/.test(c[1])));
  });

  // ── UI: guards present in HomeView ──
  const home = read('src/views/HomeView.vue');
  const body = (name) => { const i = home.search(new RegExp(`const ${name} = async`)); assert.ok(i >= 0, name); const j = home.indexOf('\nconst ', i + 10); return home.slice(i, j); };
  await t('every list-changing HomeView action checks the lock', () => {
    for (const fn of ['deleteTask', 'markTaskAsWontDo', 'undoWontDo', 'handleDragEnd', 'scheduleExistingTask']) assert.ok(/blockIfLocked\(/.test(body(fn)), fn);
    assert.ok(/blockIfLocked\(currentDayIndex\)\s*\|\|\s*blockIfLocked\(targetDayIndex\)/.test(body('transferTask')), 'transfer checks both days');
    assert.ok(/isDayLocked\(d\.day\)/.test(body('setTaskRepeat')), 'repeat edits touch every weekday');
    assert.ok(!/blockIfLocked\(/.test(body('updateTask')), 'edits allowed while locked');
    assert.ok(/isDayLocked\(dayName\) \? l\.length/.test(home) || /isDayLocked\(dayName\)/.test(body('addNewTask')), 'adds allowed on the locked day, appended only');
    assert.ok(/assertTasksChangeAllowed/.test(body('saveSelectedDayTasks')), 'whole-array saves are checked');
    assert.ok(/isDayLocked\(days\[dayIndex\]/.test(body('resetTasksToIncomplete')), 'past-day reset skips the locked day');
    assert.ok(/!selectedDayLocked\.value/.test(home.match(/const reorderable = .*/)[0]), 'drag/reorder disabled');
    const tog = body('toggleTaskCompletion'); assert.ok(/lockedToggle/.test(tog) && /reportProgress/.test(tog), 'completion keeps working in place and reports progress');
    assert.ok(/isLockError/.test(body('patchTask').replace(/^/, '') || home.slice(home.indexOf('const patchTask'), home.indexOf('const patchTask') + 900)), 'patchTask reports lock errors');
  });
  await t('boss + shutdown paths are not blocked by the lock', () => {
    assert.ok(!/blockIfLocked|isDayLocked/.test(body('setBoss')), 'boss still allowed (not a locked field)');
    assert.ok(/carryTasksToDay/.test(home), 'shutdown carry still used (copy-only while locked)');
  });
  const card = read('src/components/home/EightHourCard.vue');
  await t('card exposes no edit controls while running', () => {
    const running = card.slice(card.indexOf('<!-- running'), card.indexOf('<!-- ended'));
    assert.ok(!/<input|<button|@click|v-model/.test(running), 'running view is read-only');
  });

  // ── Firestore rules (static) ──
  const rules = read('firestore.rules');
  await t('rules: weeklyRoutines create/delete refused and updates constrained while locked', () => {
    const m = rules.match(/match \/weeklyRoutines\/\{routineId\}\s*\{[\s\S]*?\n    \}/); assert.ok(m, 'weeklyRoutines block');
    const b = m[0];
    assert.ok(/allow create:[^;]*!eightHourLocked\(/.test(b)); assert.ok(/allow delete:[^;]*!eightHourLocked\(/.test(b));
    assert.ok(/allow update:[^;]*eightHourLocked\([^;]*lockedDayUnchanged\(\)/.test(b));
  });
  await t('rules: lock helper checks day name and request.time against the server window', () => {
    const f = rules.match(/function eightHourLocked[\s\S]*?\n  \}/)[0];
    assert.ok(/exists\(/.test(f) && /dayName/.test(f) && /startAt/.test(f) && /endAt/.test(f) && /request\.time/.test(f));
  });
  await t('rules: every locked field is compared, all 10 slots plus the size', () => {
    const same = rules.match(/function lockedTaskSame[\s\S]*?\n  \}/)[0];
    for (const f of core.LOCKED_FIELDS) assert.ok(new RegExp(`get\\('${f}'`).test(same), `field ${f} compared`);
    const day = rules.match(/function lockedDayUnchanged[\s\S]*?\n  \}/)[0];
    assert.ok(/size\(\)/.test(day)); for (let i = 0; i < core.LOCK_IDENTITY_SLOTS; i++) assert.ok(day.includes(`lockedSlotSame(o, n, ${i})`), `slot ${i}`);
    assert.ok(core.MAX_TASKS_PER_DAY <= core.LOCK_IDENTITY_SLOTS, 'slots cover the task cap');
  });
  await t('rules: eightHour doc and history are owner-read, never client-written', () => {
    const m = rules.match(/match \/eightHour\/\{uid\}\s*\{[\s\S]*?\n    \}/)[0];
    assert.ok(/allow read: if isOwner\(uid\)/.test(m)); assert.ok(/allow write: if false/.test(m));
    assert.ok(/match \/history\/\{dayKey\}[\s\S]*allow write: if false/.test(m));
  });
  await t('no client code writes the eightHour collection', () => {
    const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|vue)$/.test(e.name)) files.push(p); } })(path.join(root, 'src'));
    for (const f of files) assert.ok(!/(setDoc|updateDoc|deleteDoc|addDoc)\(\s*doc\([^)]*['"`]eightHour/.test(fs.readFileSync(f, 'utf8')), f);
  });
  await t('server function: the lock is written only by the function (admin SDK)', () => {
    const fn = read('netlify/functions/eight-hour-day.js'); assert.ok(/eightHour\/\$\{/.test(fn) && /409|423/.test(fn));
  });
  console.log(`eight-hour lock: ${n} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
