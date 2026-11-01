// Firestore I/O for Discipline Mode.
//   userSettings/{uid}.discipline : { enabled, deadline, enabledOn }   (merge)
//   discipline/{uid}              : { lastSettled, lossPending, log[], ... } (owner-only)
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { normSettings, datesToSettle, settleDays, deadlineAt, streakGate, logEntry, pushLog, MISSED_DEADLINE_PENALTY, BOSS_BONUS } from '@/utils/discipline';
import { localDateStr, dayQualifies, recordCompletion, ALLOWED_GAP_DAYS, dayDiff } from '@/utils/streak';
import { taskKey } from '@/utils/taskPlanning';
import { isTaskVisibleOn } from '@/utils/scheduling';
import { loadDayTasks } from '@/composables/useDayPersistence';
import { useFreeze } from '@/utils/rewards';
import { addMonthlyAdjust } from '@/composables/useMonthlyStats';

const settingsRef = (uid) => doc(db, 'userSettings', uid);
export const discRef = (uid) => doc(db, 'discipline', uid);

export const loadDisciplineSettings = async (uid) => {
  const s = await getDoc(settingsRef(uid));
  const stored = s.exists() ? s.data().discipline : null;
  // First run: strict defaults are on. Persist them with enabledOn = today so nothing is settled retroactively.
  if (stored) return normSettings(stored);
  // B43: persist the defaults only if the server still has no settings (a transaction reads the server, never a stale
  // or partial first read), so a deadline the user already saved is never overwritten with the 21:00 default.
  return runTransaction(db, async (tx) => {
    const fresh = await tx.get(settingsRef(uid)); const cur = fresh.exists() ? fresh.data().discipline : null;
    if (cur) return normSettings(cur);
    const s0 = normSettings(null); s0.enabledOn = localDateStr();
    tx.set(settingsRef(uid), { discipline: s0 }, { merge: true });
    return s0;
  });
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
export const settleDeadlines = async (uid, settings, now = new Date(), onBeforeKill = null, { qualifies = null } = {}) => {
  if (!uid || !settings?.enabled) return null;
  const today = localDateStr(now);
  const st = await loadDisciplineState(uid);
  const dates = datesToSettle({ lastSettled: st.lastSettled, enabledOn: settings.enabledOn }, today, now, settings.deadline);
  if (!dates.length) return null;
  const sRef = doc(db, 'streaks', uid);
  const sSnap = await getDoc(sRef);
  const streakDoc = sSnap.exists() ? sSnap.data() : {};
  const settled = settleDays(dates, streakDoc.counted); const settledThrough = settled.settledThrough;
  // B43: a day whose stored tasks already qualified before its deadline (done on another device / the widget while
  // this app was closed) is credited instead of settled as missed. Only today and yesterday; no double count.
  const missed = []; const credited = [];
  for (const d of settled.missed) {
    let ok = false;
    if (qualifies && dayDiff(d, today) <= 1) { try { ok = await qualifies(d, st, streakDoc); } catch (e) { ok = false; } }
    if (ok && await creditDay(uid, d)) credited.push(d); else missed.push(d);
  }
  if (credited.length) { const again = await getDoc(sRef); Object.assign(streakDoc, again.exists() ? again.data() : {}); }
  let log = st.log || [];
  let lossPending = st.lossPending || null;
  for (const d of missed) {
    await addMonthlyAdjust(uid, d, `missed:${d}`, MISSED_DEADLINE_PENALTY);
    log = pushLog(log, logEntry('missed-deadline', d, `${MISSED_DEADLINE_PENALTY} pts`));
    if (st.bossDate === d && st.bossClearedDate !== d) log = pushLog(log, logEntry('boss-failed', d, st.bossTitle || 'Evening challenge'));
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
  return { missed, credited, lossPending };
};

// B43: count `date` on the streak (idempotent: recordCompletion is a no-op when the day is already the last counted).
export const creditDay = async (uid, date, gap = ALLOWED_GAP_DAYS) => runTransaction(db, async (tx) => {
  const ref = doc(db, 'streaks', uid); const snap = await tx.get(ref); const cur = snap.exists() ? snap.data() : {};
  if ((cur.counted || []).includes(date)) return true;
  const n = recordCompletion(cur, date, gap);
  if (n.lastCompletionDate !== date) return false; // clock/order problem: leave it to the normal settle
  tx.set(ref, { ...n, prev: null, updatedAt: serverTimestamp() }, { merge: true });
  return true;
});

// B43: did the day's stored tasks qualify by themselves before its deadline? Reads Firestore (not the UI), so it is
// right on a cold start and for work done elsewhere. Same rules as the recheck: after Start Day, before the deadline,
// boss cleared when one was set.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const storedDayQualifies = async (uid, date, settings, discState = {}, streakDoc = {}) => {
  const us = await getDoc(settingsRef(uid)); const session = us.exists() ? (us.data().daySessions || {})[date] : null;
  if (!session || !session.started) return false;
  const st = session.startTime; const startMs = st && typeof st.toMillis === 'function' ? st.toMillis() : (st ? Date.parse(st) : null);
  const tasks = (await loadDayTasks(uid, WEEKDAYS[new Date(`${date}T12:00:00`).getDay()])).filter((t) => t && isTaskVisibleOn(t, date));
  const endMs = settings?.enabled ? deadlineAt(date, settings.deadline).getTime() : null;
  const gate = streakGate(settings, { bossSet: discState.bossDate === date, bossCleared: discState.bossClearedDate === date });
  const prevDone = streakDoc.dayDate === date && Array.isArray(streakDoc.dayDone) ? streakDoc.dayDone : [];
  return dayQualifies(tasks, { started: true, startMs: Number.isFinite(startMs) ? startMs : null, endMs, keyOf: taskKey, prevDone, gate });
};

// Spend an earned streak freeze (if any) instead of killing the streak. Returns true if used.
export const tryFreeze = async (uid, streakDoc, missedDates, freezes) => {
  if (missedDates.length !== 1) return false; // a freeze covers a single missed day
  const st = await loadDisciplineState(uid);
  const r = useFreeze(streakDoc, missedDates[0], { freezes, used: st.freezesUsed || 0 });
  if (!r.used) return false;
  await setDoc(doc(db, 'streaks', uid), { lastCompletionDate: r.state.lastCompletionDate, counted: r.state.counted, prev: null }, { merge: true });
  await patchDisciplineState(uid, { freezesUsed: (st.freezesUsed || 0) + 1 });
  return true;
};

export const clearLossPending = (uid) => patchDisciplineState(uid, { lossPending: null });

// Boss: one task per day. Clearing it gives +BOSS_BONUS (idempotent per day); un-clearing removes it.
export const setBossForDay = (uid, date, title) => patchDisciplineState(uid, { bossDate: date, bossTitle: title || 'Evening challenge', bossClearedDate: null });
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
