import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
// Returns the user's doc data, creating a minimal doc if it's missing.
export async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const base = { id: user.uid, email: user.email || '', name: user.displayName || (user.email || '').split('@')[0] || 'You',
    credits: 15, isPro: false, plan: 'free', onboardingComplete: false, createdAt: new Date() };
  await setDoc(ref, base, { merge: true });
  return base;
}
export const saveUserFields = (uid, data) => setDoc(doc(db, 'users', uid), data, { merge: true });
