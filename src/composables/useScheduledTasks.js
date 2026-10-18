// Firestore persistence for scheduled tasks: field `scheduledTasks` ({ tasks: [...], updatedAt }) on the existing users/{userId} doc.
// Deployed rules only allow known collections, so no new collection/doc. Always written with setDoc(..., { merge: true })
// so other user fields are untouched. (Profile.vue strips this field before its updateDoc.)
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { materializeDue, pruneMaterialized } from '@/utils/scheduling';

const ref = (userId) => doc(db, 'users', userId);
const save = (userId, tasks) => setDoc(ref(userId), { scheduledTasks: { tasks, updatedAt: serverTimestamp() } }, { merge: true });

export const loadScheduled = async (userId) => {
  const snap = await getDoc(ref(userId));
  return snap.exists() ? (snap.data().scheduledTasks?.tasks || []) : [];
};

// Read-modify-write with a fresh read; fn(list) returns the new list.
export const mutateScheduled = async (userId, fn) => {
  const next = fn(await loadScheduled(userId));
  await save(userId, next);
  return next;
};

// Add due scheduled tasks to today's weeklyRoutines doc (one-time tasks), exactly once.
// Order: write today's doc first, then mark entries materialized; a failed second step is healed next run via scheduledId.
export const materializeDueForToday = async (userId, dayName, todayStr) => {
  const scheduled = await loadScheduled(userId);
  const todayTasks = await loadDayTasks(userId, dayName);
  const nowIso = new Date().toISOString();
  const res = materializeDue({ scheduled, todayStr, todayTasks, nowIso });
  if (!res.changed) return { added: 0, scheduled };
  if (res.toAdd.length) {
    await setDoc(doc(db, 'weeklyRoutines', `${userId}_${dayName}`), { tasks: [...todayTasks, ...res.toAdd], updatedAt: serverTimestamp() });
  }
  const next = pruneMaterialized(res.scheduled, nowIso);
  await save(userId, next);
  return { added: res.toAdd.length, scheduled: next };
};
