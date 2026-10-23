// Per-user secret calendar feed token. icsTokens/{token} = { uid, createdAt }; userSettings/{uid}.icsToken = token.
// Creation/rotation goes through the calendar-token Netlify function, which verifies the ID token and Pro status server-side.
import { db, auth } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { fnUrl } from '@/config/api';

const FEED_BASE = 'https://clingnot.netlify.app/.netlify/functions/calendar?token=';

export const feedUrls = (token) => (token ? { https: FEED_BASE + token, webcal: FEED_BASE.replace(/^https:/, 'webcal:') + token } : null);

export const loadFeedToken = async (uid) => { const s = await getDoc(doc(db, 'userSettings', uid)); return (s.exists() && s.data().icsToken) || ''; };

const callTokenFn = async (method) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const r = await fetch(fnUrl('calendar-token'), { method, headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || `Feed request failed (${r.status})`), { status: r.status });
  return data.token || '';
};

// Create (or rotate) the token: the old one is deleted server-side, so the old URL stops working.
export const rotateFeedToken = async () => callTokenFn('POST');
export const revokeFeedToken = async () => { await callTokenFn('DELETE'); };

export { downloadTaskIcs } from '@/utils/ics';
