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
