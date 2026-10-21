// Per-user secret calendar feed token. icsTokens/{token} = { uid, createdAt }; userSettings/{uid}.icsToken = token.
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const FEED_BASE = 'https://clingnot.netlify.app/.netlify/functions/calendar?token=';
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');

export const feedUrls = (token) => (token ? { https: FEED_BASE + token, webcal: FEED_BASE.replace(/^https:/, 'webcal:') + token } : null);

export const loadFeedToken = async (uid) => { const s = await getDoc(doc(db, 'userSettings', uid)); return (s.exists() && s.data().icsToken) || ''; };

// Create (or rotate) the token: the old one is deleted, so the old URL stops working.
export const rotateFeedToken = async (uid) => {
  const old = await loadFeedToken(uid);
  const token = newToken();
  await setDoc(doc(db, 'icsTokens', token), { uid, createdAt: serverTimestamp() });
  await setDoc(doc(db, 'userSettings', uid), { icsToken: token }, { merge: true });
  if (old) await deleteDoc(doc(db, 'icsTokens', old)).catch(() => {});
  return token;
};

export const revokeFeedToken = async (uid) => {
  const old = await loadFeedToken(uid);
  if (old) await deleteDoc(doc(db, 'icsTokens', old));
  await setDoc(doc(db, 'userSettings', uid), { icsToken: '' }, { merge: true });
};

export { downloadTaskIcs } from '@/utils/ics';
