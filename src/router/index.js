import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import Login from '../views/Login.vue';
import { auth } from '../firebaseConfig';
import Room from '../views/Room.vue';
import TermsandCondition from '../views/TermsandCondition.vue';
import Addiction from "@/views/addiction.vue";
import sub from "@/views/Subs.vue";
import { ugcHidden, isNativeIOS, isNative } from '@/utils/platform';
import { decideEntry, hasSeenTutorial, hasSeenPaywallLocal, ENTRY_PATHS } from '@/utils/entryGuard';
import { isPro, canUse } from '@/utils/pro';
import { withRcPro, rcProActive, loadUserDoc } from '@/composables/usePro';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { homeFor, setMode, getPendingManagerToken, clearPendingManagerToken } from '@/utils/appMode';

const routes = [
  {
    path: '/',
    name: 'Root',
    // placeholder, redirection handled in route guard
    component: () => import('../views/landing.vue')
  },
  {
    path: '/home',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true }
  },

  {
    // New-user tutorial: public (unauthenticated), once per install, no skip. Order: /welcome -> sign in (Apple/Google creates the account) -> /onboarding (+ paywall) -> /home. See utils/entryGuard.js
    path: '/welcome',
    name: 'welcome',
    component: () => import('../views/WelcomeView.vue'),
    meta: { bare: true }
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('../views/OnboardingView.vue'),
    meta: { requiresAuth: true, bare: true }
  },
  {
    path: '/paywall',
    name: 'paywall',
    redirect: (to) => ({ path: '/onboarding', query: { ...to.query, step: 6 } }) // 6 = STEPS.length in OnboardingView = the plans (paywall) panel
  },
  {
    path: '/pro/success',
    name: 'pro-success',
    component: () => import('../views/pro/ProSuccess.vue'),
    meta: { requiresAuth: true, bare: true, webOnly: true }
  },
  {
    path: '/rankings',
    name: 'rankings',
    component: () => import('../views/RankingsView.vue'),
    meta: { requiresAuth: true, proFeature: 'community' }
  },
  {
    path: '/community',
    name: 'community',
    component: () => import('../views/CommunityView.vue'),
    meta: { requiresAuth: true, proFeature: 'community' }
  },
  {
    path: '/discipline',
    name: 'discipline',
    component: () => import('../views/DisciplineView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/gate',
    name: 'gate',
    component: () => import('../views/GateView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/discipline/log',
    name: 'procrastination-log',
    component: () => import('../views/ProcrastinationLog.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/upcoming',
    name: 'upcoming',
    component: () => import('../views/UpcomingView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/addiction',
    name: 'addiction',
    component: Addiction,
    meta: { webOnly: true } // Recovery Tracker is not shipped in the iOS app (sensitive health-adjacent self-tracking; see docs/ios-app-review-notes.md)
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    meta: { webOnly: true } // About ClingNote (web nav only; iOS has Support instead)
  },
  {
    path: '/payment-success',
    name: 'payment-success',
    component: () => import('../views/PaymentSuccess.vue'),
    meta: { requiresAuth: true, webOnly: true }
  },
  {
    path: '/profile/:userId',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/landing',
    name: 'Landing',
    component: () => import('../views/landing.vue')
  },
  {
    // Pal invite deep link (QR / iPhone Camera / universal link) → prefilled Pals hub; user confirms with Connect.
    path: '/pal/:code',
    redirect: (to) => ({ path: '/pals', query: { code: String(to.params.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() } })
  },
  {
    // Manager & Pals hub (signed-in). ?code=XXXXXXXX pre-fills a pal invite code.
    path: '/pals',
    name: 'pals',
    component: () => import('../views/PalsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    // Login-free manager view: the unguessable token in the URL is the only credential (revocable; see netlify/functions/manager-pal.js).
    path: '/m/:token',
    name: 'manager',
    component: () => import('../views/ManagerView.vue'),
    meta: { bare: true }
  },
  {
    // Manager mode home: everyone you manage (any account can switch between User mode and Manager mode).
    path: '/manage',
    name: 'manager-home',
    component: () => import('../views/ManagerHomeView.vue'),
    meta: { requiresAuth: true }
  },
  {
    // Signed-in manager's view of one person (tasks + pings + DMs), served by the manager-pal function.
    path: '/manage/:ownerUid',
    name: 'manager-person',
    component: () => import('../views/ManagerView.vue'),
    meta: { requiresAuth: true, bare: true }
  },
  ...(process.env.NODE_ENV === 'development' ? [{ path: '/__mock/pals', component: () => import('../views/PalsMockView.vue'), meta: { bare: false } }] : []),
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFoundComponent',
    component: () => import('@/views/NotFoundComponent.vue')
  },
  {
    path: '/fdfd',
    name: 'Discussion',
    component: () => import('@/views/Discussion.vue'),
    props: true,
    meta: { proFeature: 'community' }
  },
  {
    path: '/chat',
    name: 'RoomInterior',
    component: Room,
    props: true,
    meta: { proFeature: 'community' }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/terms',
    name: 'TermsandCondition',
    component: TermsandCondition
  },
  {
    // Email sign-up was removed: accounts are created by Sign in with Apple / Google. Old links land on /login.
    path: '/register',
    redirect: (to) => ({ path: '/login', query: to.query })
  },
  {
    path: '/sub',
    name: 'subs',
    component: () => import('../views/Subs.vue')
  },{
    path: '/support',
    name: 'support',
    component: () => import('../views/SupportView.vue')
  },{
    path: '/privacy-policy',
    name: 'privacy',
    component: () => import('../views/privacy-policy.vue')
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

// Reads just what the one-time paywall needs (isPro + paywallSeenAt). Cached per uid; any read failure => docLoaded:false => no paywall (never blocks the app).
const _pwCache = {};
async function loadPaywallState(user) {
  const seenLocal = hasSeenPaywallLocal(user.uid);
  if (seenLocal) return { isPro: rcProActive(user.uid), seenLocal: true, seenRemote: true, docLoaded: true };
  if (_pwCache[user.uid]) return { ..._pwCache[user.uid], isPro: _pwCache[user.uid].isPro || rcProActive(user.uid) };
  try {
    const snap = await Promise.race([getDoc(doc(db, 'users', user.uid)), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500))]);
    const d = snap.exists() ? snap.data() : null;
    if (!d) return { isPro: false, seenLocal: false, seenRemote: false, docLoaded: false };
    return (_pwCache[user.uid] = { isPro: isPro(withRcPro(user.uid, d)), seenLocal: false, seenRemote: !!d.paywallSeenAt, docLoaded: true, needsOnboarding: d.onboardingComplete === false });
  } catch (e) { return { isPro: false, seenLocal: false, seenRemote: false, docLoaded: false }; }
}

// Route guard
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  const getUser = () =>
      new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          unsubscribe();
          resolve(user);
        });
      });

  // Never let a stalled Firebase auth init (seen in the iOS WebView) block the first navigation forever: after 4s treat as signed out.
  const currentUser = auth.currentUser || await Promise.race([getUser(), new Promise(resolve => setTimeout(() => resolve(null), 4000))]);

  // iOS app: community/UGC screens are not offered (App Store 1.2) -> back to Home (or Login when signed out)
  if (ugcHidden()) {
    const UGC_PATHS = ['/rankings', '/fdfd', '/chat'];
    const otherProfile = to.path.startsWith('/profile/') && to.params.userId !== (currentUser && currentUser.uid);
    if (UGC_PATHS.includes(to.path) || otherProfile) return next(currentUser ? '/home' : '/login');
  }

  // iOS app: web-only features (Stripe-credit meal tracker) are not reachable (App Store 3.1.1)
  if (isNativeIOS() && to.matched.some(r => r.meta && r.meta.webOnly)) return next(currentUser ? '/home' : '/login');

  // New-user entry order (tutorial before sign-in) + the one-time paywall for existing non-Pro users: pure rules in utils/entryGuard.js
  let paywall = null;
  if (currentUser && ENTRY_PATHS.includes(to.path)) paywall = await loadPaywallState(currentUser);
  const entry = decideEntry({ to: { path: to.path, query: to.query }, user: currentUser, native: isNative(), tutorialSeen: hasSeenTutorial(), paywall });
  if (entry) return next(entry);

  // Manager invite accepted before sign-up: the token waited through sign-in + the normal onboarding (entry above sends
  // unfinished accounts to /onboarding first), so connect now and land on that person's manager view.
  if (currentUser && (to.path === '/' || to.path === '/home') && getPendingManagerToken()) {
    const token = getPendingManagerToken(); clearPendingManagerToken();
    try {
      const { palApi } = await import('@/composables/usePals');
      const r = await palApi('connectManager', { token });
      setMode('manager');
      return next(`/manage/${r.ownerUid}`);
    } catch (e) { /* link revoked/invalid: just continue into the app */ }
  }

  // Pro-only areas (utils/pro.js PRO_FEATURES): non-Pro users land on the paywall for that feature.
  const proFeature = (to.matched.find((r) => r.meta && r.meta.proFeature) || {}).meta?.proFeature;
  if (proFeature && currentUser) { try { const d = await loadUserDoc(); if (d && !canUse(d, proFeature)) return next({ path: '/paywall', query: { feature: proFeature, from: to.fullPath } }); } catch (e) { /* read failure: don't block */ } }

  // Pro users (server flag or, on iOS, RevenueCat's entitlement) never see the upgrade screen.
  if (to.path === '/paywall' && currentUser) { try { if (isPro(await loadUserDoc())) return next(to.query.from && String(to.query.from).startsWith('/') && to.query.from !== '/paywall' ? String(to.query.from) : '/home'); } catch (e) { /* show the paywall */ } }

  // iOS app: no marketing landing page (hero image + 26MB demo video are website-only) -> straight to Login / Home
  if (isNative() && currentUser && to.path === '/' && homeFor() === '/manage') return next('/manage'); // last mode used was Manager mode
  if (isNative() && (to.path === '/' || to.path === '/landing')) return next(currentUser ? '/home' : '/login');

  if (to.path === '/') {
    if (currentUser) {
      return next(homeFor()); // last mode used: User mode (/home) or Manager mode (/manage)
    } else {
      return next('/landing');
    }
  }

  if (requiresAuth && !currentUser) {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }

  next();
});

// Remember the last mode used (User mode = your tasks, Manager mode = people you manage).
router.afterEach((to) => { if (to.path === '/home') setMode('user'); else if (to.path === '/manage' || to.path.startsWith('/manage/')) setMode('manager'); });

export default router;
