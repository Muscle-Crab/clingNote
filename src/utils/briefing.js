// Pure helpers for the boss briefing (overdue alert + morning report with a 7-day chart). No Firebase here, so it is testable.
const hm = (d) => d.getHours() * 60 + d.getMinutes();
const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const live = (t) => t && !t.completed && t.status !== 'wontdo' && t.status !== 'wont-do';

// Today's overdue = open tasks whose reminder time passed, or every open task once the daily deadline passed.
export function overdueTasks(todayTasks = [], now = new Date(), deadline = null) {
  const n = hm(now); const dl = toMin(deadline);
  return todayTasks.filter(live).filter((t) => { const r = toMin(t.reminder && t.reminder.time); return (r != null && r < n) || (dl != null && dl < n); });
}

const list = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function overdueLine({ mode = 'user', overdue = [], people = [] }) {
  if (mode === 'manager') {
    const late = people.filter((p) => p.overdue > 0);
    if (!late.length) return '';
    return `Heads up. ${list(late.slice(0, 3).map((p) => `${p.ownerName} has ${plural(p.overdue, 'overdue task')}`))}${late.length > 3 ? `, plus ${late.length - 3} more` : ''}. Give them a ping.`;
  }
  if (!overdue.length) return '';
  const top = overdue.slice(0, 2).map((t) => t.title);
  return `Hey. You've got ${plural(overdue.length, 'overdue task')}. ${list(top)}${overdue.length > 2 ? ', and more' : ''}. Let's knock ${overdue.length === 1 ? 'it' : 'them'} out now.`;
}

const FULLDAY = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
const spokenTime = (s) => { const m = toMin(s); if (m == null) return ''; const h = Math.floor(m / 60); const mm = m % 60; const h12 = ((h + 11) % 12) + 1;
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'A M' : 'P M'}`; };

// Part 1 of the morning report: how yesterday went (+ the week chart). Fresh-start line when there is no history yet.
// week: [{ label:'Mon', planned, done, points, today:bool }] oldest -> today
export function recapLine({ week = [] }) {
  const past = week.filter((d) => !d.today); const y = past[past.length - 1];
  const plan = past.reduce((s, d) => s + d.planned, 0); const tot = past.reduce((s, d) => s + d.done, 0);
  if (!plan) return "First, yesterday. There's no history yet, so this is a fresh start. Today sets the bar.";
  const out = ['First, how yesterday went.'];
  if (!y || !y.planned) out.push('Yesterday you had nothing planned.');
  else if (y.done >= y.planned) out.push(`You finished all ${y.planned} of ${y.planned}. Clean sweep. Nice work.`);
  else if (!y.done) out.push(`You finished none of your ${y.planned} tasks. That's okay. We'll fix it today.`);
  else out.push(`You finished ${y.done} of ${y.planned}. ${y.planned - y.done} slipped, so let's pick those up.`);
  if (past.length >= 2) {
    out.push(`On the chart, the last ${past.length} days: ${tot} of ${plan} done.`);
    const best = past.reduce((b, d) => (d.done > b.done ? d : b), past[0]);
    if (best.done) out.push(`Best day was ${FULLDAY[best.label] || best.label}, with ${best.done}.`);
    const misses = past.filter((d) => d.planned && d.done < d.planned).length;
    if (misses) out.push(`You came up short on ${plural(misses, 'day')}.`);
    const half = Math.floor(past.length / 2); const a = past.slice(0, half).reduce((s, d) => s + d.done, 0) / (half || 1); const b = past.slice(half).reduce((s, d) => s + d.done, 0) / ((past.length - half) || 1);
    out.push(b > a + 0.5 ? "Trend's up. Nice." : b < a - 0.5 ? "Trend's down. Let's tighten things up." : 'Holding steady.');
  }
  return out.join(' ');
}

// Part 2: the plan for today: what is on, what is timed, the deadline, and what it takes to keep the streak.
export function planLine({ streak = 0, streakMin = 5, todayTasks = [], deadline = null, mode = 'user', people = [] }) {
  const open = todayTasks.filter(live); const doneToday = todayTasks.filter((t) => t && t.completed).length;
  const out = ["Now, today's plan."];
  if (open.length) {
    out.push(`You've got ${plural(open.length, 'task')} open: ${list(open.slice(0, 3).map((t) => t.title))}${open.length > 3 ? `, and ${open.length - 3} more` : ''}.`);
    const timed = open.filter((t) => toMin(t.reminder && t.reminder.time) != null).sort((x, y) => toMin(x.reminder.time) - toMin(y.reminder.time));
    if (timed.length) out.push(`First timed task: ${timed[0].title} at ${spokenTime(timed[0].reminder.time)}.`);
  } else out.push("Nothing's on today yet. Add your tasks, at least five.");
  if (deadline && spokenTime(deadline)) out.push(`Everything's due by ${spokenTime(deadline)}.`);
  const need = Math.max(0, streakMin - doneToday);
  out.push(need === 0 ? `You've already hit ${streakMin} today. Streak's safe.` : streak > 0 ? `Your streak is ${streak}. Finish ${need} more today to keep it.` : `Finish ${need} today to start a streak.`);
  if (mode === 'manager' || people.length) {
    const late = people.filter((p) => p.overdue > 0);
    if (people.length) out.push(late.length ? `Your team: ${list(late.slice(0, 3).map((p) => p.ownerName))} ${late.length === 1 ? 'is' : 'are'} behind. Give them a ping.` : `Your team of ${people.length} is on track.`);
  }
  out.push("Let's go.");
  return out.join(' ');
}

export function morningLine(o) { return `Good morning. Here's your report. ${recapLine(o)} ${planLine(o)}`; }

// The first report doubles as onboarding: it is due right after onboarding (any hour) until the intro was heard.
export const introKey = (mode) => (mode === 'manager' ? 'br_intro_manager' : 'br_intro');

export const MORNING_FROM = 5; export const MORNING_TO = 12; export const OVERDUE_THROTTLE_MS = 30 * 60 * 1000;
export const morningDue = (today, hour, last) => hour >= MORNING_FROM && hour < MORNING_TO && last !== today;
export const overdueDue = (nowMs, lastMs) => !lastMs || nowMs - Number(lastMs) >= OVERDUE_THROTTLE_MS;
