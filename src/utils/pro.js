// Simple Pro gating helper. ENFORCE_PAYWALL=true: PRO_FEATURES require an active Pro plan.
export const ENFORCE_PAYWALL = true;
export const isPro = (userDoc) => {
  if (!userDoc) return false;
  if (userDoc.plan === 'lifetime' && userDoc.isPro) return true;
  if (!userDoc.isPro) return false;
  const e = userDoc.proExpiresAt; const exp = e?.toDate ? e.toDate() : e ? new Date(e) : null;
  return !exp || exp > new Date();
};
// unlimitedRoutines is listed but NOT enforced anywhere yet (task-count limits pending decision).
export const PRO_FEATURES = ['aiCoach', 'strictBoss', 'calendarFeed', 'unlimitedRoutines'];
// Usage later: if (!canUse(userDoc, 'aiCoach')) router.push('/paywall')
export const canUse = (userDoc, feature) => !ENFORCE_PAYWALL || !PRO_FEATURES.includes(feature) || isPro(userDoc);
