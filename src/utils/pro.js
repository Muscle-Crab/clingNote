// Simple Pro gating helper. ENFORCE_PAYWALL=true: PRO_FEATURES require an active Pro plan.
export const ENFORCE_PAYWALL = true;
export const isPro = (userDoc) => {
  if (!userDoc) return false;
  if (userDoc.plan === 'lifetime' && userDoc.isPro) return true;
  if (!userDoc.isPro) return false;
  const e = userDoc.proExpiresAt; const exp = e?.toDate ? e.toDate() : e ? new Date(e) : null;
  return !exp || exp > new Date();
};
// Paywall guard: FREE = the basics of a task list. Everything else is ClingNote Pro (RevenueCat entitlement 'pro':
// clingnote_pro_monthly / _yearly / _lifetime). canUse() is default-deny: any feature name not in FREE_FEATURES needs Pro.
export const FREE_FEATURES = Object.freeze(['tasks', 'editTask', 'completeTask', 'startDay', 'settings', 'account', 'onboarding', 'paywall']);
export const PRO_FEATURES = Object.freeze(['aiCoach', 'ask', 'voice', 'breakdown', 'strictBoss', 'points', 'calendarFeed', 'calendar', 'community', 'friends',
  'lockIn', 'appLock', 'focus', 'timer', 'breaks', 'templates', 'background', 'checkin', 'widget', 'routines', 'unlimitedRoutines', 'discipline', 'recovery']);
export const canUse = (userDoc, feature) => !ENFORCE_PAYWALL || FREE_FEATURES.includes(feature) || isPro(userDoc);
