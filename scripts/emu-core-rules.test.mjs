// Run: start the Firestore emulator on 127.0.0.1:8089, then `node scripts/emu-core-rules.test.mjs` (needs @firebase/rules-unit-testing; demo project, ZZTEST uids only).
// Emulator check of the client write shapes used by HomeView against the real firestore.rules (ZZTEST uids only).
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, runTransaction, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
const env = await initializeTestEnvironment({ projectId: 'demo-zztest', firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
const U = 'ZZTESTcoreUid1', O = 'ZZTESTcoreOther';
const db = env.authenticatedContext(U).firestore();
const other = env.authenticatedContext(O).firestore();
const results = [];
// Admin setup via emulator REST with the 'owner' bearer (bypasses rules; emulator only).
const B_ = 'http://127.0.0.1:8089/v1/projects/demo-zztest/databases/(default)/documents';
const fv = (v) => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : v instanceof Date ? { timestampValue: v.toISOString() } : Array.isArray(v) ? { arrayValue: { values: v.map(fv) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } };
const adminSet = (path, data) => fetch(`${B_}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fv(data).mapValue.fields }) }).then((r) => { if (!r.ok) throw new Error('adminSet ' + r.status); });
const adminDel = (path) => fetch(`${B_}/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
const step = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const sameTask = (a, b) => (a.id && b.id) ? a.id === b.id : `${a.createdAt}|${a.title}` === `${b.createdAt}|${b.title}`;
const toggle = (d, day, task, locked) => runTransaction(d, async (tx) => {
  const ref = doc(d, 'weeklyRoutines', `${U}_${day}`); const snap = await tx.get(ref); if (!snap.exists()) return;
  const tasks = [...snap.data().tasks]; const at = tasks.findIndex((t) => sameTask(t, task)); if (at < 0) return;
  if (locked) tasks[at] = { ...tasks[at], completed: task.completed };
  else if (task.type === 'one-time' && task.completed) tasks.splice(at, 1); else tasks[at] = { ...tasks[at], ...task };
  if (tasks.length || locked) tx.update(ref, { tasks, updatedAt: serverTimestamp() }); else tx.delete(ref);
});
const mk = (title, type = 'recurring', createdAt = `2026-10-2${title.length % 9}T10:00:00.000Z`) => ({ title, type, createdAt, completed: false, points: 10 });
await env.clearFirestore();
const A = mk('Gym'), B = mk('Report'), C = mk('Call', 'one-time');
await step('add task (unlocked day, create)', () => assertSucceeds(setDoc(doc(db, 'weeklyRoutines', `${U}_Mon`), { tasks: [A, B, C] })));
await step('toggle complete by id in transaction', async () => { await assertSucceeds(toggle(db, 'Mon', { ...B, completed: true })); const t = (await getDoc(doc(db, 'weeklyRoutines', `${U}_Mon`))).data().tasks; if (!t.find((x) => x.title === 'Report').completed) throw new Error('not completed'); });
await step('uncomplete', async () => { await assertSucceeds(toggle(db, 'Mon', { ...B, completed: false })); });
await step('one-time completion removes only it', async () => { await toggle(db, 'Mon', { ...C, completed: true }); const t = (await getDoc(doc(db, 'weeklyRoutines', `${U}_Mon`))).data().tasks; if (t.length !== 2) throw new Error('len ' + t.length); });
await step('all-complete keeps recurring (bug 1)', async () => {
  await toggle(db, 'Mon', { ...A, completed: true }); await toggle(db, 'Mon', { ...B, completed: true });
  await runTransaction(db, async (tx) => { const r = doc(db, 'weeklyRoutines', `${U}_Mon`); const s = await tx.get(r); tx.set(r, { tasks: s.data().tasks.filter((t) => !(t.type === 'one-time' && t.completed)) }, { merge: true }); });
  const s = await getDoc(doc(db, 'weeklyRoutines', `${U}_Mon`)); if (!s.exists() || s.data().tasks.length !== 2) throw new Error('routine lost');
});
await step('reorder (unlocked)', () => assertSucceeds(setDoc(doc(db, 'weeklyRoutines', `${U}_Mon`), { tasks: [B, A] }, { merge: true })));
await step('other user cannot read/write', async () => { await assertFails(getDoc(doc(other, 'weeklyRoutines', `${U}_Mon`))); await assertFails(setDoc(doc(other, 'streaks', U), { streak: 9 })); });
// locked day
const now = Date.now();
await adminSet(`weeklyRoutines/${U}_Tue`, { tasks: [A, C] }); await adminSet(`eightHour/${U}`, { lock: { dayName: 'Tue', startAt: new Date(now - 3600e3), endAt: new Date(now + 3600e3) } });
await step('locked: complete in place allowed', () => assertSucceeds(toggle(db, 'Tue', { ...C, completed: true }, true)));
await step('locked: append add allowed', () => assertSucceeds(setDoc(doc(db, 'weeklyRoutines', `${U}_Tue`), { tasks: [A, { ...C, completed: true }, mk('New')] }, { merge: true })));
await step('locked: delete/reorder blocked', async () => { await assertFails(setDoc(doc(db, 'weeklyRoutines', `${U}_Tue`), { tasks: [A] }, { merge: true })); await assertFails(setDoc(doc(db, 'weeklyRoutines', `${U}_Tue`), { tasks: [{ ...C, completed: true }, A, mk('New')] }, { merge: true })); await assertFails(deleteDoc(doc(db, 'weeklyRoutines', `${U}_Tue`))); });
await step('locked: unlocked other day still editable', () => assertSucceeds(setDoc(doc(db, 'weeklyRoutines', `${U}_Mon`), { tasks: [A] }, { merge: true })));
// shut
await adminSet(`eightHour/${U}`, { lock: { dayName: 'Tue', startAt: new Date(now - 9 * 3600e3), endAt: new Date(now - 3600e3), shutUntil: new Date(now + 3600e3) } });
await step('shut: all task writes blocked', async () => { await assertFails(toggle(db, 'Mon', { ...A, completed: false })); await assertFails(setDoc(doc(db, 'weeklyRoutines', `${U}_Wed`), { tasks: [A] })); });
await step('shut: reads still work (old-week reset falls back to showing tasks)', () => assertSucceeds(getDoc(doc(db, 'weeklyRoutines', `${U}_Mon`))));
await adminDel(`eightHour/${U}`);
// streak: concurrent transactional updates do not lose increments
await step('streak transactions are atomic', async () => {
  const ref = doc(db, 'streaks', U); await setDoc(ref, { n: 0 });
  await Promise.all([...Array(5)].map(() => runTransaction(db, async (tx) => { const s = await tx.get(ref); tx.set(ref, { n: (s.data().n || 0) + 1 }, { merge: true }); })));
  const n = (await getDoc(ref)).data().n; if (n !== 5) throw new Error('n=' + n);
});
await step('dailyReports local-date key write', () => assertSucceeds(setDoc(doc(db, 'dailyReports', `${U}_2026-10-25`), { userId: U, completedTasks: 1, totalTasks: 2 })));
await env.cleanup();
for (const r of results) console.log(r.join(' | '));
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
