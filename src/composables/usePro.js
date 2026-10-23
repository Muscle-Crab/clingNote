// Pro gating helpers for components. Reads users/{uid} once and caches per uid.
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';
import { canUse } from '@/utils/pro';

let cache = { uid: null, data: null, at: 0 };
export async function loadUserDoc(force = false) {
  const u = auth.currentUser; if (!u) return null;
  if (!force && cache.uid === u.uid && Date.now() - cache.at < 60000) return cache.data;
  try { const s = await getDoc(doc(db, 'users', u.uid)); cache = { uid: u.uid, data: s.exists() ? s.data() : {}, at: Date.now() }; }
  catch (e) { console.error('pro check', e.message); return cache.uid === u.uid ? cache.data : null; }
  return cache.data;
}
export const clearProCache = () => { cache = { uid: null, data: null, at: 0 }; };
// Returns true if allowed; otherwise sends the user to the paywall and returns false.
export async function requirePro(router, feature) {
  const d = await loadUserDoc();
  if (canUse(d, feature)) return true;
  router.push({ path: '/paywall', query: { feature, from: router.currentRoute.value.fullPath } });
  return false;
}
