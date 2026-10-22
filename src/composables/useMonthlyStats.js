// Firestore I/O for monthly rankings.
//   monthlyStats/{YYYY-MM}/users/{uid}   public: { count, points, tier, goal, displayName, bestStreak, optIn }
//   monthlyStats/{YYYY-MM}/private/{uid} owner-only: { month, done: ['YYYY-MM-DD|taskKey'], goal }
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, increment } from 'firebase/firestore';
import { applyMonthlyToggle, applyAdjust, computeStats, monthKey, safeName, buildLeaderboard, monthlyAwards, DEFAULT_MONTHLY_GOAL } from '@/utils/ranking';

const pubRef = (mk, uid) => doc(db, 'monthlyStats', mk, 'users', uid);
const privRef = (mk, uid) => doc(db, 'monthlyStats', mk, 'private', uid);

const userName = async (uid) => {
  try { const s = await getDoc(doc(db, 'users', uid)); return safeName(s.exists() ? s.data().name : ''); } catch (e) { return 'Anonymous'; }
};

const writeStats = async (mk, uid, detail, extra = {}) => {
  const pub = await getDoc(pubRef(mk, uid));
  const prev = pub.exists() ? pub.data() : {};
  const s = computeStats(detail);
  await setDoc(privRef(mk, uid), { ...detail, updatedAt: serverTimestamp() });
  await setDoc(pubRef(mk, uid), {
    count: s.count, points: s.points, tier: s.tier, goal: s.goal,
    displayName: prev.displayName || await userName(uid),
    optIn: prev.optIn !== false, bestStreak: prev.bestStreak || 0,
    ...extra, updatedAt: serverTimestamp(),
  }, { merge: true });
  const delta = s.points - (Number(prev.points) || 0); // XP = lifetime points (unchecks/penalties reduce it)
  if (delta) await setDoc(doc(db, 'discipline', uid), { xp: increment(delta) }, { merge: true });
  return s;
};

export const loadMyMonth = async (uid, mk) => {
  const [p, d] = await Promise.all([getDoc(pubRef(mk, uid)), getDoc(privRef(mk, uid))]);
  const detail = d.exists() ? d.data() : { month: mk, done: [], goal: p.exists() ? (p.data().goal ?? DEFAULT_MONTHLY_GOAL) : DEFAULT_MONTHLY_GOAL };
  return { pub: p.exists() ? p.data() : null, detail, stats: computeStats(detail) };
};

// Called on each task (un)completion on today's tab.
export const recordMonthlyToggle = async (uid, today, toggle, bestStreak) => {
  if (!uid) return null;
  const mk = monthKey(today);
  const d = await getDoc(privRef(mk, uid));
  let detail = d.exists() ? d.data() : null;
  if (!detail) { // carry goal from last saved public doc for this month, if any
    const p = await getDoc(pubRef(mk, uid));
    detail = { month: mk, done: [], goal: p.exists() ? (p.data().goal ?? DEFAULT_MONTHLY_GOAL) : DEFAULT_MONTHLY_GOAL };
  }
  const next = applyMonthlyToggle(detail, today, toggle);
  return writeStats(mk, uid, next, bestStreak != null ? { bestStreak } : {});
};

export const setMonthlyGoal = async (uid, mk, goal) => {
  const { detail } = await loadMyMonth(uid, mk);
  return writeStats(mk, uid, { ...detail, month: mk, goal: Math.max(1, Math.floor(Number(goal) || DEFAULT_MONTHLY_GOAL)) });
};

export const setOptIn = (uid, mk, optIn) => setDoc(pubRef(mk, uid), { optIn: !!optIn, updatedAt: serverTimestamp() }, { merge: true });

export const loadLeaderboard = async (mk, uid) => {
  const snap = await getDocs(query(collection(db, 'monthlyStats', mk, 'users'), where('optIn', '==', true)));
  const rows = snap.docs.map((x) => ({ uid: x.id, ...x.data() }));
  if (uid && !rows.some((r) => r.uid === uid)) { const me = await getDoc(pubRef(mk, uid)); if (me.exists()) rows.push({ uid, ...me.data() }); }
  return buildLeaderboard(rows, uid);
};

// Award month-end badges for a finished month (idempotent: stored as `${id}:${mk}` in streaks/{uid}.monthlyBadges).
export const awardFinishedMonth = async (uid, mk) => {
  const board = await loadLeaderboard(mk, uid);
  if (!board.some((r) => r.me)) return [];
  const ids = monthlyAwards(board, uid).map((id) => `${id}:${mk}`);
  if (!ids.length) return [];
  const ref = doc(db, 'streaks', uid);
  const s = await getDoc(ref);
  const have = new Set((s.exists() && s.data().monthlyBadges) || []);
  const fresh = ids.filter((i) => !have.has(i));
  if (fresh.length) await setDoc(ref, { monthlyBadges: [...have, ...fresh] }, { merge: true });
  return [...have, ...fresh];
};

// Idempotent point adjustment for the month containing `date` (penalties / bonuses).
export const addMonthlyAdjust = async (uid, date, id, pts) => {
  const mk = monthKey(date);
  const { detail } = await loadMyMonth(uid, mk);
  return writeStats(mk, uid, applyAdjust({ ...detail, month: mk }, mk, id, pts));
};
