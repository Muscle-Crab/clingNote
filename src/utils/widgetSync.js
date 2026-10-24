// iOS only: keep the home-screen widget's App Group snapshot in sync with today's tasks, and route widget taps.
// Listens to weeklyRoutines/{uid}_{Today} directly (independent of HomeView), so any task change anywhere refreshes the widget.
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { registerPlugin } from '@capacitor/core';
import { db, auth } from '@/firebaseConfig';
import { buildWidgetSnapshot, widgetKeyMap, parseWidgetLink } from './widgetSnapshot';
import { drainQueue } from './widgetQueue';
import { API_BASE } from '@/config/api';

const ClingWidget = registerPlugin('ClingWidget');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let keyMap = {};
let lastJson = '';
let lastTasks = null, lastDay = '';
let pendingIds = [];
let completer = null; // registered by HomeView: (taskId, mode) => Promise<boolean>
let draining = false;

const readPending = async () => { try { const r = await ClingWidget.getPending(); return Array.isArray(r && r.items) ? r.items : []; } catch (e) { return []; } };
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
    const today = DAYS[new Date().getDay()];
    const fn = completer;
    const { acked } = await drainQueue({ queue, today, getTasks: () => fn.tasks ? fn.tasks() : (lastTasks || []), complete: (id, mode) => fn(id, mode) });
    if (acked.length) await ClingWidget.ackPending({ keys: acked }).catch(() => {});
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
  (snapshot ? ClingWidget.setSnapshot({ json }) : ClingWidget.clear()).catch(() => {});
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
    }, () => {});
  };
  onAuthStateChanged(auth, (u) => {
    uid = u ? u.uid : null;
    if (off) { off(); off = null; }
    day = null;
    if (uid) subscribe(); else { keyMap = {}; lastTasks = null; write(null); }
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
