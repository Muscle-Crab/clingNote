// Pure morning-report builder, shared by the app (in-app card) and the Netlify scheduled function (push).
export const REPORT_HOUR = 8;
const PRI = { high: 0, medium: 1, low: 2 };

export const localParts = (date, timeZone) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
export const prevDay = (ds) => { const [y, m, d] = ds.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d - 1)); return x.toISOString().slice(0, 10); };

// Should the report show/send now? Once per local date, at/after 8 AM.
export const reportDue = (localDate, localHour, lastShown) => localHour >= REPORT_HOUR && lastShown !== localDate;

const daysSince = (iso, now) => { const t = new Date(iso).getTime(); return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 86400000)) : null; };

export const topForToday = (tasks, n = 3) => (tasks || [])
  .filter((t) => t && !t.completed && t.status !== 'pending')
  .map((t, i) => ({ t, i }))
  .sort((a, b) => (b.t.boss ? 1 : 0) - (a.t.boss ? 1 : 0) || (b.t.important ? 1 : 0) - (a.t.important ? 1 : 0)
    || (PRI[a.t.priority] ?? 3) - (PRI[b.t.priority] ?? 3) || String(a.t.dueDate || '9999').localeCompare(String(b.t.dueDate || '9999')) || a.i - b.i)
  .slice(0, n).map(({ t }) => t.title);

// streakDoc: streaks/{uid}; yesterdayTasks: yesterday's weekday list (what's still there = not done); todayTasks: today's list.
export const buildRecap = ({ today, streakDoc = {}, yesterdayTasks = [], todayTasks = [], min = 5, now = new Date() }) => {
  const yesterday = prevDay(today);
  const s = streakDoc || {};
  let done = 0;
  if (s.dayDate === yesterday) done = (s.dayDone || []).length;
  else if (s.lastDay?.date === yesterday) done = Number(s.lastDay.count) || 0;
  const counted = (s.counted || []).includes(yesterday) || s.lastCompletionDate === yesterday;
  const STREAK_CAP = 5; // keep in sync with src/utils/streak.js (this file is also loaded standalone by tests)
  // Day streak is capped at 5; a yesterday that didn't count (fewer than `min` tasks or no Start Day) means the streak was reset to 0.
  const streak = counted ? Math.min(STREAK_CAP, Number(s.streak) || 0) : 0;
  const hadStreak = (Number(s.streak) || 0) > 0;
  const streakStatus = counted ? `🔥 ${streak}/${STREAK_CAP} day streak alive` : (hadStreak ? `💀 yesterday didn't count (${done}/${min}) — streak reset to 0/${STREAK_CAP}` : `💀 no active streak (0/${STREAK_CAP})`);
  const slipped = (yesterdayTasks || []).filter((t) => t && !t.completed && t.status !== 'pending').map((t) => t.title).slice(0, 5);
  const pending = [...(yesterdayTasks || []), ...(todayTasks || [])].filter((t) => t?.status === 'pending')
    .filter((t, i, a) => a.findIndex((x) => x.title === t.title) === i)
    .map((t) => ({ title: t.title, on: t.pendingOn || '', days: daysSince(t.pendingSince || t.createdAt, now) })).slice(0, 5);
  const top3 = topForToday(todayTasks);
  const lines = [`Yesterday: ${done}/${min} done${done >= min ? ' ✅' : ''}`, streakStatus];
  if (slipped.length) lines.push(`Slipped: ${slipped.join(', ')}`);
  if (pending.length) lines.push(`Waiting: ${pending.map((p) => `${p.title}${p.on ? ` (${p.on})` : ''}${p.days != null ? ` ${p.days}d` : ''}`).join(', ')}`);
  if (top3.length) lines.push(`Top 3 today: ${top3.map((t, i) => `${i + 1}. ${t}`).join('  ')}`);
  return { yesterday, done, min, counted, streak, streakStatus, slipped, pending, top3, text: lines.join('\n'), title: `☀️ Morning report: ${done}/${min} yesterday` };
};
