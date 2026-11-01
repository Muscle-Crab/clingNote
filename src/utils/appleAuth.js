// Sign in with Apple for the Capacitor iOS shell (App Store Guideline 4.8).
// Native Apple sheet (@capacitor-community/apple-sign-in) -> identity token -> Firebase OAuthProvider('apple.com') credential.
// The web build never calls this (Login.vue only shows the Apple button inside the iOS shell).
import { OAuthProvider, signInWithCredential, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { isNativeIOS } from '@/utils/platform';

export const APPLE_CLIENT_ID = 'app.clingnote.ios'; // = bundle ID (keep in sync with capacitor.config.json)
const APPLE_REDIRECT = 'https://clingnote-463b4.firebaseapp.com/__/auth/handler';

export const isAppleSignInAvailable = () => isNativeIOS();

const randomNonce = (len = 32) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};
const sha256Hex = async (s) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
};

// Shows the native Apple sheet. Returns { credential, authorizationCode, givenName, familyName, email }.
export async function getAppleCredential() {
  const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
  const rawNonce = randomNonce();
  const nonce = await sha256Hex(rawNonce); // Apple embeds this hash in the id token; Firebase checks it against rawNonce
  const { response } = await SignInWithApple.authorize({
    clientId: APPLE_CLIENT_ID, redirectURI: APPLE_REDIRECT, scopes: 'email name', nonce,
  });
  if (!response || !response.identityToken) throw Object.assign(new Error('Apple sign-in returned no identity token'), { code: 'apple/no-token' });
  const credential = new OAuthProvider('apple.com').credential({ idToken: response.identityToken, rawNonce });
  return { credential, authorizationCode: response.authorizationCode || '', givenName: response.givenName || '', familyName: response.familyName || '', email: response.email || '' };
}

export async function signInWithApple() {
  const a = await getAppleCredential();
  const result = await signInWithCredential(auth, a.credential);
  return { ...a, user: result.user, isNewUser: result.user?.metadata?.creationTime === result.user?.metadata?.lastSignInTime };
}

// For account deletion: fresh Apple credential + auth code (the server can revoke the Apple token with it).
export async function reauthWithApple(user = auth.currentUser) {
  const a = await getAppleCredential();
  await reauthenticateWithCredential(user, a.credential);
  return a.authorizationCode;
}
export const userHasAppleProvider = (user = auth.currentUser) => !!user && (user.providerData || []).some((p) => p.providerId === 'apple.com');
export const userHasPasswordProvider = (user = auth.currentUser) => !!user && (user.providerData || []).some((p) => p.providerId === 'password');
export const userHasGoogleProvider = (user = auth.currentUser) => !!user && (user.providerData || []).some((p) => p.providerId === 'google.com');
