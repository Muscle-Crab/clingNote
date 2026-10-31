// B44 pomodoro preset for the focus timer: 25 min focus / 5 min break, 4 rounds (research "pomo": preset chip in the timer sheet,
// phase shown on the lock-screen Live Activity). Pure; the task carries timerPomo { work, brk, rounds, round, phase }.
// When a phase's timer ends, HomeView's countdown watcher calls nextPomoPatch instead of expiring the task; after the last
// focus round it returns null and the timer ends exactly like a plain one.
export const POMO = Object.freeze({ work: 25, brk: 5, rounds: 4 });
const MIN = 60000;
const ms = (v) => { const n = typeof v === 'number' ? v : new Date(v || 0).getTime(); return Number.isFinite(n) ? n : 0; };

export const isPomo = (t) => !!(t && t.timerPomo && t.timerPomo.phase);
export const pomoTotalMinutes = (p = POMO) => p.work * p.rounds + p.brk * (p.rounds - 1);

// fields for a fresh pomodoro session (merged into the task by startTimer)
export const startPomoPatch = (now = Date.now(), p = POMO) => ({
  timerPomo: { work: p.work, brk: p.brk, rounds: p.rounds, round: 1, phase: 'work' },
  timerStartedAt: new Date(now).toISOString(), timerEndTime: new Date(now + p.work * MIN).toISOString(), timerDurationMinutes: p.work, timerPausedAt: null,
});

// The current phase ended (timerEndTime <= now). -> patch for the next phase, or null when the session is over.
// Phases are back-to-back from the previous end, so a phase missed while the app was closed is skipped, not restarted.
export const nextPomoPatch = (t, now = Date.now()) => {
  if (!isPomo(t)) return null;
  let { work, brk, rounds, round, phase } = t.timerPomo; let end = ms(t.timerEndTime) || now;
  for (let guard = 0; guard < 20; guard++) {
    if (phase === 'work') { if (round >= rounds) return null; phase = 'break'; end += brk * MIN; }
    else { phase = 'work'; round += 1; end += work * MIN; }
    if (end > now) return { timerPomo: { work, brk, rounds, round, phase }, timerStartedAt: new Date(end - (phase === 'work' ? work : brk) * MIN).toISOString(), timerEndTime: new Date(end).toISOString(), timerDurationMinutes: phase === 'work' ? work : brk, timerPausedAt: null };
  }
  return null;
};

// "Focus 2/4" | "Break 2/4" (Live Activity caption + task row), '' when not a pomodoro
export const pomoLabel = (t) => (isPomo(t) ? `${t.timerPomo.phase === 'break' ? 'Break' : 'Focus'} ${t.timerPomo.round}/${t.timerPomo.rounds}` : '');
