// Run: start the Firestore emulator on 127.0.0.1:8089, then `node scripts/emu-lock-capacity.test.mjs` (needs @firebase/rules-unit-testing; demo project, ZZTEST uids only).
// Regression for "every change reverts in lock mode": with ~11+ tasks the locked-day rule ran past Firestore's 1000-expression limit, so every
// write to the locked day (complete, timer start, notes) was denied and the app rolled the change back. Checks real-sized days 1..50.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { setLogLevel } from 'firebase/app';
import fs from 'fs';
setLogLevel('silent');
const env = await initializeTestEnvironment({ projectId: 'demo-zztest', firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
const U = 'ZZTESTlockCap1';
const db = env.authenticatedContext(U).firestore();
const ref = doc(db, 'weeklyRoutines', `${U}_Tue`);
const now = Date.now();
const admin = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));
const rich = (i) => ({ id: 't' + i, title: 'Task ' + i, createdAt: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:${String(i).padStart(2, '0')}:00.000Z`, type: 'recurring', completed: false, completedAt: null,
  points: 10 + i, complexity: 2, estimateMin: 30, estimateSource: 'server', timerActive: false, timerEndTime: null, timerDuration: 0, notes: 'n', subtasks: [{ title: 's', done: false }], apps: ['tiktok'] });
let fail = 0;
const check = async (name, want, fn) => { let ok = true; try { await fn(); } catch (e) { ok = false; } const pass = ok === want; if (!pass) fail++; console.log(pass ? 'PASS' : 'FAIL', '|', name); };
const seed = (tasks, lock) => admin(async (f) => { await setDoc(doc(f, 'weeklyRoutines', `${U}_Tue`), { tasks }); await setDoc(doc(f, 'eightHour', U), { lock }); });
const running = { dayName: 'Tue', startAt: new Date(now - 3600e3), endAt: new Date(now + 3600e3) };
const shut = { dayName: 'Tue', startAt: new Date(now - 9 * 3600e3), endAt: new Date(now - 3600e3), shutUntil: new Date(now + 3600e3) };
const patch = (i, fields) => runTransaction(db, async (tx) => { const s = await tx.get(ref); const t = [...s.data().tasks]; t[i] = { ...t[i], ...fields }; tx.update(ref, { tasks: t, updatedAt: serverTimestamp() }); });
for (const [label, lock] of [['locked', running], ['shut', shut]]) {
  for (const n of [1, 10, 11, 12, 20, 30, 40, 49, 50]) {
    const tasks = [...Array(n)].map((_, i) => rich(i));
    await seed(tasks, lock);
    await check(`${label} ${n} tasks: complete the last task`, true, () => patch(n - 1, { completed: true, completedAt: new Date() }));
    await check(`${label} ${n} tasks: start a timer (whole-array update)`, true, () => updateDoc(ref, { tasks: tasks.map((t, i) => (i === 0 ? { ...t, timerActive: true, timerEndTime: now + 20 * 60e3, timerDuration: 1200 } : t)), updatedAt: serverTimestamp() }));
  }
  const tasks = [...Array(50)].map((_, i) => rich(i));
  await seed(tasks, lock);
  await check(`${label} 50: re-point a late slot still blocked`, false, () => patch(45, { points: 999 }));
  await check(`${label} 50: delete still blocked`, false, () => updateDoc(ref, { tasks: tasks.slice(0, 49) }));
  await check(`${label} 50: swap still blocked`, false, () => updateDoc(ref, { tasks: [tasks[1], tasks[0], ...tasks.slice(2)] }));
  await check(`${label} 20: append add allowed`, true, async () => { await seed(tasks.slice(0, 20), lock); await updateDoc(ref, { tasks: [...tasks.slice(0, 20), rich(60)] }); });
}
await env.cleanup();
if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('all passed');
