// Firestore persistence for scheduled tasks: field `scheduledTasks` ({ tasks: [...], updatedAt }) on the existing users/{userId} doc.
// Deployed rules only allow known collections, so no new collection/doc. Always written with setDoc(..., { merge: true })
// so other user fields are untouched. (Profile.vue strips this field before its updateDoc.)
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { isDayLocked, isShutdown, assertNotShut } from '@/utils/eightHourLock';
import { materializeDue, pruneMaterialized, expandRecurring, rollForwardOf } from '@/utils/scheduling';

const ref = (userId) => doc(db, 'users', userId);
const writeDay = (userId, dayName, tasks) => setDoc(doc(db, 'weeklyRoutines', `${userId}_${dayName}`), { tasks, updatedAt: serverTimestamp() });
const save = (userId, tasks) => setDoc(ref(userId), { scheduledTasks: { tasks, updatedAt: serverTimestamp() } }, { merge: true });

export const loadScheduled = async (userId) => {
  const snap = await getDoc(ref(userId));
  return snap.exists() ? (snap.data().scheduledTasks?.tasks || []) : [];
};

// Read-modify-write with a fresh read; fn(list) returns the new list.
export const mutateScheduled = async (userId, fn) => {
  assertNotShut(); // 8-hour hard stop: no scheduling until the next wake time
  const next = fn(await loadScheduled(userId));
  await save(userId, next);
  return next;
};

// Add scheduled tasks that became visible (their Mon–Sun week has started) to today's weeklyRoutines doc, exactly once.
// Also: expands recurring templates for this week, and rolls unfinished scheduled tasks forward to today until their date.
// Order: write day docs first, then the scheduled list; a failed second step is healed next run via scheduledId.
export const materializeDueForToday = async (userId, dayName, todayStr, dayNameOf = null) => {
  if (isDayLocked(dayName) || isShutdown()) return { added: 0, scheduled: await loadScheduled(userId) }; // 8-hour lock: today's list cannot grow while the window runs (retried on the next load)
  const { list: expanded, added: generated } = expandRecurring(await loadScheduled(userId), todayStr);
  let scheduled = expanded;
  let todayTasks = await loadDayTasks(userId, dayName);
  let todayChanged = false;
  let listChanged = generated.length > 0;
  if (dayNameOf) {
    for (const e of rollForwardOf(scheduled, todayStr)) {
      const fromName = dayNameOf(e.materializedDate);
      let stop = false;
      if (fromName && fromName !== dayName) {
        const fromTasks = await loadDayTasks(userId, fromName);
        const t = fromTasks.find((x) => x.scheduledId === e.id);
        if (t && !t.completed) {
          if (!todayTasks.some((x) => x.scheduledId === e.id)) { todayTasks = [...todayTasks, t]; todayChanged = true; }
          await writeDay(userId, dayName, todayTasks);
          await writeDay(userId, fromName, fromTasks.filter((x) => x.scheduledId !== e.id));
        } else if (!todayTasks.some((x) => x.scheduledId === e.id)) stop = true; // completed or deleted: stop tracking
      }
      scheduled = scheduled.map((x) => (x.id === e.id ? (stop ? { ...x, done: true } : { ...x, materializedDate: todayStr }) : x));
      listChanged = true;
    }
  }
  const nowIso = new Date().toISOString();
  const res = materializeDue({ scheduled, todayStr, todayTasks, nowIso });
  if (!res.changed && !listChanged) return { added: todayChanged ? 1 : 0, scheduled };
  if (res.toAdd.length) {
    await writeDay(userId, dayName, [...todayTasks, ...res.toAdd]);
  }
  const next = pruneMaterialized(res.scheduled, nowIso);
  await save(userId, next);
  return { added: res.toAdd.length + (todayChanged ? 1 : 0), scheduled: next };
};
