// Pure monthly-ranking logic. Months keyed by LOCAL 'YYYY-MM'; a month locks at 11:59 PM local on its last day.
import { DAILY_STREAK_MIN } from './streak';

export const POINTS_PER_TASK = 10;
export const POINTS_STREAK_DAY = 25; // each day reaching DAILY_STREAK_MIN
export const POINTS_GOAL_BONUS = 50; // once, when count >= goal
export const DEFAULT_MONTHLY_GOAL = 100;
export const TIERS = [
  { name: 'Bronze', min: 0, icon: '🥉' },
  { name: 'Silver', min: 500, icon: '🥈' },
  { name: 'Gold', min: 1000, icon: '🥇' },
  { name: 'Platinum', min: 2000, icon: '💠' },
  { name: 'Diamond', min: 3500, icon: '💎' },
];

export const monthKey = (dateStr) => dateStr.slice(0, 7);
export const prevMonthKey = (mk) => { const [y, m] = mk.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export const lastDayOfMonth = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const isFinalDay = (dateStr) => Number(dateStr.slice(8, 10)) === lastDayOfMonth(monthKey(dateStr));
// A month is final once the local date is in a later month.
export const isMonthFinal = (mk, todayStr) => monthKey(todayStr) > mk;

export const tierFor = (points) => [...TIERS].reverse().find((t) => points >= t.min) || TIERS[0];
export const nextTier = (points) => { const t = TIERS.find((x) => x.min > points); return t ? { ...t, need: t.min - points } : null; };
export const tierAtLeast = (points, name) => points >= (TIERS.find((t) => t.name === name)?.min ?? Infinity);

const goalOf = (g) => (Number(g) > 0 ? Math.floor(Number(g)) : DEFAULT_MONTHLY_GOAL);

// Private per-user detail for a month: { month, done: ['YYYY-MM-DD|taskKey'], goal }.
// Derive public stats from it.
export const computeStats = (detail, min = DAILY_STREAK_MIN) => {
  const done = [...new Set(detail?.done || [])];
  const perDay = {};
  done.forEach((k) => { const d = k.slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; });
  const streakDays = Object.values(perDay).filter((n) => n >= min).length;
  const goal = goalOf(detail?.goal);
  const count = done.length;
  const goalReached = count >= goal;
  const adjust = Object.values(detail?.adjust || {}).reduce((a, v) => a + (Number(v) || 0), 0); // { 'kind:date': pts }
  const points = Math.max(0, count * POINTS_PER_TASK + streakDays * POINTS_STREAK_DAY + (goalReached ? POINTS_GOAL_BONUS : 0) + adjust);
  return { count, streakDays, goal, goalReached, adjust, points, tier: tierFor(points).name };
};

// Apply a task (un)completion on local date `today`. New month => fresh detail (starts at 0).
export const applyMonthlyToggle = (detail, today, { key, completed, pending = false }) => {
  const month = monthKey(today);
  const base = detail?.month === month ? detail : { month, done: [], goal: detail?.goal, adjust: {} };
  if (pending || !key) return { ...base, done: [...(base.done || [])] };
  const set = new Set(base.done || []);
  const k = `${today}|${key}`;
  if (completed) set.add(k); else set.delete(k);
  return { ...base, month, done: [...set] };
};

// Leaderboard: opted-in users, sorted by points desc (ties: count, then name). Never exposes emails.
export const safeName = (n) => (typeof n === 'string' && n.trim() && !n.includes('@') ? n.trim().slice(0, 40) : 'Anonymous');
export const buildLeaderboard = (rows, uid) => rows
  .filter((r) => r.optIn !== false || r.uid === uid)
  .map((r) => ({ uid: r.uid, displayName: safeName(r.displayName), points: Number(r.points) || 0, count: Number(r.count) || 0, tier: tierFor(Number(r.points) || 0).name, bestStreak: Number(r.bestStreak) || 0, me: r.uid === uid, optIn: r.optIn !== false }))
  .filter((r) => r.optIn || r.me)
  .sort((a, b) => b.points - a.points || b.count - a.count || a.displayName.localeCompare(b.displayName))
  .map((r, i) => ({ ...r, rank: i + 1 }));

// Month-end awards for a user from a finished month's leaderboard (rank computed among opted-in users only).
export const monthlyAwards = (board, uid) => {
  const ranked = board.filter((r) => r.optIn);
  const i = ranked.findIndex((r) => r.uid === uid);
  const me = board.find((r) => r.uid === uid);
  const out = [];
  if (i === 0 && me.points > 0) out.push('monthly-1');
  if (i >= 0 && i < 3 && me.points > 0) out.push('monthly-top3');
  if (me && tierAtLeast(me.points, 'Gold')) out.push('monthly-gold');
  return out;
};

// Idempotent point adjustment (e.g. 'missed:2026-10-20' -> -50, 'boss:2026-10-20' -> +100).
export const applyAdjust = (detail, mk, id, pts) => {
  const base = detail?.month === mk ? detail : { month: mk, done: [], goal: detail?.goal, adjust: {} };
  const adjust = { ...(base.adjust || {}) };
  if (pts === null) delete adjust[id]; else adjust[id] = pts;
  return { ...base, adjust };
};
