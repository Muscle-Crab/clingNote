// Firestore helpers for per-day task docs: weeklyRoutines/{userId}_{Day}
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { taskKey } from '@/utils/taskPlanning';

const dayRef = (userId, dayName) => doc(db, 'weeklyRoutines', `${userId}_${dayName}`);

export const loadDayTasks = async (userId, dayName) => {
  const snap = await getDoc(dayRef(userId, dayName));
  return snap.exists() ? (snap.data().tasks || []) : [];
};

// Merge `patch` into one stored task (matched by createdAt+title, falling back to index).
export const patchStoredTask = async (userId, dayName, task, fallbackIndex, patch) => {
  const ref = dayRef(userId, dayName);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const tasks = snap.data().tasks || [];
  let i = tasks.findIndex((t) => taskKey(t) === taskKey(task));
  if (i < 0) i = fallbackIndex;
  if (!tasks[i]) return false;
  tasks[i] = { ...tasks[i], ...patch };
  await updateDoc(ref, { tasks, updatedAt: serverTimestamp() });
  return true;
};

// Copy unfinished tasks to another day as one-time tasks (no duplicates if carried twice).
export const carryTasksToDay = async (userId, fromDayName, toDayName, tasks, dateStamp) => {
  const toRef = dayRef(userId, toDayName);
  const existing = await loadDayTasks(userId, toDayName);
  const fresh = tasks
    .filter((t) => !existing.some((e) => e.title === t.title && e.carriedFrom === dateStamp))
    .map((t) => ({ ...t, completed: false, type: 'one-time', carriedFrom: dateStamp, status: t.status || 'todo' }));
  if (fresh.length) {
    await setDoc(toRef, { tasks: [...existing, ...fresh], updatedAt: serverTimestamp() });
  }
  // one-time tasks are moved (removed from today); recurring tasks stay in their weekly routine
  const moved = tasks.filter((t) => t.type === 'one-time');
  if (moved.length) {
    const fromRef = dayRef(userId, fromDayName);
    const cur = await loadDayTasks(userId, fromDayName);
    const keys = new Set(moved.map(taskKey));
    await updateDoc(fromRef, { tasks: cur.filter((t) => !keys.has(taskKey(t))), updatedAt: serverTimestamp() });
  }
  return fresh.length;
};
