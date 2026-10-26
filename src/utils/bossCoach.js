// Boss coaching (pure): completion/streak reactions, focus-timer check-ins, overbooked-day warning, evening wrap-up rollover.
const pick = (list, seed = 0) => list[Math.abs(Math.round(seed)) % list.length];
const CHEER = ['Good. {t} is done. Next.', 'That is how it is done. {t}, crushed.', 'Outstanding. {t} is off the board.', 'Nice work, soldier. Keep moving.'];
const STREAK = ['Streak secured. Do not get comfortable.', 'Daily streak hit. That is discipline.'];
const ROAST = ['You broke the streak. Yesterday is gone. Today you earn it back.', 'Streak lost. Excuses are not points. Get to work.'];
export const reactionLine = ({ kind = 'done', title = '', seed = 0 } = {}) => {
  const list = kind === 'streak' ? STREAK : kind === 'missed' ? ROAST : CHEER;
  return pick(list, seed).replace('{t}', String(title).slice(0, 60) || 'That one');
};
// Once-per-day guard for the "missed streak" roast.
export const shouldRoast = (status, today, last) => status === 'broken' && last !== today;

// Focus timer check-ins: minutes-left marks at half time (>=20 min), 5 min left (>=15 min) and the end.
export const checkinMarks = (totalMin) => {
  const t = Math.round(Number(totalMin) || 0); const out = [];
  if (t >= 20) out.push(Math.floor(t / 2));
  if (t >= 15) out.push(5);
  out.push(0);
  return [...new Set(out)].sort((a, b) => b - a);
};
export const checkinLine = (minLeft, title = '') => (minLeft <= 0
  ? `Time. ${title ? `${title}: ` : ''}is it done? Mark it or go again.`
  : minLeft === 5 ? `Five minutes left${title ? ` on ${title}` : ''}. Finish strong.` : `Halfway${title ? ` on ${title}` : ''}. ${minLeft} minutes left. Eyes on the work.`);
export const dueMark = (marks, msLeft, spoken = new Set()) => marks.find((m) => !spoken.has(m) && msLeft <= m * 60000 && msLeft > (m - 1) * 60000 - 30000);

// Overbooked: open tasks' estimates vs minutes left in the day (lock end, or midnight).
export const overbooked = (tasks = [], minutesLeft = 0) => {
  const open = (tasks || []).filter((t) => t && t.title && !t.completed && t.status !== 'wontdo' && t.status !== 'pending');
  const need = open.reduce((s, t) => s + (Number(t.estimateMin) || Number(t.minutes) || 30), 0);
  const left = Math.max(0, Math.round(minutesLeft));
  const over = need > left && open.length > 0;
  const h = (m) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} hours` : `${m} minutes`);
  return { over, needMin: need, leftMin: left, count: open.length, line: over ? `You are overbooked. ${open.length} tasks need ${h(need)} and you have ${h(left)}. Cut, move or shorten something.` : '' };
};

// Evening wrap-up: today's unfinished, non-pending tasks to roll to tomorrow.
export const rollCandidates = (tasks = []) => (tasks || []).filter((t) => t && t.title && !t.completed && t.status !== 'wontdo' && t.status !== 'pending' && !t.timerActive);
export const tomorrowStr = (now = new Date()) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
