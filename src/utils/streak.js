// Pure TikTok-style streak logic. Dates are local YYYY-MM-DD strings (browser local time).
// A day counts once DAILY_STREAK_MIN distinct non-pending tasks were completed that day.
// ALLOWED_GAP_DAYS = max days between counted days (1 = no skipped days).
export const ALLOWED_GAP_DAYS = 1;
export const DAILY_STREAK_MIN = 5;
// The day streak is capped: it displays as N/STREAK_CAP and never goes above it.
// A day counts only if the user pressed Start Day and completed >= DAILY_STREAK_MIN tasks; a day that doesn't count
// resets the streak to 0 on the next evaluation (next app open / day rollover).
export const STREAK_CAP = 5;
export const capStreak = (n) => Math.min(STREAK_CAP, Math.max(0, Number(n) || 0));

const pad = (n) => String(n).padStart(2, '0');
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Whole calendar days between two YYYY-MM-DD strings (UTC math on date parts => DST-safe).
export const dayDiff = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

// Freeze days: every FREEZE_EVERY counted days in a row earns one freeze (held, max FREEZE_MAX). A held freeze
// automatically covers a missed day (up to FREEZE_MAX missed days in a row), so the streak holds instead of resetting.
// Frozen days keep the streak alive but don't grow it or count toward the next freeze.
export const FREEZE_EVERY = 7;
export const FREEZE_MAX = 2;
const FROZEN_KEEP = 30;
const clampBank = (n) => Math.min(FREEZE_MAX, Math.max(0, Math.floor(Number(n) || 0)));
export const addDaysLocal = (dateStr, n) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

// State: { streak, bestStreak, lastCompletionDate, dayDate, dayDone: [taskKey], prev }
// prev = snapshot before today's increment, so un-completing below the minimum can undo it.
const norm = (s) => ({
  streak: capStreak(s?.streak), // existing streaks above the cap are clamped
  bestStreak: Math.max(Number(s?.bestStreak) || 0, capStreak(s?.streak)),
  lastCompletionDate: s?.lastCompletionDate || null,
  dayDate: s?.dayDate || null,
  dayDone: Array.isArray(s?.dayDone) ? [...new Set(s.dayDone)] : [],
  prev: s?.prev || null,
  counted: Array.isArray(s?.counted) ? s.counted.slice(-62) : [], // recent counted local dates
  lastDay: s?.lastDay || null, // { date, count } of the previous active day
  freezeBank: clampBank(s?.freezeBank), // held freeze days (earned 1 per FREEZE_EVERY counted days in a row, max FREEZE_MAX)
  freezeRun: Math.max(0, Math.floor(Number(s?.freezeRun) || 0)), // counted days in a row toward the next freeze
  frozenDates: Array.isArray(s?.frozenDates) ? s.frozenDates.slice(-FROZEN_KEEP) : [], // missed days a freeze covered
  offDates: Array.isArray(s?.offDates) ? s.offDates.slice(-FROZEN_KEEP) : [], // planned days off ("I'm off"): bridged, never counted, bank untouched
});
// Planned days off: walk lastCompletionDate forward over consecutive off days before `today`, so they never break
// the streak (and never grow it or use a freeze). Pure; returns the normalised state.
export const bridgeOffDays = (state, today) => {
  const s = norm(state);
  if (!s.offDates.length || !s.lastCompletionDate || !s.streak) return s;
  const off = new Set(s.offDates); let lc = s.lastCompletionDate;
  for (let i = 0; i < 60; i += 1) { const nx = addDaysLocal(lc, 1); if (nx >= today || !off.has(nx)) break; lc = nx; }
  return lc === s.lastCompletionDate ? s : { ...s, lastCompletionDate: lc };
};
export const addOffDates = (state, dates) => { const s = norm(state); return [...new Set([...s.offDates, ...(dates || [])])].sort().slice(-FROZEN_KEEP); };
export const COUNTED_KEEP = 62;
const addCounted = (list, d) => [...list.filter((x) => x !== d), d].slice(-COUNTED_KEEP);

export const todayCount = (state, today) => { const s = norm(state); return s.dayDate === today ? s.dayDone.length : 0; };

// Days missed (not counted) between the last counted day and `today` that would break the streak (0 = not broken).
export const missedDays = (state, today, gap = ALLOWED_GAP_DAYS) => {
  const s = bridgeOffDays(state, today);
  if (!s.lastCompletionDate || !s.streak || s.lastCompletionDate === today) return [];
  const diff = dayDiff(s.lastCompletionDate, today);
  if (diff <= gap) return [];
  const out = []; for (let i = gap; i < diff && out.length < 400; i += 1) out.push(addDaysLocal(s.lastCompletionDate, i));
  return out;
};

// Auto-cover missed days with held freezes. -> { state, used, dates }. Covers only when the bank covers every missed day.
export const applyFreezes = (state, today, gap = ALLOWED_GAP_DAYS) => {
  const s = bridgeOffDays(state, today);
  const miss = missedDays(s, today, gap);
  if (!miss.length || miss.length > s.freezeBank) return { state: s, used: 0, dates: [] };
  let counted = s.counted; for (const d of miss) counted = addCounted(counted, d);
  const frozenDates = [...s.frozenDates.filter((d) => !miss.includes(d)), ...miss].slice(-FROZEN_KEEP);
  return { state: { ...s, freezeBank: s.freezeBank - miss.length, lastCompletionDate: miss[miss.length - 1], counted, frozenDates }, used: miss.length, dates: miss };
};

// Advance the freeze counter after a newly counted day (continued = the streak continued rather than restarted).
const earnFreeze = (s, continued) => {
  let run = continued ? s.freezeRun + 1 : 1; let bank = s.freezeBank;
  if (run >= FREEZE_EVERY) { run = 0; bank = clampBank(bank + 1); }
  return { freezeRun: run, freezeBank: bank };
};

// Mark the current day as counted (idempotent within a day). Held freezes auto-cover missed days first.
export const recordCompletion = (state, today, gap = ALLOWED_GAP_DAYS) => {
  const s0 = norm(state);
  if (s0.lastCompletionDate === today) return s0;
  const before = { streak: s0.streak, bestStreak: s0.bestStreak, lastCompletionDate: s0.lastCompletionDate, freezeBank: s0.freezeBank, freezeRun: s0.freezeRun, frozenDates: s0.frozenDates, counted: s0.counted };
  const s = applyFreezes(bridgeOffDays(s0, today), today, gap).state;
  const diff = s.lastCompletionDate ? dayDiff(s.lastCompletionDate, today) : Infinity;
  if (diff < 0) return s0; // clock went backwards; ignore
  const continued = diff <= gap && s.streak > 0;
  const streak = continued ? capStreak(s.streak + 1) : 1;
  return { ...s, streak, bestStreak: Math.max(s.bestStreak, streak), lastCompletionDate: today, counted: addCounted(s.counted, today), ...earnFreeze(s, continued),
    prev: before };
};

// A task was (un)completed today. Pending tasks are ignored.
// gate=false (Discipline Mode: boss not cleared / deadline missed) means the day can't count yet.
export const applyTaskToggle = (state, today, { key, completed, pending = false, gate = true }, gap = ALLOWED_GAP_DAYS, min = DAILY_STREAK_MIN) => {
  let s = norm(state);
  if (pending || !key) return s;
  const done = new Set(s.dayDate === today ? s.dayDone : []);
  if (completed) done.add(key); else done.delete(key);
  const lastDay = s.dayDate && s.dayDate !== today ? { date: s.dayDate, count: s.dayDone.length } : (state?.lastDay || null); // for the morning report
  s = { ...s, dayDate: today, dayDone: [...done], prev: s.dayDate === today ? s.prev : null, lastDay };
  if (done.size >= min && gate) return recordCompletion(s, today, gap);
  if (s.lastCompletionDate === today && s.prev) return norm({ ...s, ...s.prev, prev: null, counted: (s.prev.counted || s.counted).filter((d) => d !== today) }); // undo today
  return s;
};

// Evaluate on `today`. status: 'none' | 'done' | 'at-risk' | 'broken'. progress = completed today.
export const evaluateStreak = (state, today, gap = ALLOWED_GAP_DAYS, min = DAILY_STREAK_MIN) => {
  const s = bridgeOffDays(state, today);
  const progress = todayCount(s, today);
  const base = { ...s, progress, min };
  if (s.lastCompletionDate === today) return { ...base, status: 'done' };
  if (!s.lastCompletionDate || !s.streak) return { ...base, streak: 0, status: progress ? 'at-risk' : 'none' };
  const diff = dayDiff(s.lastCompletionDate, today);
  if (diff <= gap) return { ...base, status: 'at-risk' }; // today still open
  return { ...base, streak: 0, status: 'broken' };
};

// Why a streak was lost (for the banner): yesterday had fewer than `min` completions, or the day was never started.
export const lostReason = (state, today, min = DAILY_STREAK_MIN) => {
  const s = norm(state);
  const [yy, mm, dd] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(yy, mm - 1, dd - 1)).toISOString().slice(0, 10);
  const n = s.dayDate === yesterday ? s.dayDone.length : (s.lastDay && s.lastDay.date === yesterday ? s.lastDay.count : 0);
  if (n > 0 && n < min) return `Only ${n}/${min} tasks were completed yesterday.`;
  return "You didn't press Start Day and finish tasks yesterday.";
};
