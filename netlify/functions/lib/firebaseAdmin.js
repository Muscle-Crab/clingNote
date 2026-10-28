// Shared firebase-admin init. Accepts FIREBASE_SERVICE_ACCOUNT (raw JSON or base64),
// or the existing GOOGLE_APPLICATION_CREDENTIALS_BASE64 / GOOGLE_APPLICATION_CREDENTIALS_BASE (base64).
const loadCreds = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE;
  if (!raw) return null;
  const s = raw.trim();
  return JSON.parse(s.startsWith('{') ? s : Buffer.from(s, 'base64').toString('utf8'));
};
let admin = null;
const getAdmin = () => {
  if (admin) return admin;
  const a = require('firebase-admin');
  if (!a.apps.length) {
    const creds = loadCreds();
    // Local e2e only: with the Firestore emulator env set and no creds, use the demo-* emulator project (cannot touch production).
    if (!creds && process.env.FIRESTORE_EMULATOR_HOST && String(process.env.GCLOUD_PROJECT || '').startsWith('demo-')) { a.initializeApp({ projectId: process.env.GCLOUD_PROJECT }); admin = a; return a; }
    if (!creds) throw Object.assign(new Error('Firebase Admin credentials not configured'), { status: 500 });
    a.initializeApp({ credential: a.credential.cert(creds) });
  }
  admin = a; return a;
};
module.exports = { getAdmin, hasCreds: () => !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE) };
