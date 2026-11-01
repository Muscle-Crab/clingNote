// Per-route <title>/description/canonical/OG/Twitter updates for the SPA (static defaults live in public/index.html).
export const SITE = 'https://clingnote.netlify.app';
export const APP_NAME = 'ClingNote: Daily Task Planner';
const D = 'ClingNote is a daily task planner and productivity app: task management, routine tracker, habit and streak tracking, and focus with app lock.';
export const PAGES = {
  landing: { path: '/', title: 'ClingNote: Daily Task Planner – Productivity App, Routine & Habit Tracker', description: D },
  pricing: { path: '/sub', title: 'ClingNote Pro Pricing – $2.99/mo, $19.99/yr or $39.99 Lifetime', description: 'Upgrade to ClingNote Pro: unlock the full daily task planner, routine tracker, habit streaks and focus app lock. Monthly, yearly or lifetime plans.' },
  login: { path: '/login', title: 'Sign in – ClingNote: Daily Task Planner', description: 'Sign in to ClingNote with Apple or Google to plan your day, manage tasks and keep your habit streak going.' },
  welcome: { path: '/welcome', title: 'Welcome – ClingNote: Daily Task Planner', description: 'Get started with ClingNote, the productivity app for daily tasks, routines, habits and focus.', noindex: true },
  terms: { path: '/terms', title: 'Terms of Service – ClingNote', description: 'Terms and conditions for using ClingNote: Daily Task Planner.' },
  privacy: { path: '/privacy-policy', title: 'Privacy Policy – ClingNote', description: 'How ClingNote: Daily Task Planner collects, uses and protects your data.' },
  support: { path: '/support', title: 'Support & Help – ClingNote: Daily Task Planner', description: 'Get help with ClingNote: tasks, routines, habit streaks, app lock focus mode, subscriptions and your account.' },
  about: { path: '/about', title: 'About ClingNote – Daily Task Planner & Productivity App', description: 'About ClingNote, the daily task planner that combines task management, a routine tracker, habit streaks and focus app lock.' },
  notfound: { title: 'Page not found – ClingNote', description: D, noindex: true },
};
const APP = { title: APP_NAME, description: D, noindex: true };

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href);
}
export function seoFor(route) {
  const key = route && route.meta && route.meta.seo;
  return (key && PAGES[key]) || APP; // unknown / signed-in app screens: generic + noindex
}
export function applySeo(route) {
  if (typeof document === 'undefined') return;
  const p = seoFor(route);
  const url = SITE + (p.path || (route && route.path) || '/');
  document.title = p.title;
  setMeta('name', 'description', p.description);
  setMeta('name', 'robots', p.noindex ? 'noindex, follow' : 'index, follow');
  setMeta('property', 'og:title', p.title);
  setMeta('property', 'og:description', p.description);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', p.title);
  setMeta('name', 'twitter:description', p.description);
  setCanonical(url);
}
