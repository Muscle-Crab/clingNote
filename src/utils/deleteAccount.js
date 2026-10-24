import { fnUrl } from '@/config/api';
// Client side of in-app account deletion (App Store 5.1.1(v)). Re-authenticates when needed, then asks the server
// (netlify/functions/delete-account.js, Admin SDK) to erase Firestore data, Storage files and the Firebase Auth user.
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { reauthWithGoogle } from '@/utils/googleAuth';
import { auth } from '@/firebaseConfig';
import { isNativeIOS } from '@/utils/platform';
import { reauthWithApple, userHasAppleProvider, userHasPasswordProvider, userHasGoogleProvider } from '@/utils/appleAuth';

// Which re-auth the user needs: 'password' | 'apple' | 'google' | 'none' (unknown provider: rely on the server's recent-login check)
export const reauthMethod = (user = auth.currentUser) => {
  if (userHasPasswordProvider(user)) return 'password';
  if (userHasAppleProvider(user) && isNativeIOS()) return 'apple';
  if (userHasGoogleProvider(user)) return 'google';
  return 'none';
};

const callDelete = async (user, appleAuthorizationCode) => {
  const token = await user.getIdToken(true); // fresh token carries the new auth_time after re-auth
  const r = await fetch(fnUrl('delete-account'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(appleAuthorizationCode ? { appleAuthorizationCode } : {}) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
};

// opts: { password } for email/password accounts. Resolves { ok:true } or { ok:false, message, needsPassword? }.
export async function deleteMyAccount(opts = {}) {
  const user = auth.currentUser;
  if (!user) return { ok: false, message: 'You are signed out. Sign in again first.' };
  try {
    let code = '';
    const method = reauthMethod(user);
    if (method === 'password') {
      if (!opts.password) return { ok: false, needsPassword: true, message: 'Enter your password to confirm.' };
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, opts.password));
    } else if (method === 'apple') {
      code = await reauthWithApple(user);
    } else if (method === 'google') {
      await reauthWithGoogle(user);
    }
    const res = await callDelete(user, code);
    if (!res.ok) {
      if (res.data?.code === 'reauth-required') return { ok: false, message: 'For your security, please sign out, sign in again, and then delete your account.' };
      return { ok: false, message: res.data?.error || 'Could not delete your account. Please try again.' };
    }
    try { await auth.signOut(); } catch (e) { /* the Auth user is already gone server-side */ }
    return { ok: true, iapNote: res.data?.iapNote || '' };
  } catch (e) {
    const c = e?.code || '';
    if (c === 'auth/wrong-password' || c === 'auth/invalid-credential') return { ok: false, needsPassword: true, message: 'That password is incorrect.' };
    if (/1001|cancel|popup-closed/i.test(c + (e?.message || ''))) return { ok: false, message: '' }; // user dismissed the re-auth sheet
    if (c === 'auth/too-many-requests') return { ok: false, message: 'Too many attempts. Try again later.' };
    console.error('[delete-account]', c || e?.message);
    return { ok: false, message: 'Could not delete your account. Please try again.' };
  }
}
