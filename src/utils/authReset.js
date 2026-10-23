// "Forgot password?" helpers (kept free of Firebase imports so they can be unit-tested). Deliberately NO actionCodeSettings / continue URL:
// Firebase then uses the project's default reset page, so sending can never fail on an unauthorised continue-URL domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (v) => String(v || '').trim();
export const isEmailish = (v) => EMAIL_RE.test(normalizeEmail(v));
export const RESET_ERRORS = {
  'auth/invalid-email': "That email address doesn't look right. Check it and try again.",
  'auth/missing-email': 'Enter your email address first.',
  'auth/too-many-requests': 'Too many requests. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
};
export const resetErrorMessage = (e) => RESET_ERRORS[e && e.code] || 'Could not send the reset email. Please try again.';
export const resetSentMessage = (email) => 'If an account exists for ' + normalizeEmail(email) + ', a reset link is on its way. Check your spam folder too.';
// -> { ok, field?, message }. `field: 'email'` means the caller should focus the email input.
export const requestPasswordReset = async (send, auth, rawEmail) => {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, field: 'email', message: 'Enter your email address above first, then tap Forgot password.' };
  if (!isEmailish(email)) return { ok: false, field: 'email', message: RESET_ERRORS['auth/invalid-email'] };
  try { await send(auth, email); return { ok: true, message: resetSentMessage(email) }; }
  catch (e) {
    if (e && e.code === 'auth/user-not-found') return { ok: true, message: resetSentMessage(email) }; // don't reveal which emails have accounts
    return { ok: false, message: resetErrorMessage(e), code: e && e.code };
  }
};
export const loginErrorMessage = (e) => (e && e.code === 'auth/too-many-requests' ? RESET_ERRORS['auth/too-many-requests'] : e && e.code === 'auth/network-request-failed' ? RESET_ERRORS['auth/network-request-failed'] : 'Invalid Credentials');
