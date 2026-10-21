// Pure TikTok-style streak logic. Dates are local YYYY-MM-DD strings (browser local time).
// A day counts if >=1 task was completed that day. ALLOWED_GAP_DAYS = max days between counted days (1 = no skips).
export const ALLOWED_GAP_DAYS = 1;

const pad = (n) => String(n).padStart(2, '0');
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Whole calendar days between two YYYY-MM-DD strings (UTC math on date parts => DST-safe).
export const dayDiff = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

const norm = (s) => ({ streak: Number(s?.streak) || 0, bestStreak: Math.max(Number(s?.bestStreak) || 0, Number(s?.streak) || 0), lastCompletionDate: s?.lastCompletionDate || null });

// Record a completed task on `today`. Idempotent within a day.
export const recordCompletion = (state, today, gap = ALLOWED_GAP_DAYS) => {
  const s = norm(state);
  if (s.lastCompletionDate === today) return s;
  const diff = s.lastCompletionDate ? dayDiff(s.lastCompletionDate, today) : Infinity;
  if (diff < 0) return s; // clock went backwards; ignore
  const streak = diff <= gap && s.streak > 0 ? s.streak + 1 : 1;
  return { streak, bestStreak: Math.max(s.bestStreak, streak), lastCompletionDate: today };
};

// Evaluate current state on `today` without a completion. status: 'none' | 'done' | 'at-risk' | 'broken'.
export const evaluateStreak = (state, today, gap = ALLOWED_GAP_DAYS) => {
  const s = norm(state);
  if (!s.lastCompletionDate || !s.streak) return { ...s, streak: 0, status: 'none' };
  const diff = dayDiff(s.lastCompletionDate, today);
  if (diff <= 0) return { ...s, status: 'done' };
  if (diff <= gap) return { ...s, status: 'at-risk' }; // today still open
  return { ...s, streak: 0, status: 'broken' };
};
