// Server-side Pro check for every Netlify function backing a Pro feature.
// Verifies the Firebase ID token (Authorization: Bearer) and reads users/{uid} with the admin SDK.
// 401 = missing/invalid token, 402 = signed in but not Pro. isPro/plan/proExpiresAt are written only by stripe-webhook.
const { verifyUser } = require('./notify');
const { getAdmin } = require('./firebaseAdmin');

const toDate = (e) => (e?.toDate ? e.toDate() : e?._seconds ? new Date(e._seconds * 1000) : e ? new Date(e) : null);
const isProDoc = (d, now = new Date()) => {
  if (!d || d.isPro !== true) return false;
  if (d.plan === 'lifetime') return true; // lifetime never expires
  const exp = toDate(d.proExpiresAt);
  return !exp || Number.isNaN(exp.getTime()) || exp > now;
};
const userIsPro = async (db, uid) => { const s = await db.doc(`users/${uid}`).get(); return isProDoc(s.exists ? s.data() : null); };

// Returns uid or throws {status:401|402}
const requirePro = async (event, deps = {}) => {
  const uid = await verifyUser(event.headers, deps.verify || ((t) => getAdmin().auth().verifyIdToken(t)));
  const db = deps.db || getAdmin().firestore();
  if (!(await userIsPro(db, uid))) throw Object.assign(new Error('Pro required'), { status: 402 });
  return uid;
};
module.exports = { requirePro, isProDoc, userIsPro };
