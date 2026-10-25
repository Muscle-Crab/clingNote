// iOS only: keep the home-screen widget's App Group snapshot in sync with today's tasks, and route widget taps.
// Listens to weeklyRoutines/{uid}_{Sun..Sat} directly (independent of HomeView), so any task change anywhere refreshes the widget.
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { registerPlugin } from '@capacitor/core';
import { db, auth } from '@/firebaseConfig';
import { buildWidgetSnapshot, widgetKeyMap, parseWidgetLink } from './widgetSnapshot';
import { drainQueue } from './widgetQueue';
import { API_BASE } from '@/config/api';

const ClingWidget = registerPlugin('ClingWidget');
// Same doc ids as HomeView (src/data.json days[].day): weeklyRoutines/{uid}_Sun..Sat, NOT full weekday names.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let keyMap = {};
let lastJson = '';
let lastTasks = null, lastDay = '';
let pendingIds = [];
let completer = null; // registered by HomeView: (taskId, mode) => Promise<boolean>
let draining = false;

const readNative = async () => { try { const r = await ClingWidget.getPending(); return Array.isArray(r && r.items) ? r.items : []; } catch (e) { return []; } };
// Sign-out wipes the App Group (ClingWidget.clear), so pending taps are first stashed per uid and merged back on that
// user's next sign-in (another account never drains them).
const stashKey = (uid) => `widgetPendingStash_${uid}`;
const readStash = (uid) => { try { const a = JSON.parse(localStorage.getItem(stashKey(uid)) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const writeStash = (uid, a) => { try { if (a.length) localStorage.setItem(stashKey(uid), JSON.stringify(a)); else localStorage.removeItem(stashKey(uid)); } catch (e) { /* ignore */ } };
const ekey = (e) => `${e && e.taskId}@${e && e.ts}`;
const stashPending = async (uid) => {
  if (!uid) return;
  const merged = [...readStash(uid)];
  for (const e of await readNative()) if (!merged.some((x) => ekey(x) === ekey(e))) merged.push(e);
  writeStash(uid, merged);
};
const readPending = async () => {
  const items = await readNative();
  const u = auth.currentUser;
  if (u) for (const e of readStash(u.uid)) if (!items.some((x) => ekey(x) === ekey(e))) items.push(e);
  return items;
};
const ackStash = (keys) => { const u = auth.currentUser; if (u) writeStash(u.uid, readStash(u.uid).filter((e) => !keys.includes(ekey(e)))); };
const rewrite = () => { if (lastTasks) write(buildWidgetSnapshot(lastTasks, { dayName: lastDay, pendingIds })); };

// HomeView registers its completion path; returns an unregister function.
export const registerWidgetCompleter = (fn) => { completer = fn; drainWidgetQueue(); return () => { if (completer === fn) completer = null; }; };

export const drainWidgetQueue = async () => {
  if (draining) return;
  draining = true;
  try {
    const queue = await readPending();
    pendingIds = queue.map((e) => e && e.taskId).filter(Boolean);
    if (!queue.length || !completer || !auth.currentUser) { rewrite(); return; }
    const dow = new Date().getDay();
    const today = DAYS[dow], yesterday = DAYS[(dow + 6) % 7];
    const fn = completer;
    const { acked } = await drainQueue({ queue, today, yesterday, getTasks: () => fn.tasks ? fn.tasks() : (lastTasks || []), complete: (id, mode) => fn(id, mode), completePrior: fn.prior ? (id, d) => fn.prior(id, d) : undefined });
    if (acked.length) { await ClingWidget.ackPending({ keys: acked }).catch(() => {}); ackStash(acked); }
    pendingIds = (await readPending()).map((e) => e && e.taskId).filter(Boolean);
    rewrite();
  } finally { draining = false; }
};

// Short-lived Firebase ID token (+ endpoint) for the widget's optional instant sync (widget-complete function).
const pushAuth = async (u) => {
  try {
    if (!u) { await ClingWidget.setAuth({ token: '', endpoint: '' }); return; }
    const token = await u.getIdToken();
    await ClingWidget.setAuth({ token, endpoint: `${API_BASE}/.netlify/functions/widget-complete` });
  } catch (e) { /* widget falls back to the queue */ }
};

const write = (snapshot) => {
  const json = snapshot ? JSON.stringify(snapshot) : '';
  if (json === lastJson) return;
  lastJson = json;
  (snapshot ? ClingWidget.setSnapshot({ json }) : ClingWidget.clear()).catch((e) => { lastJson = ''; console.warn('[widgetSync] write failed:', e && (e.message || e)); });
};

export const installWidgetSync = () => {
  let off = null, uid = null, day = null;
  const subscribe = () => {
    const today = DAYS[new Date().getDay()];
    if (off && day === today) return;
    if (off) off();
    off = null; day = today;
    if (!uid) return;
    off = onSnapshot(doc(db, 'weeklyRoutines', `${uid}_${today}`), (snap) => {
      const tasks = snap.exists() ? (snap.data().tasks || []) : [];
      keyMap = widgetKeyMap(tasks);
      lastTasks = tasks; lastDay = today;
      write(buildWidgetSnapshot(tasks, { dayName: today, pendingIds }));
    }, (e) => { console.warn('[widgetSync] today listener failed:', e && (e.code || e.message || e)); });
  };
  onAuthStateChanged(auth, async (u) => {
    const prevUid = uid;
    uid = u ? u.uid : null;
    if (off) { off(); off = null; }
    day = null;
    if (uid) subscribe(); else { await stashPending(prevUid); keyMap = {}; lastTasks = null; write(null); } // keep taps across sign-out
    pushAuth(u);
    if (uid) drainWidgetQueue();
  });
  // Day rollover while the app stays open / comes back from background.
  setInterval(subscribe, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    subscribe(); drainWidgetQueue(); if (auth.currentUser) pushAuth(auth.currentUser);
  });
};

// Widget tap: clingnote://task/<id> -> /home?task=<id>. Returns true if handled.
export const handleWidgetUrl = (url, router) => {
  const path = parseWidgetLink(url);
  if (!path) return false;
  router.push(path).catch(() => {});
  return true;
};

// On /home?task=<id>: scroll the card into view and pulse it (DOM-only, so HomeView/TaskCard need no changes).
export const installWidgetFocus = (router) => {
  const style = document.createElement('style');
  style.textContent = '@keyframes cnWidgetFocus{0%,100%{box-shadow:0 0 0 0 rgba(61,220,151,0)}30%{box-shadow:0 0 0 3px rgba(61,220,151,.9)}}' +
    '.widget-focus{animation:cnWidgetFocus 1.2s ease-in-out 2;border-radius:14px}';
  document.head.appendChild(style);
  router.afterEach((to) => {
    const id = to.query && to.query.task;
    if (to.path !== '/home' || !id || typeof id !== 'string') return;
    let tries = 0;
    const find = () => {
      const key = keyMap[id];
      const el = key && document.querySelector(`[data-reorder-key="${window.CSS && window.CSS.escape ? window.CSS.escape(key) : key.replace(/"/g, '\\"')}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('widget-focus');
        setTimeout(() => el.classList.remove('widget-focus'), 2600);
        router.replace({ path: '/home', query: { ...to.query, task: undefined } }).catch(() => {});
      } else if (++tries < 40) setTimeout(find, 150);
    };
    setTimeout(find, 100);
  });
};
