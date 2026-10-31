// Pure state for the persistent day-countdown pill and where the chrome shows (kept out of the component so it can be tested).
export const PILL_ROUTES = ['home', 'upcoming', 'rankings', 'discipline', 'procrastination-log', 'gate', 'pals', 'addiction', 'manager', 'manager-home', 'manager-person'];
// Hard-stop overlay: the user's own task screens. Manager screens stay usable read-only (team view, awards), and sign-in, onboarding,
// paywall/subs, settings/profile, legal and support are never covered (App Store review + subscription must keep working).
export const SHUT_ROUTES = ['home', 'upcoming', 'rankings', 'discipline', 'procrastination-log', 'gate', 'pals', 'addiction'];
export const SEEN_KEY = 'clingnote.ehSeen.v1';

// wrapped/allDone come from Home's legacy day session (homeDay); lockInOn=false hides the plan pills (no lock offered at all).
export const pillState = ({ phase, running, countdown, startsLabel, hasPlan, shut, untilLabel, earned = 0, target = 0, pace = null, hours = 8, wrapped = false, allDone = false, lockInOn = true, nextLabel = '' }) => {
  const hl = String(Math.round((Number(hours) || 8) * 2) / 2); // "6.5" -> "your 6.5-hour day"
  if (shut) return { kind: 'shut', main: 'Shut', sub: untilLabel ? `till ${untilLabel}` : '', aria: `ClingNote is shut until ${untilLabel || 'tomorrow'}` };
  if (running) {
    const risk = pace && target > 0 && earned < target && pace.leftMs <= 2 * 3600000;
    return { kind: risk ? 'risk' : 'run', main: countdown, sub: target > 0 ? `${earned}/${target}` : '', aria: `${hl}-hour day: ${countdown} left, ${earned} of ${target} points` };
  }
  if (phase === 'gap' && nextLabel) return { kind: 'before', main: `Next ${nextLabel}`, sub: '', aria: `Next lock-in starts at ${nextLabel}` }; // evening mode: open until the next block
  if (wrapped) return { kind: 'done', main: 'Day wrapped', sub: '', aria: 'Day wrapped' };
  if (allDone) return { kind: 'done', main: 'All done', sub: '', aria: 'All tasks done today' };
  if (!hasPlan || !lockInOn) return null;
  if (phase === 'before') return { kind: 'before', main: `Starts ${startsLabel}`, sub: '', aria: `${hl}-hour day starts at ${startsLabel}` };
  if (phase === 'ready' && countdown && countdown !== '00:00:00') return { kind: 'run', main: countdown, sub: 'add tasks', aria: `${hl}-hour day: ${countdown} left, started at your wake time` };
  if (phase === 'ready') return { kind: 'before', main: 'Ready to start', sub: '', aria: `${hl}-hour day ready to start` };
  return null; // ended without a started day / loading: nothing to show
};
