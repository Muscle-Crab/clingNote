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
  return `Hey. You've got ${plural(overdue.length, 'overdue task')}. ${list(top)}${overdue.length > 2 ? ', and more' : ''}. Knock it out now.`;
}

// week: [{ label:'Mon', planned, done, points, today:bool }] oldest -> today
export function morningLine({ week = [], streak = 0, streakMin = 5, mode = 'user', people = [], todayTasks = [] }) {
  const past = week.filter((d) => !d.today);
  const y = past[past.length - 1];
  const out = ['Good morning. Here is your report.'];
  if (y) out.push(y.planned ? `Yesterday you finished ${y.done} of ${y.planned}${y.done >= y.planned ? '. Clean sweep. Nice.' : `. ${y.planned - y.done} slipped.`}` : 'Yesterday you had nothing planned.');
  const tot = past.reduce((s, d) => s + d.done, 0); const plan = past.reduce((s, d) => s + d.planned, 0);
  if (past.length >= 2) {
    out.push(`The chart shows the last ${past.length} days. Blue bars are tasks done, the outline is what you planned. ${tot} of ${plan} done this week.`);
    const best = past.reduce((b, d) => (d.done > b.done ? d : b), past[0]);
    if (best.done) out.push(`Best day was ${best.label}, with ${best.done}.`);
    const misses = past.filter((d) => d.planned && d.done < d.planned).length;
    if (misses) out.push(`You came up short on ${plural(misses, 'day')}.`);
    const half = Math.floor(past.length / 2); const a = past.slice(0, half).reduce((s, d) => s + d.done, 0) / (half || 1); const b = past.slice(half).reduce((s, d) => s + d.done, 0) / ((past.length - half) || 1);
    out.push(b > a + 0.5 ? 'Trend is up. Keep pushing.' : b < a - 0.5 ? 'Trend is down. Time to tighten up.' : 'Holding steady.');
  }
  out.push(streak > 0 ? `Your streak is ${streak} of 5. Finish ${streakMin} today to keep it.` : `No streak right now. Finish ${streakMin} tasks today to start one.`);
  const open = todayTasks.filter(live);
  if (open.length) out.push(`Today: ${plural(open.length, 'task')}. ${list(open.slice(0, 3).map((t) => t.title))}${open.length > 3 ? ', and more' : ''}.`);
  else out.push('Nothing on today yet. Add your tasks.');
  if (mode === 'manager' || people.length) {
    const late = people.filter((p) => p.overdue > 0);
    if (people.length) out.push(late.length ? `Your team: ${list(late.slice(0, 3).map((p) => p.ownerName))} ${late.length === 1 ? 'is' : 'are'} behind.` : `Your team of ${people.length} is on track.`);
  }
  out.push("Let's go.");
  return out.join(' ');
}

export const MORNING_FROM = 5; export const MORNING_TO = 12; export const OVERDUE_THROTTLE_MS = 30 * 60 * 1000;
export const morningDue = (today, hour, last) => hour >= MORNING_FROM && hour < MORNING_TO && last !== today;
export const overdueDue = (nowMs, lastMs) => !lastMs || nowMs - Number(lastMs) >= OVERDUE_THROTTLE_MS;
