// Emulator regression for the Home repeat failure (ZZTEST uid, demo-zztest project, real firestore.rules).
// Run: java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --host 127.0.0.1 --port 8089, then node scripts/emu-repeat.test.mjs
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';
import fs from 'fs';
const P = 'demo-zztest', H = 'http://127.0.0.1:8089';
await fetch(`${H}/emulator/v1/projects/${P}:securityRules`, { method: 'PUT', body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: fs.readFileSync('firestore.rules', 'utf8') }] } }) }).then((r) => { if (!r.ok) throw new Error('rules ' + r.status); });
await fetch(`${H}/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' });
const U = 'ZZTESTrepeat1';
const app = initializeApp({ projectId: P, apiKey: 'x' }, 'zz');
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8089, { mockUserToken: { sub: U, user_id: U } });
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const legacy = { title: 'Shave', type: 'recurring', createdAt: '2025-06-01T10:00:00.000Z', completed: false, category: 'Personal', estimatedMinutes: 10, points: 15, timerEndTime: null, timerActive: false };
await setDoc(doc(db, 'weeklyRoutines', `${U}_Tue`), { tasks: [legacy] });
await setDoc(doc(db, 'weeklyRoutines', `${U}_Wed`), { tasks: [legacy] });
const run = async (label, strip) => {
  const want = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']); const patch = { type: 'recurring', repeatDays: [...want] };
  try {
    await runTransaction(db, async (tx) => {
      const refs = days.map((d) => doc(db, 'weeklyRoutines', `${U}_${d}`)); const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      snaps.forEach((snap, i) => { const d = days[i]; const l = snap.exists() ? snap.data().tasks || [] : []; const has = l.some((t) => t.title === legacy.title);
        let next = l; if (!want.has(d)) { if (!has) return; next = l.filter((t) => t.title !== legacy.title); } else if (has) next = l.map((t) => (t.title === legacy.title ? { ...t, ...patch } : t));
        else { const { timerActive, timerEnd, timerStart, boss, ...base } = legacy; next = [...l, strip({ ...base, ...patch, completed: false, completedAt: null, status: base.status === 'done' ? 'todo' : base.status, activeFrom: '' })]; }
        tx.set(refs[i], { tasks: next.map(strip), updatedAt: serverTimestamp() }, { merge: true }); });
    });
    const mon = (await getDoc(doc(db, 'weeklyRoutines', `${U}_Mon`))).data();
    console.log(label, 'OK', mon.tasks.length, JSON.stringify(mon.tasks[0].repeatDays));
  } catch (e) { console.log(label, 'FAIL', e.message.slice(0, 160)); }
};
const id = (x) => x;
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
await run('old write (status undefined) - expected FAIL:', id);
await run('fixed write (dropUndefined) - expected OK:', clean);
// 🔁 toggle ON/OFF through scheduling v2 (users/{uid}.scheduledTasks + today's day doc), as a free user, under the real rules.
const { applyTaskSchedule } = await import('../src/utils/schedEdit.js');
const { onSchedule, offSchedule, patternOf } = await import('../src/utils/repeatToggle.js');
const { dropUndefined } = await import('../src/utils/firestoreSafe.js');
const { updateDoc } = await import('firebase/firestore');
const today = new Date().toLocaleDateString('en-CA'); const dn = days[new Date().getDay()];
const plain = { title: 'Read', type: 'one-time', createdAt: '2026-10-01T10:00:00.000Z', completed: false, points: 10 };
const dayRef = doc(db, 'weeklyRoutines', `${U}_${dn}`); const userRef = doc(db, 'users', U);
try {
  await setDoc(userRef, { name: 'ZZTEST repeat' });
  await setDoc(dayRef, { tasks: [plain] });
  const on = applyTaskSchedule({ list: [], task: plain, sched: onSchedule(plain, today), dayDate: today });
  await setDoc(userRef, { scheduledTasks: { tasks: dropUndefined(on.list), updatedAt: serverTimestamp() } }, { merge: true });
  await updateDoc(dayRef, { tasks: [on.task], updatedAt: serverTimestamp() });
  const last = patternOf(on.task, on.list, today);
  const off = applyTaskSchedule({ list: on.list, task: on.task, sched: offSchedule(today), dayDate: today });
  await setDoc(userRef, { scheduledTasks: { tasks: dropUndefined(off.list), updatedAt: serverTimestamp() } }, { merge: true });
  await updateDoc(dayRef, { tasks: [{ ...off.task, lastRepeat: last }], updatedAt: serverTimestamp() });
  const u = (await getDoc(userRef)).data(); const d = (await getDoc(dayRef)).data();
  console.log('toggle v2 ON/OFF:', 'OK', u.scheduledTasks.tasks[0].recurrence.freq, 'until', u.scheduledTasks.tasks[0].recurrence.until, '| today kept:', d.tasks[0].title, !d.tasks[0].templateId, JSON.stringify(d.tasks[0].lastRepeat));
} catch (e) { console.log('toggle v2 ON/OFF: FAIL', e.message.slice(0, 200)); }
process.exit(0);
