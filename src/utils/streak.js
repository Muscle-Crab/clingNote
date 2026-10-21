// Pure TikTok-style streak logic. Dates are local YYYY-MM-DD strings (browser local time).
// A day counts once DAILY_STREAK_MIN distinct non-pending tasks were completed that day.
// ALLOWED_GAP_DAYS = max days between counted days (1 = no skipped days).
export const ALLOWED_GAP_DAYS = 1;
export const DAILY_STREAK_MIN = 5;

const pad = (n) => String(n).padStart(2, '0');
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Whole calendar days between two YYYY-MM-DD strings (UTC math on date parts => DST-safe).
export const dayDiff = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

// State: { streak, bestStreak, lastCompletionDate, dayDate, dayDone: [taskKey], prev }
// prev = snapshot before today's increment, so un-completing below the minimum can undo it.
const norm = (s) => ({
  streak: Number(s?.streak) || 0,
  bestStreak: Math.max(Number(s?.bestStreak) || 0, Number(s?.streak) || 0),
  lastCompletionDate: s?.lastCompletionDate || null,
  dayDate: s?.dayDate || null,
  dayDone: Array.isArray(s?.dayDone) ? [...new Set(s.dayDone)] : [],
  prev: s?.prev || null,
});

export const todayCount = (state, today) => { const s = norm(state); return s.dayDate === today ? s.dayDone.length : 0; };

// Mark the current day as counted (idempotent within a day).
export const recordCompletion = (state, today, gap = ALLOWED_GAP_DAYS) => {
  const s = norm(state);
  if (s.lastCompletionDate === today) return s;
  const diff = s.lastCompletionDate ? dayDiff(s.lastCompletionDate, today) : Infinity;
  if (diff < 0) return s; // clock went backwards; ignore
  const streak = diff <= gap && s.streak > 0 ? s.streak + 1 : 1;
  return { ...s, streak, bestStreak: Math.max(s.bestStreak, streak), lastCompletionDate: today,
    prev: { streak: s.streak, bestStreak: s.bestStreak, lastCompletionDate: s.lastCompletionDate } };
};

// A task was (un)completed today. Pending tasks are ignored.
export const applyTaskToggle = (state, today, { key, completed, pending = false }, gap = ALLOWED_GAP_DAYS, min = DAILY_STREAK_MIN) => {
  let s = norm(state);
  if (pending || !key) return s;
  const done = new Set(s.dayDate === today ? s.dayDone : []);
  if (completed) done.add(key); else done.delete(key);
  s = { ...s, dayDate: today, dayDone: [...done], prev: s.dayDate === today ? s.prev : null };
  if (done.size >= min) return recordCompletion(s, today, gap);
  if (s.lastCompletionDate === today && s.prev) return { ...s, ...s.prev, prev: null }; // dropped below min: undo today
  return s;
};

// Evaluate on `today`. status: 'none' | 'done' | 'at-risk' | 'broken'. progress = completed today.
export const evaluateStreak = (state, today, gap = ALLOWED_GAP_DAYS, min = DAILY_STREAK_MIN) => {
  const s = norm(state);
  const progress = todayCount(s, today);
  const base = { ...s, progress, min };
  if (s.lastCompletionDate === today) return { ...base, status: 'done' };
  if (!s.lastCompletionDate || !s.streak) return { ...base, streak: 0, status: progress ? 'at-risk' : 'none' };
  const diff = dayDiff(s.lastCompletionDate, today);
  if (diff <= gap) return { ...base, status: 'at-risk' }; // today still open
  return { ...base, streak: 0, status: 'broken' };
};
