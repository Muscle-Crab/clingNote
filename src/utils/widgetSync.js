// iOS only: keep the home-screen widget's App Group snapshot in sync with today's tasks, and route widget taps.
// Listens to weeklyRoutines/{uid}_{Today} directly (independent of HomeView), so any task change anywhere refreshes the widget.
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { registerPlugin } from '@capacitor/core';
import { db, auth } from '@/firebaseConfig';
import { buildWidgetSnapshot, widgetKeyMap, parseWidgetLink } from './widgetSnapshot';

const ClingWidget = registerPlugin('ClingWidget');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let keyMap = {};
let lastJson = '';

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
      write(buildWidgetSnapshot(tasks, { dayName: today }));
    }, () => {});
  };
  onAuthStateChanged(auth, (u) => {
    uid = u ? u.uid : null;
    if (off) { off(); off = null; }
    day = null;
    if (uid) subscribe(); else { keyMap = {}; write(null); }
  });
  // Day rollover while the app stays open / comes back from background.
  setInterval(subscribe, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) subscribe(); });
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
