import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
// Returns the user's doc data, creating a minimal doc if it's missing.
export async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
  } catch (e) { console.warn('user doc read', e?.message); }
  const base = { id: user.uid, email: user.email || '', name: user.displayName || (user.email || '').split('@')[0] || 'You',
    onboardingComplete: false, lockInEnabled: true, createdAt: new Date() };
  // isPro:false / plan:'free' are the only billing values the rules allow a client to create. A missing doc used to
  // fail this write and the sign-in screen treated that as "could not log in".
  try { await setDoc(ref, { ...base, isPro: false, plan: 'free' }, { merge: true }); }
  catch (e) { console.warn('user doc create', e?.message); }
  return base;
}
export const saveUserFields = (uid, data) => setDoc(doc(db, 'users', uid), data, { merge: true });
