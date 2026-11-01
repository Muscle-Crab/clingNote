// Entry order for ClingNote (pure logic, unit-tested in scripts/test-entry-guard.js; the router guard only gathers inputs and applies the result):
//   NEW user:      onboarding tutorial (/welcome, unauthenticated, once per install, no skip) -> sign in with Apple/Google (first sign-in creates the account + users doc; no email sign-up) -> post-signup setup + PAYWALL (/onboarding) -> app (/home)
//   EXISTING user: straight to /home. The paywall is shown at most ONCE (only if not Pro and never seen/dismissed), and stays reachable from Subs / Profile ("See plans" -> /paywall).
export const TUTORIAL_KEY = 'clingnote.tutorialSeen.v1';
export const paywallKey = (uid) => `clingnote.paywallSeen.v1.${uid}`;
export const ENTRY_PATHS = ['/', '/home'];

const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
export const hasSeenTutorial = () => { const s = ls(); try { return !!(s && s.getItem(TUTORIAL_KEY) === '1'); } catch (e) { return false; } };
export const markTutorialSeen = () => { const s = ls(); try { if (s) s.setItem(TUTORIAL_KEY, '1'); } catch (e) { /* private mode */ } };
export const hasSeenPaywallLocal = (uid) => { const s = ls(); try { return !!(s && uid && s.getItem(paywallKey(uid)) === '1'); } catch (e) { return false; } };
export const markPaywallSeenLocal = (uid) => { const s = ls(); try { if (s && uid) s.setItem(paywallKey(uid), '1'); } catch (e) { /* ignore */ } };

// The one-time paywall for accounts that did not go through the new-signup flow (existing users).
// Fails OPEN-to-app: if the user doc could not be read (offline / error) we never block the app with a paywall.
export function shouldShowPaywallOnce({ isPro, seenLocal, seenRemote, docLoaded }) {
  if (!docLoaded) return false;
  if (isPro) return false;
  if (seenLocal || seenRemote) return false;
  return true;
}

// Returns null (continue) or a router location to redirect to.
//   to: { path, query }, user: truthy when signed in, native: Capacitor shell, tutorialSeen: bool,
//   paywall: { isPro, seenLocal, seenRemote, docLoaded, needsOnboarding } (only used for signed-in users on an entry path)
export function decideEntry({ to, user, native = false, tutorialSeen = false, paywall = null }) {
  const path = to.path; const q = to.query || {};
  if (!user) {
    if (path === '/welcome') return null;
    if (!tutorialSeen) {
      if (path === '/login' && native && q.returning !== '1') return { path: '/welcome' };
      if (path === '/' && native) return { path: '/welcome' };
      if (path === '/home') return { path: '/welcome' };
    }
    return null;
  }
  // signed in
  if (path === '/welcome') return q.new === '1' && !tutorialSeen ? null : { path: '/home' };
  // A new Apple/Google account (users doc onboardingComplete === false) that has not reached the paywall step yet -> post-signup setup.
  if (ENTRY_PATHS.includes(path) && paywall && paywall.docLoaded && paywall.needsOnboarding && !paywall.isPro && !paywall.seenLocal && !paywall.seenRemote) return { path: '/onboarding' };
  if (ENTRY_PATHS.includes(path) && paywall && shouldShowPaywallOnce(paywall)) return { path: '/paywall', query: { from: '/home', once: '1' } };
  return null;
}
