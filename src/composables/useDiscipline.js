// Firestore I/O for Discipline Mode.
//   userSettings/{uid}.discipline : { enabled, deadline, enabledOn }   (merge)
//   discipline/{uid}              : { lastSettled, lossPending, log[], ... } (owner-only)
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { normSettings, datesToSettle, settleDays, logEntry, pushLog, MISSED_DEADLINE_PENALTY, BOSS_BONUS } from '@/utils/discipline';
import { localDateStr } from '@/utils/streak';
import { addMonthlyAdjust } from '@/composables/useMonthlyStats';

const settingsRef = (uid) => doc(db, 'userSettings', uid);
export const discRef = (uid) => doc(db, 'discipline', uid);

export const loadDisciplineSettings = async (uid) => {
  const s = await getDoc(settingsRef(uid));
  return normSettings(s.exists() ? s.data().discipline : null);
};

export const saveDisciplineSettings = async (uid, settings) => {
  const s = normSettings(settings);
  if (s.enabled && !s.enabledOn) s.enabledOn = localDateStr();
  await setDoc(settingsRef(uid), { discipline: s }, { merge: true });
  return s;
};

export const loadDisciplineState = async (uid) => { const s = await getDoc(discRef(uid)); return s.exists() ? s.data() : {}; };
export const patchDisciplineState = (uid, patch) => setDoc(discRef(uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });

export const logDiscipline = async (uid, type, date, detail = '') => {
  const st = await loadDisciplineState(uid);
  await patchDisciplineState(uid, { log: pushLog(st.log, logEntry(type, date, detail)) });
};

// Check every due deadline; apply -50/missed day, kill the streak (unless `onBeforeKill` saves it), log, flag the loss screen.
export const settleDeadlines = async (uid, settings, now = new Date(), onBeforeKill = null) => {
  if (!uid || !settings?.enabled) return null;
  const today = localDateStr(now);
  const st = await loadDisciplineState(uid);
  const dates = datesToSettle({ lastSettled: st.lastSettled, enabledOn: settings.enabledOn }, today, now, settings.deadline);
  if (!dates.length) return null;
  const sRef = doc(db, 'streaks', uid);
  const sSnap = await getDoc(sRef);
  const streakDoc = sSnap.exists() ? sSnap.data() : {};
  const { settledThrough, missed } = settleDays(dates, streakDoc.counted);
  let log = st.log || [];
  let lossPending = st.lossPending || null;
  for (const d of missed) {
    await addMonthlyAdjust(uid, d, `missed:${d}`, MISSED_DEADLINE_PENALTY);
    log = pushLog(log, logEntry('missed-deadline', d, `${MISSED_DEADLINE_PENALTY} pts`));
    if (st.bossDate === d && st.bossClearedDate !== d) log = pushLog(log, logEntry('boss-failed', d, st.bossTitle || 'Boss'));
  }
  if (missed.length) {
    const saved = onBeforeKill ? await onBeforeKill(streakDoc, missed) : false;
    if (saved) log = pushLog(log, logEntry('freeze-used', missed[missed.length - 1], 'Streak freeze saved your streak'));
    else if ((streakDoc.streak || 0) > 0 || !lossPending) {
      if ((streakDoc.streak || 0) > 0) await setDoc(sRef, { streak: 0, prev: null, updatedAt: serverTimestamp() }, { merge: true });
      lossPending = { date: missed[missed.length - 1], lostStreak: streakDoc.streak || 0, penalty: MISSED_DEADLINE_PENALTY * missed.length };
    }
  }
  await patchDisciplineState(uid, { lastSettled: settledThrough, log, lossPending });
  return { missed, lossPending };
};

export const clearLossPending = (uid) => patchDisciplineState(uid, { lossPending: null });

// Boss: one task per day. Clearing it gives +BOSS_BONUS (idempotent per day); un-clearing removes it.
export const setBossForDay = (uid, date, title) => patchDisciplineState(uid, { bossDate: date, bossTitle: title || 'Boss', bossClearedDate: null });
export const setBossCleared = async (uid, date, cleared) => {
  await patchDisciplineState(uid, { bossClearedDate: cleared ? date : null });
  await addMonthlyAdjust(uid, date, `boss:${date}`, cleared ? BOSS_BONUS : null);
};

// Breaks: { date, usedMin, endsAt(ms), startedAt(ms), minutes } stored on discipline/{uid}.breaks; resets each local day.
export const breaksToday = (st, today) => (st?.breaks?.date === today ? st.breaks : { date: today, usedMin: 0, endsAt: 0 });
export const startBreak = async (uid, today, minutes) => {
  const st = await loadDisciplineState(uid);
  const b = breaksToday(st, today);
  const now = Date.now();
  const next = { ...b, usedMin: b.usedMin + minutes, startedAt: now, minutes, endsAt: now + minutes * 60000 };
  await patchDisciplineState(uid, { breaks: next });
  return next;
};
// End early: refund unused whole minutes.
export const endBreak = async (uid, today) => {
  const st = await loadDisciplineState(uid);
  const b = breaksToday(st, today);
  const leftMin = b.endsAt > Date.now() ? Math.floor((b.endsAt - Date.now()) / 60000) : 0;
  const next = { ...b, usedMin: Math.max(0, b.usedMin - leftMin), endsAt: 0 };
  await patchDisciplineState(uid, { breaks: next });
  return next;
};
