// Pure state for the persistent 8-hour pill and where the chrome shows (kept out of the component so it can be tested).
export const PILL_ROUTES = ['home', 'upcoming', 'rankings', 'discipline', 'procrastination-log', 'gate', 'pals', 'addiction', 'manager', 'manager-home', 'manager-person'];
// Hard-stop overlay: the user's own task screens. Manager screens stay usable read-only (team view, awards), and sign-in, onboarding,
// paywall/subs, settings/profile, legal and support are never covered (App Store review + subscription must keep working).
export const SHUT_ROUTES = ['home', 'upcoming', 'rankings', 'discipline', 'procrastination-log', 'gate', 'pals', 'addiction'];
export const SEEN_KEY = 'clingnote.ehSeen.v1';

export const pillState = ({ phase, running, countdown, startsLabel, hasPlan, shut, untilLabel, earned = 0, target = 0, pace = null }) => {
  if (shut) return { kind: 'shut', main: 'Shut', sub: untilLabel ? `till ${untilLabel}` : '', aria: `ClingNote is shut until ${untilLabel || 'tomorrow'}` };
  if (running) {
    const risk = pace && target > 0 && earned < target && pace.leftMs <= 2 * 3600000;
    return { kind: risk ? 'risk' : 'run', main: countdown, sub: target > 0 ? `${earned}/${target}` : '', aria: `8-hour day: ${countdown} left, ${earned} of ${target} points` };
  }
  if (!hasPlan) return null;
  if (phase === 'before') return { kind: 'before', main: `Starts ${startsLabel}`, sub: '', aria: `8-hour day starts at ${startsLabel}` };
  if (phase === 'ready') return { kind: 'before', main: 'Ready to start', sub: '', aria: '8-hour day ready to start' };
  return null; // ended without a started day / loading: nothing to show
};
