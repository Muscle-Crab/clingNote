// publicProfiles/{uid}: the only per-user data other signed-in users may read (name, avatar, pickup attendance).
// users/{uid} (email, dob, gender, credits, billing, scheduled tasks) is owner-only under firestore.rules.tight.
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { safeName } from '@/utils/ranking';

export const PUBLIC_FIELDS = ['name', 'avatarURL', 'attending', 'updatedAt'];
export const toPublic = (u = {}) => ({ name: safeName(u.name), avatarURL: typeof u.avatarURL === 'string' ? u.avatarURL : null });

// Mirror own profile -> public doc (keeps existing attendance; copies legacy users.attending once).
export const syncPublicProfile = async (uid, userData) => {
  if (!uid || !userData) return;
  const ref = doc(db, 'publicProfiles', uid);
  const cur = await getDoc(ref);
  const attending = cur.exists() && 'attending' in cur.data() ? cur.data().attending : (userData.attending ?? null);
  await setDoc(ref, { ...toPublic(userData), attending, updatedAt: serverTimestamp() }, { merge: true });
};

export const listPublicProfiles = async () => (await getDocs(collection(db, 'publicProfiles'))).docs.map((d) => ({ id: d.id, ...d.data() }));
export const getPublicProfile = async (uid) => { const s = await getDoc(doc(db, 'publicProfiles', uid)); return s.exists() ? { id: uid, ...s.data() } : null; };
