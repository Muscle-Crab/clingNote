// Strict Boss Mode (on top of Discipline Mode). Pure helpers, no Firestore.
// Tone rule: tough on the work, never on the person. No insults, slurs or identity remarks.
import { deadlineAt } from './discipline';

export const IDLE_MINUTES = 30;
export const MIN_REASON = 8;
export const MAX_CARRY = 1;

const seedPick = (arr, seed = '') => arr[[...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0) % arr.length];

export const LINES = {
  morning: [
    'Morning. {min} tasks by {deadline}. No negotiations. Start with the hardest one.',
    'Orders for today: {min} tasks done before {deadline}. Clock starts now.',
    'New day, same standard. {min} tasks, {deadline} deadline. Move.',
  ],
  midday: [
    'It\'s past noon and you have {done} done. That\'s not a pace, that\'s a stall. Pick one and finish it.',
    'Midday check: {done}/{min}. I expected more by now. Close one task in the next 30 minutes.',
  ],
  evening: [
    'Warning: {left} left until {deadline} and you\'re at {done}/{min}. This is where the day is won or lost.',
    'Evening report: {done}/{min}. {left} remaining. No new plans. Finish what\'s open.',
  ],
  passed: ['Verdict: PASSED. You did what you said you would. Same again tomorrow.', 'PASSED. Standard met. Don\'t celebrate too long.'],
  failed: ['Verdict: FAILED. {done}/{min}. No excuses logged will change that. Tomorrow you start earlier.', 'FAILED. You knew the target. Reset, plan tonight, deliver tomorrow.'],
  idle: ['{open} tasks open and nothing\'s moved in {idle} minutes. Pick one. Start a timer. Now.', 'Focus check: {idle} minutes idle with {open} open. One task, start it.'],
  watching: ['Overdue: the boss is watching. Clear "{title}" before you add anything new.'],
};

export const fill = (tpl, v = {}) => tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
export const line = (kind, vars = {}, seed = '') => fill(seedPick(LINES[kind] || [''], seed), vars);

export const fmtLeft = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

// Which message the boss gives now. Returns null if nothing to say.
export const bossPhase = (now, today, deadline, done, min) => {
  const dl = deadlineAt(today, deadline).getTime(); const t = now.getTime(); const h = now.getHours();
  if (t >= dl) return 'verdict';
  if (done >= min) return null;
  if (dl - t <= 3 * 3600 * 1000 && h >= 17) return 'evening';
  if (h >= 12 && h < 17 && done < 2) return 'midday';
  if (h >= 5 && h < 12) return 'morning';
  return null;
};

export const bossMessage = (now, today, deadline, done, min) => {
  const phase = bossPhase(now, today, deadline, done, min);
  if (!phase) return null;
  const left = fmtLeft((deadlineAt(today, deadline).getTime() - now.getTime()) / 60000);
  const vars = { done, min, deadline, left };
  const kind = phase === 'verdict' ? (done >= min ? 'passed' : 'failed') : phase;
  return { phase, kind, text: line(kind, vars, today + kind) };
};

// "Why didn't you?" reason: real sentence, not "x" or "aaaaaaaa".
export const validReason = (r) => { const s = String(r || '').trim(); return s.length >= MIN_REASON && new Set(s.toLowerCase().replace(/\s/g, '')).size >= 4; };

// One free carry-over. The second marks it overdue / boss watching.
export const carryTask = (task) => {
  const carryCount = (task.carryCount || 0) + 1;
  const watching = carryCount > MAX_CARRY;
  return { ...task, carryCount, bossWatching: watching || !!task.bossWatching, overdue: watching || !!task.overdue };
};

export const isUrgent = (t) => t?.priority === 'high' || t?.urgent === true;
export const watchingBlockers = (tasks) => (tasks || []).filter((t) => t && t.bossWatching && !t.completed && t.status !== 'pending');
export const canAddTask = (tasks, newTask, strictOn) => {
  if (!strictOn || isUrgent(newTask)) return { ok: true };
  const b = watchingBlockers(tasks);
  return b.length ? { ok: false, blocker: b[0], message: line('watching', { title: b[0].title }) } : { ok: true };
};

export const isIdle = (lastActiveMs, nowMs, openCount, minutes = IDLE_MINUTES) => openCount > 0 && nowMs - lastActiveMs >= minutes * 60000;

// Daily verdict + grade
export const verdict = ({ done, min, total = 0 }) => {
  const passed = done >= min;
  const r = min > 0 ? done / min : 1;
  let grade;
  if (passed) grade = r >= 1.5 || (total > 0 && done >= total && done > min) ? 'A+' : total > 0 && done >= total ? 'A' : 'B';
  else grade = r >= 0.6 ? 'C' : r >= 0.3 ? 'D' : 'F';
  return { passed, grade, done, min };
};

export const strictDefaults = () => ({ strict: true, taskTarget: 5 });
