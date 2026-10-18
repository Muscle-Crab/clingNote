// Firestore persistence for scheduled tasks: scheduledTasks/{userId} -> { userId, tasks: [...], updatedAt }
// Separate from weeklyRoutines so the shape of those docs is never altered.
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { materializeDue, pruneMaterialized } from '@/utils/scheduling';

const ref = (userId) => doc(db, 'scheduledTasks', userId);

export const loadScheduled = async (userId) => {
  const snap = await getDoc(ref(userId));
  return snap.exists() ? (snap.data().tasks || []) : [];
};

// Read-modify-write with a fresh read; fn(list) returns the new list.
export const mutateScheduled = async (userId, fn) => {
  const next = fn(await loadScheduled(userId));
  await setDoc(ref(userId), { userId, tasks: next, updatedAt: serverTimestamp() });
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
  await setDoc(ref(userId), { userId, tasks: next, updatedAt: serverTimestamp() });
  return { added: res.toAdd.length, scheduled: next };
};
