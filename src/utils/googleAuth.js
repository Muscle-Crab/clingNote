// Google sign-in. Web: Firebase popup (unchanged). iOS shell: Google blocks OAuth inside WKWebView,
// so use the native Google Sign-In SDK (@capacitor-firebase/authentication, skipNativeAuth) to get an
// ID token, then sign into the Firebase JS SDK with GoogleAuthProvider.credential(idToken) so the rest
// of the app (Firestore user doc, onboarding, RevenueCat logIn) sees a normal Firebase JS user.
import { GoogleAuthProvider, signInWithPopup, signInWithCredential, reauthenticateWithPopup, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { isNativeIOS } from '@/utils/platform';

async function nativeGoogleCredential() {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const idToken = res?.credential?.idToken;
  if (!idToken) throw Object.assign(new Error('Google sign-in returned no ID token'), { code: 'google/no-token' });
  return GoogleAuthProvider.credential(idToken, res.credential.accessToken || undefined);
}

export async function signInWithGoogle() {
  if (isNativeIOS()) return signInWithCredential(auth, await nativeGoogleCredential());
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function reauthWithGoogle(user = auth.currentUser) {
  if (isNativeIOS()) return reauthenticateWithCredential(user, await nativeGoogleCredential());
  return reauthenticateWithPopup(user, new GoogleAuthProvider());
}
