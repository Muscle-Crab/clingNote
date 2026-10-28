// Siri / Shortcuts "Add task" drain: ONE central, single-flight entry point (2026-10-28).
// Triggers: app launch + sign-in, Capacitor appStateChange(isActive)/resume, HomeView mount / today loaded / visibilitychange.
// Every trigger goes through runIntentDrain(): native takeIntents() -> localStorage buffer (lossless, deduped by id) -> the
// registered saver (HomeView: the normal add path with limits/points). Concurrent triggers coalesce into one rerun, so the
// buffer is never read and rewritten by two drains at once (that is what could duplicate or lose a voice-added task).
import { mergeIntents, readBuffer, writeBuffer } from '@/utils/intentQueue';

let handler = null; let running = null; let rerun = false;
export const registerIntentHandler = (fn) => { handler = fn; return () => { if (handler === fn) handler = null; }; };
export const hasIntentHandler = () => !!handler;

// Moves native queue items into the persistent buffer. Returns the buffer length.
export const pullNativeIntents = async ({ take, store }) => {
  let buf = readBuffer(store);
  try { const r = await take(); const items = (r && r.items) || []; if (items.length) { buf = mergeIntents(buf, items); writeBuffer(store, buf); } } catch (e) { console.warn('takeIntents', e && e.message); }
  return buf.length;
};

export const runIntentDrain = (deps, reason = '') => {
  if (running) { rerun = true; return running; }
  running = (async () => {
    let pending = 0;
    try {
      do { rerun = false; pending = await pullNativeIntents(deps); if (pending && handler) { await handler(reason); pending = readBuffer(deps.store).length; } } while (rerun);
    } finally { running = null; }
    return pending;
  })();
  return running;
};

// Not on Home (HomeView not mounted) with tasks waiting: open Home so they are saved and shown. Never interrupts auth/onboarding/paywall/lock flows.
const BLOCK = /^\/(login|welcome|landing|onboarding|paywall|pro\/|gate|subs|payment)/;
export const shouldOpenHome = ({ pending, hasHandler, signedIn, path }) => !!(pending > 0 && !hasHandler && signedIn && !BLOCK.test(String(path || '/')));

// main.js (native iOS only): launch, sign-in and every return to foreground.
export const installIntentDrain = ({ CapApp, router, onSignedIn, signedIn, take, store }) => {
  const kick = async (reason) => {
    const pending = await runIntentDrain({ take, store }, reason);
    const path = router.currentRoute && router.currentRoute.value ? router.currentRoute.value.path : '/';
    if (shouldOpenHome({ pending, hasHandler: hasIntentHandler(), signedIn: signedIn(), path })) router.push('/home').catch(() => {});
  };
  CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) kick('active'); });
  CapApp.addListener('resume', () => kick('resume'));
  onSignedIn(() => setTimeout(() => kick('launch'), 1200));
  return kick;
};
