// Robot coach "report" the user gets on app open/resume and short acknowledgements on completion.
// Pure (no Vue/Firebase) so it is unit-tested in scripts/test-sergeant.mjs.
import { overdueTasks } from './briefing.js';
// Same identity as localNotify.taskKeyOf (kept inline so this stays importable from node tests).
export const taskKeyOf = (t) => (t && (t.id || `${t.createdAt?.seconds ?? t.createdAt ?? ''}|${t.title || ''}`)) || '';

const pick = (arr, seed) => arr[Math.abs(Math.floor(seed)) % arr.length];
const live = (t) => t && !t.completed && !t.deleted;
const hm = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const timeOf = (t) => hm(t.startTime) ?? hm(t.reminder && t.reminder.time);
export const fmtLeft = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h}h${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
const short = (s, n = 28) => { const t = String(s || 'that task').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// Next up: earliest timed open task, else the first open task in list order.
export function nextUp(tasks = []) {
  const open = tasks.filter(live);
  const timed = open.filter((t) => timeOf(t) != null).sort((a, b) => timeOf(a) - timeOf(b));
  return timed[0] || open[0] || null;
}

export const REPORT_LINES = {
  overdue1: ["{t} is overdue. Let's knock it out now.", "Heads up, {t} slipped past its time. Can you take it on right now?", "{t} was due already. Let's get it done before anything else."],
  overdueN: ["You've got {n} overdue. Start with {t}, and we'll go from there.", "{n} tasks are overdue. Let's clear {t} first."],
  next: ["Next up is {t}.", "Let's do {t} next.", "{t} is next. You've got this."],
  pointsBehind: ["You're at {e} of {g} points. A little behind, but you can close it.", "{e} out of {g} points so far. Let's keep chipping away."],
  pointsMet: ["You hit your target. {e} of {g} points. Nice.", "{e} points, and your target was {g}. Great work. Keep it going."],
  streak: ["You're on a {s}-day streak. Let's keep it alive.", "{s} days in a row. Don't break it now."],
  streak0: ["No streak yet. Today's a good day to start one."],
  locked: ["You're {el} in, with {left} to go. Make it count.", "{el} down, {left} left. Stay with it."],
  notStarted: ["Your day hasn't started yet. Tap start when you're ready to go.", "The clock isn't running yet. Let's start your day."],
  ended: ["That's a wrap for today. Get some rest, and I'll see you tomorrow."],
  noTasks: ["Your list is empty. Add a few tasks, and let's get moving."],
  atEase: ["Everything's done. Nice work today.", "That's all of them. Take a breather, you earned it.", "Clean sweep. I'm proud of you."],
  ack: ["Nice. On to the next one.", "Done. Great job.", "That's how it's done.", "Checked off. Keep going.", "One down. Nice.", "Good work. What's next?"],
  ackLast: ["That was the last one. Great job today.", "All done. You crushed it today."],
};
const L = REPORT_LINES;
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));

/**
 * @param {object} o
 *   tasks: today's tasks; now: Date; deadline: 'HH:MM'|null
 *   phase: '8-hour' phase ('before'|'ready'|'running'|'ended'|...); lock: { startMs, endMs } | null; nowMs: number
 *   earned, target: points; streak: number; seed: number for line variety
 * @returns {{ lines: {kind,text}[], speech: string, prompts: {id,label,taskKey?}[], atEase: boolean, stats: object }}
 */
export function buildReport(o = {}) {
  const now = o.now || new Date(); const nowMs = o.nowMs ?? now.getTime(); const seed = o.seed ?? nowMs / 60000;
  const tasks = (o.tasks || []).filter((t) => t && !t.deleted);
  const open = tasks.filter(live);
  const overdue = overdueTasks(tasks, now, o.deadline || null);
  const next = nextUp(tasks.filter((t) => !overdue.includes(t))); // overdue ones get their own line + prompt
  const earned = Number(o.earned) || 0; const target = Number(o.target) || 0; const streak = Number(o.streak) || 0;
  const running = o.phase === 'running' && o.lock && o.lock.endMs > nowMs;
  const lines = []; const prompts = []; const add = (kind, arr, v = {}) => lines.push({ kind, text: fill(pick(arr, seed + lines.length), v) });

  if (!tasks.length) add('empty', L.noTasks);
  if (overdue.length === 1) add('overdue', L.overdue1, { t: short(overdue[0].title) });
  else if (overdue.length > 1) add('overdue', L.overdueN, { n: overdue.length, t: short(overdue[0].title) });
  if (overdue.length) prompts.push({ id: 'open-task', label: `Open ${short(overdue[0].title, 22)}`, taskKey: taskKeyOf(overdue[0]) });
  if (next) add('next', L.next, { t: short(next.title) });
  if (running) add('lock', L.locked, { el: fmtLeft(nowMs - o.lock.startMs), left: fmtLeft(o.lock.endMs - nowMs) });
  else if (o.phase === 'ended') add('lock', L.ended);
  else if (o.phase && o.phase !== 'loading' && tasks.length) { add('lock', L.notStarted); prompts.unshift({ id: 'start-day', label: 'Start day · confirm lock' }); }
  if (target > 0) add('points', earned >= target ? L.pointsMet : L.pointsBehind, { e: earned, g: target });
  add('streak', streak > 0 ? L.streak : L.streak0, { s: streak });
  if (next && !(next.reminder && next.reminder.time) && o.phase !== 'ended') prompts.push({ id: 'set-reminder', label: `Remind me: ${short(next.title, 20)}`, taskKey: taskKeyOf(next) });

  const atEase = tasks.length > 0 && !open.length;
  if (atEase) { lines.length = 0; prompts.length = 0; add('atease', L.atEase); if (target > 0) add('points', L.pointsMet, { e: earned, g: target }); add('streak', streak > 0 ? L.streak : L.streak0, { s: streak }); }
  return { lines, speech: lines.map((l) => l.text).join(' '), prompts: prompts.slice(0, 3), atEase,
    stats: { overdue: overdue.length, left: open.length, total: tasks.length, earned, target, streak, next: next ? next.title : '', lockLeft: running ? fmtLeft(o.lock.endMs - nowMs) : '' } };
}

export const ackLine = ({ left = 1, seed = Date.now() / 1000 } = {}) => pick(left <= 0 ? L.ackLast : L.ack, seed);
export const REPORT_THROTTLE_MS = 30 * 60 * 1000;
export const reportDue = (nowMs, lastMs) => !lastMs || nowMs - Number(lastMs) >= REPORT_THROTTLE_MS;
