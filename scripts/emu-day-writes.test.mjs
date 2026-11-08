// Firestore emulator only. Two rule texts:
//   REPO  = firestore.rules as checked in (owner update is open; lockedDayUnchanged is defined but not used on update).
//   FIXTURE = that file with the weeklyRoutines update line replaced so a frozen/running day must pass lockedDayUnchanged.
// The fixture is NOT a copy of deployed rules and is not published.
// Run: node scripts/emu-day-writes.test.mjs   (emulator must already be on 127.0.0.1:8089)
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, updateDoc, serverTimestamp, disableNetwork, enableNetwork } from 'firebase/firestore';
import { identityCommit, patchTimerOnList } from '../src/utils/dayList.js';
import { atomicMove } from '../src/utils/transfer.js';
import { dropUndefined } from '../src/utils/firestoreSafe.js';

const PORT = 8089;
const repoRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const OPEN = "allow update: if isAuthenticated() && request.auth.uid == routineId.split('_')[0];";
if (!repoRules.includes(OPEN)) throw new Error('repo weeklyRoutines update line changed; fixture replace would miss');
const fixtureRules = repoRules.replace(OPEN, `allow update: if isAuthenticated() && request.auth.uid == routineId.split('_')[0]
        && (!dayFrozen(eightHourLock(routineId.split('_')[0]), routineId.split('_')[1]) || lockedDayUnchanged()); // FIXTURE ONLY, not live`);

const task = (i) => ({ id: 't' + i, title: 'Task ' + i, createdAt: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:${String(i % 60).padStart(2, '0')}:00.000Z`, points: 10 + i, completed: false, type: 'one-time' });
let fail = 0;
const check = async (name, fn) => {
  try { await fn(); console.log('PASS |', name); }
  catch (e) { fail++; console.log('FAIL |', name, '-', e && (e.message || e.code || e)); }
};
const denied = async (fn) => {
  try { await fn(); throw new Error('expected a denial, write succeeded'); }
  catch (e) {
    if (String(e && e.message || '') === 'expected a denial, write succeeded') throw e;
    const code = String(e && e.code || '');
    const msg = String(e && e.message || '');
    if (/evaluation error/i.test(msg)) console.log('    rules threw (evaluation error); write was not applied');
    if (code !== 'permission-denied') throw new Error('code ' + code + ' ' + msg.slice(0, 120));
    return code;
  }
};

async function suite(label, env) {
  console.log('\n==', label, '==');
  const U = 'ZZTESTdayW1';
  const db = env.authenticatedContext(U).firestore();
  const admin = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));
  const now = Date.now();
  const running = { dayName: 'Sat', startAt: new Date(now - 3600e3), endAt: new Date(now + 3600e3) };
  const dayRef = (f, day) => doc(f, 'weeklyRoutines', `${U}_${day}`);
  const seed = (day, tasks) => admin(async (f) => {
    await f.doc ? null : null;
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(f, 'weeklyRoutines', `${U}_${day}`), { tasks });
    await setDoc(doc(f, 'eightHour', U), { lock: running });
  });
  // withSecurityRulesDisabled context firestore uses the same modular API via the returned Firestore.
  const seedDocs = (day, tasks) => env.withSecurityRulesDisabled(async (c) => {
    const f = c.firestore();
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(f, 'weeklyRoutines', `${U}_${day}`), { tasks });
    await setDoc(doc(f, 'eightHour', U), { lock: { ...running, dayName: day } });
  });

  for (const n of [1, 12, 50]) {
    const tasks = Array.from({ length: n }, (_, i) => task(i));
    const fresh = () => seedDocs('Sat', tasks.map((t) => ({ ...t })));
    await check(`${label} ${n}: append keeps slot 0 identity`, async () => {
      await fresh();
      const ref = doc(db, 'weeklyRoutines', `${U}_Sat`);
      const live = (await getDoc(ref)).data().tasks;
      const copy = { id: 'new', title: 'Check email', createdAt: '2026-11-08T12:00:00.000Z', points: 8, completed: false, type: 'one-time' };
      const next = identityCommit(live, [...live, copy]);
      await updateDoc(ref, { tasks: dropUndefined(next), updatedAt: serverTimestamp() });
      const saved = (await getDoc(ref)).data().tasks;
      if (saved[0].createdAt !== tasks[0].createdAt || saved[0].points !== tasks[0].points) throw new Error('slot 0 identity changed');
      if (saved.length !== n + 1 || saved[n].title !== 'Check email') throw new Error('append missing');
    });
    await check(`${label} ${n}: timer patch keeps createdAt and points`, async () => {
      await fresh();
      const ref = doc(db, 'weeklyRoutines', `${U}_Sat`);
      const live = (await getDoc(ref)).data().tasks;
      const next = patchTimerOnList(live, (t) => t.id === 't0', { timerActive: true, timerStartedAt: 's', timerEndTime: 'e', timerDurationMinutes: 20, timerPausedAt: null, focusLock: false, timerPomo: null });
      const stored = identityCommit(live, next);
      await updateDoc(ref, { tasks: dropUndefined(stored), updatedAt: serverTimestamp() });
      const row = (await getDoc(ref)).data().tasks[0];
      if (!row.timerActive || row.createdAt !== tasks[0].createdAt || row.points !== tasks[0].points) throw new Error('timer patch drifted identity');
    });
    await check(`${label} ${n}: title edit keeps points`, async () => {
      await fresh();
      const ref = doc(db, 'weeklyRoutines', `${U}_Sat`);
      const live = (await getDoc(ref)).data().tasks;
      const desired = live.map((t) => (t.id === 't0' ? { ...t, title: 'Renamed', points: 999 } : t));
      await updateDoc(ref, { tasks: dropUndefined(identityCommit(live, desired)), updatedAt: serverTimestamp() });
      const row = (await getDoc(ref)).data().tasks[0];
      if (row.title !== 'Renamed' || row.points !== tasks[0].points) throw new Error(`title/points ${row.title} ${row.points}`);
    });
    await check(`${label} ${n}: explicit points edit`, async () => {
      await fresh();
      const ref = doc(db, 'weeklyRoutines', `${U}_Sat`);
      const live = (await getDoc(ref)).data().tasks;
      const desired = live.map((t) => (t.id === 't0' ? { ...t, points: 5 } : t));
      const write = updateDoc(ref, { tasks: dropUndefined(identityCommit(live, desired, { keepPoints: false })), updatedAt: serverTimestamp() });
      if (label.startsWith('FIXTURE')) {
        await denied(() => write);
      } else await write;
    });
    await check(`${label} ${n}: tombstone delete keeps length`, async () => {
      await fresh();
      const ref = doc(db, 'weeklyRoutines', `${U}_Sat`);
      const live = (await getDoc(ref)).data().tasks;
      const desired = live.map((t) => (t.id === live[live.length - 1].id ? { ...t, removed: true } : t));
      await updateDoc(ref, { tasks: dropUndefined(identityCommit(live, desired)), updatedAt: serverTimestamp() });
      const saved = (await getDoc(ref)).data().tasks;
      if (saved.length !== live.length || saved[saved.length - 1].removed !== true || saved[saved.length - 1].points !== live[live.length - 1].points) throw new Error('tombstone shape');
    });
    await check(`${label} ${n}: shorter delete`, async () => {
      await fresh();
      const ref = doc(db, 'weeklyRoutines', `${U}_Sat`);
      const live = (await getDoc(ref)).data().tasks;
      const write = updateDoc(ref, { tasks: live.slice(0, -1), updatedAt: serverTimestamp() });
      if (label.startsWith('FIXTURE')) {
        await denied(() => write);
      } else await write;
    });
  }

  await seedDocs('Sat', [task(0), task(1)]);
  await seedDocs('Sun', [task(9)]);
  // seedDocs overwrites eightHour dayName to Sun. Put the lock on Sat so Sat is the frozen day; Sun stays writable.
  await env.withSecurityRulesDisabled(async (c) => {
    const { setDoc } = await import('firebase/firestore');
    const f = c.firestore();
    await setDoc(doc(f, 'eightHour', U), { lock: running });
    await setDoc(doc(f, 'weeklyRoutines', `${U}_Sat`), { tasks: [task(0), task(1)] });
    await setDoc(doc(f, 'weeklyRoutines', `${U}_Sun`), { tasks: [task(9)] });
  });

  await check(`${label}: atomic transfer commits both days`, async () => {
    const srcRef = doc(db, 'weeklyRoutines', `${U}_Sat`);
    const dstRef = doc(db, 'weeklyRoutines', `${U}_Sun`);
    await runTransaction(db, async (tx) => {
      const src = (await tx.get(srcRef)).data().tasks;
      const dst = (await tx.get(dstRef)).data().tasks;
      const plan = atomicMove(src, dst, 'id:t0');
      if (!plan.ok) throw new Error('plan');
      tx.set(srcRef, { tasks: dropUndefined(plan.nextSrc), updatedAt: serverTimestamp() }, { merge: true });
      tx.set(dstRef, { tasks: dropUndefined(plan.nextDst), updatedAt: serverTimestamp() }, { merge: true });
    });
    const src = (await getDoc(srcRef)).data().tasks;
    const dst = (await getDoc(dstRef)).data().tasks;
    if (src.length !== 2 || src[0].removed !== true || src[0].createdAt !== task(0).createdAt) throw new Error('source');
    if (dst.length !== 2 || dst.filter((t) => t.id === 't0').length !== 1) throw new Error('dest ' + dst.length);
  });

  await check(`${label}: retry does not add a second copy`, async () => {
    const srcRef = doc(db, 'weeklyRoutines', `${U}_Sat`);
    const dstRef = doc(db, 'weeklyRoutines', `${U}_Sun`);
    await runTransaction(db, async (tx) => {
      const src = (await tx.get(srcRef)).data().tasks;
      const dst = (await tx.get(dstRef)).data().tasks;
      const plan = atomicMove(src, dst, 'id:t0');
      tx.set(srcRef, { tasks: dropUndefined(plan.nextSrc), updatedAt: serverTimestamp() }, { merge: true });
      tx.set(dstRef, { tasks: dropUndefined(plan.nextDst), updatedAt: serverTimestamp() }, { merge: true });
    });
    const dst = (await getDoc(dstRef)).data().tasks;
    if (dst.filter((t) => t.id === 't0').length !== 1) throw new Error('dup ' + dst.length);
  });

  await check(`${label}: throw inside the transaction leaves both days unchanged`, async () => {
    const srcRef = doc(db, 'weeklyRoutines', `${U}_Sat`);
    const dstRef = doc(db, 'weeklyRoutines', `${U}_Sun`);
    const beforeS = (await getDoc(srcRef)).data().tasks;
    const beforeD = (await getDoc(dstRef)).data().tasks;
    let threw = false;
    try {
      await runTransaction(db, async (tx) => {
        const src = (await tx.get(srcRef)).data().tasks;
        const dst = (await tx.get(dstRef)).data().tasks;
        const plan = atomicMove(src, dst, 'id:t1');
        tx.set(srcRef, { tasks: dropUndefined(plan.nextSrc), updatedAt: serverTimestamp() }, { merge: true });
        tx.set(dstRef, { tasks: dropUndefined(plan.nextDst), updatedAt: serverTimestamp() }, { merge: true });
        throw new Error('fail one side before commit');
      });
    } catch (e) { threw = true; }
    if (!threw) throw new Error('transaction did not throw');
    const src = (await getDoc(srcRef)).data().tasks;
    const dst = (await getDoc(dstRef)).data().tasks;
    if (src[1].removed === true) throw new Error('source changed');
    if (dst.some((t) => t.id === 't1')) throw new Error('dest changed');
    if (src.length !== beforeS.length || dst.length !== beforeD.length) throw new Error('length');
  });

  await check(`${label}: disableNetwork on the rules-test client`, async () => {
    const srcRef = doc(db, 'weeklyRoutines', `${U}_Sat`);
    const beforeS = JSON.stringify((await getDoc(srcRef)).data().tasks);
    await disableNetwork(db);
    let getCode = 'ok';
    try { await getDoc(srcRef); } catch (e) { getCode = String(e.code || ''); }
    let txnCode = 'ok';
    try { await runTransaction(db, async (tx) => { await tx.get(srcRef); }); } catch (e) { txnCode = String(e.code || ''); }
    await enableNetwork(db);
    console.log('    rules-test client after disableNetwork: get=', getCode, 'transaction=', txnCode);
    if (JSON.stringify((await getDoc(srcRef)).data().tasks) !== beforeS) throw new Error('data changed');
  });

}

const env = await initializeTestEnvironment({ projectId: 'demo-zztest', firestore: { host: '127.0.0.1', port: PORT, rules: repoRules } });
await suite('REPO', env);
await env.clearFirestore();
await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/demo-zztest:securityRules`, { method: 'PUT', body: JSON.stringify({ rules: { files: [{ content: fixtureRules }] } }) });
await suite('FIXTURE-strict-locked-day-NOT-LIVE', env);
await check('raw Firestore client: getDoc while offline', async () => {
  const { initializeApp } = await import('firebase/app');
  const { initializeFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
  const app = initializeApp({ projectId: 'demo-zztest', apiKey: 'demo-key' }, 'offline-probe');
  const raw = initializeFirestore(app, { experimentalForceLongPolling: true });
  connectFirestoreEmulator(raw, '127.0.0.1', PORT);
  await disableNetwork(raw);
  let getCode = '', getMsg = '', txnCode = '', txnMsg = '';
  try { await getDoc(doc(raw, 'weeklyRoutines', 'ZZTESTdayW1_Sat')); } catch (e) { getCode = String(e.code || ''); getMsg = String(e.message || ''); }
  try { await runTransaction(raw, async (tx) => { await tx.get(doc(raw, 'weeklyRoutines', 'ZZTESTdayW1_Sat')); }); } catch (e) { txnCode = String(e.code || ''); txnMsg = String(e.message || ''); }
  await enableNetwork(raw);
  console.log('    raw getDoc', getCode, getMsg);
  console.log('    raw runTransaction', txnCode, txnMsg.slice(0, 200));
  if (getCode !== 'unavailable' || !/client is offline/.test(getMsg)) throw new Error('getDoc offline was ' + getCode + ' ' + getMsg);
});
await env.cleanup();
if (fail) { console.log(fail, 'FAILED'); process.exit(1); }
console.log('emu-day-writes: all passed');
