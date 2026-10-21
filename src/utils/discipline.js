// Pure Discipline Mode logic. All dates are local 'YYYY-MM-DD'; times local 'HH:MM'.
import { dayDiff } from './streak';

export const DEFAULT_DEADLINE = '21:00';
export const MISSED_DEADLINE_PENALTY = -50;
export const WARNINGS = [{ id: '2h', min: 120 }, { id: '30m', min: 30 }];
export const LOG_KEEP = 200;

export const defaultSettings = () => ({ enabled: false, deadline: DEFAULT_DEADLINE, enabledOn: null });
export const normSettings = (s) => ({ ...defaultSettings(), ...(s || {}), deadline: /^\d{2}:\d{2}$/.test(s?.deadline || '') ? s.deadline : DEFAULT_DEADLINE });

export const deadlineAt = (dateStr, hhmm) => { const [y, m, d] = dateStr.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number); return new Date(y, m - 1, d, h, mi, 0, 0); };
export const minutesLeft = (now, dateStr, hhmm) => (deadlineAt(dateStr, hhmm).getTime() - now.getTime()) / 60000;
export const isPastDeadline = (now, dateStr, hhmm) => minutesLeft(now, dateStr, hhmm) <= 0;

// Active warning id ('2h' | '30m') or null. Only when the day isn't secured yet.
export const warningFor = (now, dateStr, hhmm, secured) => {
  if (secured) return null;
  const m = minutesLeft(now, dateStr, hhmm);
  if (m <= 0) return null;
  if (m <= 30) return '30m';
  if (m <= 120) return '2h';
  return null;
};

const addDays = (dateStr, n) => { const [y, m, d] = dateStr.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };

// Dates that are due for a deadline check: after lastSettled, from enabledOn, up to yesterday, plus today once past the deadline. Max 31.
export const datesToSettle = ({ lastSettled, enabledOn }, today, now, hhmm) => {
  if (!enabledOn) return [];
  let start = lastSettled ? addDays(lastSettled, 1) : enabledOn;
  if (dayDiff(enabledOn, start) < 0) start = enabledOn;
  const end = isPastDeadline(now, today, hhmm) ? today : addDays(today, -1);
  const out = [];
  for (let d = start; dayDiff(d, end) >= 0 && out.length < 31; d = addDays(d, 1)) out.push(d);
  return out;
};

// Settle: returns { settledThrough, missed: [dates] } given the streak's counted days.
export const settleDays = (dates, countedDays) => {
  const counted = new Set(countedDays || []);
  return { settledThrough: dates.length ? dates[dates.length - 1] : null, missed: dates.filter((d) => !counted.has(d)) };
};

export const logEntry = (type, date, detail = '', at = new Date()) => ({ type, date, detail, at: at.toISOString() });
export const pushLog = (log, ...entries) => [...(log || []), ...entries].slice(-LOG_KEEP);

// ---- Phase 2: Evening boss ----
export const BOSS_BONUS = 100;
// HP 100 -> 0 as subtasks get done; a completed boss is at 0.
export const bossHp = (task) => {
  if (task?.completed) return 0;
  const subs = Array.isArray(task?.subtasks) ? task.subtasks : [];
  if (!subs.length) return 100;
  return Math.round((1 - subs.filter((s) => s.done).length / subs.length) * 100);
};
// Can today's completions count toward the streak? Only gated when Discipline Mode is on.
export const streakGate = (settings, { bossSet = false, bossCleared = false, missedToday = false } = {}) => {
  if (!settings?.enabled) return true;
  if (missedToday) return false;
  return !bossSet || bossCleared;
};

// ---- Phase 3: Earned breaks + app gate ----
export const BREAK_PER_TASK = 2;
export const BREAK_ALL_DONE = 10;
export const breakStreakBonus = (streak) => (streak >= 30 ? 10 : streak >= 7 ? 5 : 0);
// Minutes earned today. Day bonus + streak escalation (+5 at 7 days, +10 at 30) only once the daily minimum is hit.
export const earnedBreakMinutes = (count, streak = 0, extraBonus = 0, min = 5) =>
  count * BREAK_PER_TASK + (count >= min ? BREAK_ALL_DONE + breakStreakBonus(streak) + extraBonus : 0);

// What the /gate screen shows. mode: 'on-break' | 'locked' | 'can-break' | 'no-minutes'.
export const gateState = ({ count, earned, used = 0, now, today, deadline, breakEndsAt = 0, min = 5 }) => {
  const available = Math.max(0, earned - used);
  const t = now.getTime();
  const msToDeadline = Math.max(0, deadlineAt(today, deadline).getTime() - t);
  if (breakEndsAt && breakEndsAt > t) return { mode: 'on-break', remainingMs: breakEndsAt - t, available, msToDeadline };
  if (count < min) return { mode: 'locked', left: min - count, available, msToDeadline };
  return { mode: available > 0 ? 'can-break' : 'no-minutes', available, msToDeadline };
};
export const fmtCountdown = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(ss).padStart(2, '0')}`; };
