// One-time consent before any user data (text, meal photos, workout preferences) is sent to OpenAI (App Store 5.1.1(i) / 5.1.2(i)).
// Stored per user in localStorage (fast path) and on users/{uid} as aiConsent / aiConsentAt / aiConsentVersion (follows the user to another
// device). These keys are NOT in firestore.rules billingKeys(), so the owner may write them. Declining blocks AI use until the user allows it.
import { reactive } from 'vue';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';

export const AI_CONSENT_VERSION = 2; // v2: discloses Google Gemini (assistant / Ask) alongside OpenAI, so earlier v1 consents are asked again once
export const AI_CONSENT_DECLINED_MESSAGE = 'AI features are turned off because you did not allow sharing your text and photos with our AI providers (OpenAI and Google Gemini). Nothing was sent. You can allow it any time by trying again.';
const lsKey = (uid) => `clingnote.aiConsent.v${AI_CONSENT_VERSION}.${uid}`;

// Shared modal state, rendered once by <AiConsentModal/> in App.vue.
export const aiConsentUi = reactive({ open: false, declined: false });
let waiter = null;

const readLocal = (uid) => { try { return localStorage.getItem(lsKey(uid)) === '1'; } catch (e) { return false; } };
const writeLocal = (uid) => { try { localStorage.setItem(lsKey(uid), '1'); } catch (e) { /* private mode: asked again next session */ } };

export const hasAiConsent = async () => {
  const u = auth.currentUser; if (!u) return false;
  if (readLocal(u.uid)) return true;
  try { // consent given on another device
    const s = await getDoc(doc(db, 'users', u.uid));
    const d = s.exists() ? s.data() : {};
    if (d.aiConsent === true && Number(d.aiConsentVersion || 0) >= AI_CONSENT_VERSION) { writeLocal(u.uid); return true; }
  } catch (e) { /* offline: fall through and ask */ }
  return false;
};

// Resolves true when the user has allowed (now or earlier), false when declined. Never calls the AI itself.
export const ensureAiConsent = async () => {
  if (await hasAiConsent()) return true;
  if (waiter) return waiter.promise; // a modal is already open
  aiConsentUi.declined = false; aiConsentUi.open = true;
  let resolve; const promise = new Promise((r) => { resolve = r; });
  waiter = { promise, resolve };
  return promise;
};

export const acceptAiConsent = async () => {
  const u = auth.currentUser;
  if (u) {
    writeLocal(u.uid);
    try { await setDoc(doc(db, 'users', u.uid), { aiConsent: true, aiConsentVersion: AI_CONSENT_VERSION, aiConsentAt: serverTimestamp() }, { merge: true }); }
    catch (e) { console.warn('aiConsent sync failed', e && e.message); } // local consent still applies on this device
  }
  aiConsentUi.open = false; aiConsentUi.declined = false;
  if (waiter) { waiter.resolve(true); waiter = null; }
};

export const declineAiConsent = () => {
  aiConsentUi.declined = true; // modal switches to the "AI is off" notice
  if (waiter) { waiter.resolve(false); waiter = null; }
};
export const closeAiConsentNotice = () => { aiConsentUi.open = false; aiConsentUi.declined = false; };
