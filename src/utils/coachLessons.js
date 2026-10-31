// Interactive coach (plan "Onboarding & guided tutorial"): one lesson at a time, only when relevant.
// Each step spotlights ONE element (selector), says one short sergeant line + a one-line caption, and waits for a real
// action signal (`until`) before advancing. No timers, no Next button. Skip ends it; "Skip all tips" stops future lessons.
// Lessons for features not built yet are queued here with enabled: false so they switch on when the feature ships.
export const LESSONS = [
  { id: 'sergeant', enabled: true, trigger: 'first-task-done', steps: [
    { target: '[data-coach="sergeant"]', line: 'Try it: press and hold my face.', caption: 'Keep your finger on me until the choices open. A quick tap opens chat instead.', until: 'menu-open' },
    { target: '[data-coach="sg-next"]', line: "Tap What's next.", caption: 'I pick the one task to do now.', until: 'sg-next' },
  ] },
  { id: 'replan', enabled: true, trigger: 'behind', steps: [
    { target: '[data-coach="sergeant"]', line: "You're behind. Press and hold my face.", caption: 'Your choices open.', until: 'menu-open' },
    { target: '[data-coach="sg-replan"]', line: 'Tap Replan.', caption: 'Moves your remaining tasks so the day still fits. Undo puts them back.', until: 'sg-replan' },
  ] },
  { id: 'holiday', enabled: true, trigger: 'friday', steps: [
    { target: '[data-coach="sergeant"]', line: 'Day off coming? Press and hold my face.', caption: 'Your choices open.', until: 'menu-open' },
    { target: '[data-coach="sg-off"]', line: "Tap I'm off.", caption: 'Pick one day or a whole holiday. Your streak stays safe.', until: 'sg-any' },
  ] },
  { id: 'critical', enabled: true, trigger: 'important-added', steps: [
    { target: '[data-coach="sergeant"]', line: 'Important one? Press and hold my face.', caption: 'Your choices open.', until: 'menu-open' },
    { target: '[data-coach="sg-critical"]', line: 'Tap Make critical.', caption: 'Marks your next task as critical so it stands out.', until: 'sg-critical' },
  ] },
  // Phase 2 lessons
  { id: 'boss-alarm', enabled: true, trigger: 'important-added', steps: [
    { target: '.task-card:not(.task-card--done) .task-more', line: 'Want me to ring? Tap the dots.', caption: 'Opens this task\'s actions.', until: 'task-menu-open' },
    { target: '[data-coach="bell"]', line: 'Tap the alarm clock.', caption: 'Rings like an alarm at the task time until you start it.', until: 'alarm-set' },
  ] },
  { id: 'hard-lock', enabled: true, trigger: 'lock-on', steps: [
    { target: '[data-coach="sergeant"]', line: 'Apps are locked. Press and hold my face.', caption: 'See how to get out in an emergency.', until: 'menu-open' },
    { target: '[data-coach="sg-unlock"]', line: 'This is the emergency exit.', caption: 'You type UNLOCK and it costs 25 points. Tap any choice to finish.', until: 'sg-any' },
  ] },
  { id: 'grow-scene', enabled: true, trigger: 'first-task-done', steps: [
    { target: '[data-coach="grow"]', line: 'Look: your scene grew.', caption: 'It grows with every point today. Full scene means goal reached. Tap it.', until: 'tap' },
  ] },
];
const KEY = (uid) => `cn.coach.${uid || 'anon'}`;
export const loadCoach = (uid, store = (typeof window !== 'undefined' ? window.localStorage : null)) => {
  try { const v = JSON.parse((store && store.getItem(KEY(uid))) || '{}'); return { done: Array.isArray(v.done) ? v.done : [], off: !!v.off }; } catch (e) { return { done: [], off: false }; }
};
export const saveCoach = (uid, st, store = (typeof window !== 'undefined' ? window.localStorage : null)) => { try { store && store.setItem(KEY(uid), JSON.stringify({ done: st.done || [], off: !!st.off })); } catch (e) { /* ignore */ } };
// Which lesson (if any) to run for a trigger. One at a time; done/disabled/skip-all never run. force = "Show me again".
export const lessonFor = (trigger, st, { force = false } = {}) => {
  if (!force && st && st.off) return null;
  return LESSONS.find((l) => l.enabled && l.trigger === trigger && (force || !(st && st.done.includes(l.id)))) || null;
};
export const replayable = () => LESSONS.filter((l) => l.enabled);
export const markDone = (st, id) => ({ ...st, done: [...new Set([...(st.done || []), id])] });
// Advance on a real signal: 'sg-any' matches any menu choice.
export const stepMatches = (step, signal) => !!step && (step.until === signal || (step.until === 'sg-any' && /^sg-/.test(signal)));
