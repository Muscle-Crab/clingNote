// Firebase Cloud Messaging (web push). Everything is user-initiated: nothing here prompts for permission on page load.
// firebase/messaging is imported lazily so it stays out of the main bundle.
import { app, auth, db } from '@/firebaseConfig';
import { doc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { VAPID_PUBLIC_KEY, SW_URL, SW_SCOPE, SEND_FN } from '@/config/push';

const LS = 'clingnot_fcm_on';
let unsubFg = null;

export const iosNeedsInstall = () => {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return ios && !standalone;
};
export const pushSupported = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
  try { const m = await import('firebase/messaging'); return await m.isSupported(); } catch (e) { return false; }
};
export const pushState = () => ({
  permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  enabled: typeof localStorage !== 'undefined' && localStorage.getItem(LS) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted',
});

const toast = (title, body) => {
  const el = document.createElement('div');
  el.setAttribute('role', 'status'); el.setAttribute('data-test', 'push-toast');
  el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top));z-index:100000;max-width:min(92vw,420px);background:#1c2230;color:#fff;border:1px solid #3a4560;border-radius:12px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.4);font:14px system-ui,sans-serif';
  const b = document.createElement('b'); b.textContent = title; el.appendChild(b);
  if (body) { const p = document.createElement('div'); p.textContent = body; el.appendChild(p); }
  document.body.appendChild(el); setTimeout(() => el.remove(), 5000);
};

// Register (or reuse) the push worker and wait until it is ACTIVE: PushManager.subscribe fails with "no active Service Worker" on the first install otherwise.
const getReg = async () => {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (reg.active) return reg;
  const sw = reg.installing || reg.waiting;
  if (sw) await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Service worker did not activate')), 15000);
    const check = () => { if (sw.state === 'activated') { clearTimeout(t); resolve(); } else if (sw.state === 'redundant') { clearTimeout(t); reject(new Error('Service worker install failed')); } };
    sw.addEventListener('statechange', check); check();
  });
  return reg;
};
const mintToken = async () => {
  const m = await import('firebase/messaging');
  const messaging = m.getMessaging(app);
  const reg = await getReg();
  const token = await m.getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error('No token');
  if (unsubFg) unsubFg();
  unsubFg = m.onMessage(messaging, (p) => { const d = p?.data || {}; toast(d.title || 'ClingNot', d.body || ''); }); // foreground: in-app banner
  return { token, m, messaging };
};
const saveToken = (uid, token) => setDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) }, { merge: true });

// Never leave the button spinning: some networks/browsers block the push service and getToken then never settles.
const withTimeout = (pr, ms, msg) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

// Called from a button click. Returns { ok, reason? }.
export const enablePush = async () => {
  const u = auth.currentUser; if (!u) return { ok: false, reason: 'signin' };
  if (!(await pushSupported())) return { ok: false, reason: iosNeedsInstall() ? 'ios-install' : 'unsupported' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'denied' : 'dismissed' };
  try { const { token } = await withTimeout(mintToken(), 25000, 'Push registration timed out'); await saveToken(u.uid, token); localStorage.setItem(LS, '1'); return { ok: true }; }
  catch (e) { console.error('enablePush', e.message); return { ok: false, reason: 'error' }; }
};

export const disablePush = async () => {
  const u = auth.currentUser;
  try {
    const m = await import('firebase/messaging'); const messaging = m.getMessaging(app);
    let token = ''; try { token = await m.getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: await getReg() }); } catch (e) { /* ignore */ }
    if (token && u) await setDoc(doc(db, 'users', u.uid), { fcmTokens: arrayRemove(token) }, { merge: true });
    await m.deleteToken(messaging);
  } catch (e) { console.error('disablePush', e.message); }
  if (unsubFg) { unsubFg(); unsubFg = null; }
  localStorage.removeItem(LS);
  return { ok: true };
};

// Re-attach the foreground handler / refresh the token for returning users who already opted in. Never prompts.
export const resumePush = async () => {
  if (!pushState().enabled || !auth.currentUser) return;
  try { if (!(await pushSupported())) return; const { token } = await mintToken(); await saveToken(auth.currentUser.uid, token); } catch (e) { console.error('resumePush', e.message); }
};

const postTest = async () => {
  const idToken = await auth.currentUser.getIdToken();
  const r = await fetch(SEND_FN, { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j, ok: r.ok && j.ok !== false };
};
export const sendTestPush = async () => {
  const u = auth.currentUser; if (!u) return { ok: false, error: 'Sign in first' };
  let a = await postTest();
  // The server drops tokens FCM says are dead (or none were ever saved). Re-register this device once and retry.
  if (!a.ok && (a.status === 404 || a.j.removed > 0) && pushState().enabled) {
    try { const { token } = await withTimeout(mintToken(), 25000, 'Push registration timed out'); await saveToken(u.uid, token); a = await postTest(); } catch (e) { console.error('re-register', e.message); }
  }
  const codes = a.j.errors && a.j.errors.length ? ` (${a.j.errors.join(', ')})` : '';
  return { ok: a.ok, error: a.j.error || (a.status < 300 && a.j.ok === false ? `Delivery failed${codes}. Turn notifications off and on again.` : a.status < 300 ? '' : 'Request failed') };
};
};
