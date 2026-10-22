// Simple Pro gating helper. ENFORCE_PAYWALL=false keeps every feature unlocked for now.
export const ENFORCE_PAYWALL = false;
export const isPro = (userDoc) => {
  if (!userDoc) return false;
  if (userDoc.plan === 'lifetime' && userDoc.isPro) return true;
  if (!userDoc.isPro) return false;
  const e = userDoc.proExpiresAt; const exp = e?.toDate ? e.toDate() : e ? new Date(e) : null;
  return !exp || exp > new Date();
};
export const PRO_FEATURES = ['aiCoach', 'strictBoss', 'calendarFeed', 'unlimitedRoutines'];
// Usage later: if (!canUse(userDoc, 'aiCoach')) router.push('/paywall')
export const canUse = (userDoc, feature) => !ENFORCE_PAYWALL || !PRO_FEATURES.includes(feature) || isPro(userDoc);
