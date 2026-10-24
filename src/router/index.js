import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RegisterPage from '../views/UserRegistrationForm.vue';
import Login from '../views/Login.vue';
import { auth } from '../firebaseConfig';
import Room from '../views/Room.vue';
import Landing from '../views/landing.vue';
import TermsandCondition from '../views/TermsandCondition.vue';
import Pickup from '../views/Pickup.vue';
import Addiction from "@/views/addiction.vue";
import sub from "@/views/Subs.vue";
import { homeFor, setMode, getPendingManagerToken, clearPendingManagerToken } from '@/utils/appMode';

const routes = [
  {
    path: '/',
    name: 'Root',
    // placeholder, redirection handled in route guard
    component: Landing
  },
  {
    path: '/home',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true }
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
    meta: { requiresAuth: true, bare: true }
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
    component: Addiction
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue')
  },
  {
    path: '/payment-success',
    name: 'payment-success',
    component: () => import('../views/PaymentSuccess.vue'),
    meta: { requiresAuth: true }
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
    component: Landing
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
    path: '/privacy-policy',
    name: 'privacy',
    component: () => import('../views/privacy-policy.vue')
  }
  ,{
    path: '/mealPlan',
    name: 'MealPlan',
    component: () => import('../views/MealPlan.vue')
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

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

  const currentUser = auth.currentUser || await getUser();

  // Manager invite accepted before sign-up: the token waited through sign-in + the normal onboarding,
  // so connect now and land on that person's manager view.
  if (currentUser && (to.path === '/' || to.path === '/home') && getPendingManagerToken()) {
    const token = getPendingManagerToken(); clearPendingManagerToken();
    try {
      const { palApi } = await import('@/composables/usePals');
      const r = await palApi('connectManager', { token });
      setMode('manager');
      return next(`/manage/${r.ownerUid}`);
    } catch (e) { /* link revoked/invalid: just continue into the app */ }
  }

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
