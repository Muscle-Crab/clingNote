import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RegisterPage from '../views/UserRegistrationForm.vue';
import Login from '../views/Login.vue';
import { auth } from '../firebaseConfig';
import Room from '../views/Room.vue';
import TermsandCondition from '../views/TermsandCondition.vue';
import Pickup from '../views/Pickup.vue';
import Addiction from "@/views/addiction.vue";
import sub from "@/views/Subs.vue";
import { ugcHidden, isNativeIOS, isNative } from '@/utils/platform';
import { decideEntry, hasSeenTutorial, hasSeenPaywallLocal, ENTRY_PATHS } from '@/utils/entryGuard';
import { isPro } from '@/utils/pro';
import { withRcPro, rcProActive, loadUserDoc } from '@/composables/usePro';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

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
    // New-user tutorial: public (unauthenticated), once per install, no skip. Order: /welcome -> sign up -> /onboarding (+ paywall) -> /home. See utils/entryGuard.js
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
    redirect: (to) => ({ path: '/onboarding', query: { ...to.query, step: 5 } })
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
    meta: { requiresAuth: true }
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
    meta: { webOnly: true } // admin user list (hardcoded admin email in nav) -> never in the iOS app
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
    path: '/:pathMatch(.*)*',
    name: 'NotFoundComponent',
    component: () => import('@/views/NotFoundComponent.vue')
  },
  {
    path: '/pickup',
    name: 'Pickup',
    component: Pickup
  },
  {
    path: '/fdfd',
    name: 'Discussion',
    component: () => import('@/views/Discussion.vue'),
    props: true
  },
  {
    path: '/chat',
    name: 'RoomInterior',
    component: Room,
    props: true
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
    path: '/register',
    name: 'Register',
    component: RegisterPage
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
  ,{
    path: '/mealPlan',
    name: 'MealPlan',
    component: () => import('../views/MealPlan.vue'),
    meta: { webOnly: true } // credits are bought with Stripe (digital goods) -> not available in the iOS app, see guard
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
    return (_pwCache[user.uid] = { isPro: isPro(withRcPro(user.uid, d)), seenLocal: false, seenRemote: !!d.paywallSeenAt, docLoaded: true });
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
    const UGC_PATHS = ['/rankings', '/pickup', '/fdfd', '/chat'];
    const otherProfile = to.path.startsWith('/profile/') && to.params.userId !== (currentUser && currentUser.uid);
    if (UGC_PATHS.includes(to.path) || otherProfile) return next(currentUser ? '/home' : '/login');
  }

  // iOS app: web-only features (Stripe-credit meal tracker) are not reachable (App Store 3.1.1)
  if (isNativeIOS() && to.matched.some(r => r.meta && r.meta.webOnly)) return next(currentUser ? '/home' : '/login');

  // New-user entry order (tutorial before sign up) + the one-time paywall for existing non-Pro users: pure rules in utils/entryGuard.js
  let paywall = null;
  if (currentUser && ENTRY_PATHS.includes(to.path)) paywall = await loadPaywallState(currentUser);
  const entry = decideEntry({ to: { path: to.path, query: to.query }, user: currentUser, native: isNative(), tutorialSeen: hasSeenTutorial(), paywall });
  if (entry) return next(entry);

  // Pro users (server flag or, on iOS, RevenueCat's entitlement) never see the upgrade screen.
  if (to.path === '/paywall' && currentUser) { try { if (isPro(await loadUserDoc())) return next(to.query.from && String(to.query.from).startsWith('/') && to.query.from !== '/paywall' ? String(to.query.from) : '/home'); } catch (e) { /* show the paywall */ } }

  // iOS app: no marketing landing page (hero image + 26MB demo video are website-only) -> straight to Login / Home
  if (isNative() && (to.path === '/' || to.path === '/landing')) return next(currentUser ? '/home' : '/login');

  if (to.path === '/') {
    if (currentUser) {
      return next('/home');
    } else {
      return next('/landing');
    }
  }

  if (requiresAuth && !currentUser) {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }

  next();
});

export default router;
