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
import { ugcHidden, isNativeIOS } from '@/utils/platform';

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
    component: Landing
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

  // iOS app: community/UGC screens are not offered (App Store 1.2) -> back to Home (or Login when signed out)
  if (ugcHidden()) {
    const UGC_PATHS = ['/rankings', '/pickup', '/fdfd', '/chat'];
    const otherProfile = to.path.startsWith('/profile/') && to.params.userId !== (currentUser && currentUser.uid);
    if (UGC_PATHS.includes(to.path) || otherProfile) return next(currentUser ? '/home' : '/login');
  }

  // iOS app: web-only features (Stripe-credit meal tracker) are not reachable (App Store 3.1.1)
  if (isNativeIOS() && to.matched.some(r => r.meta && r.meta.webOnly)) return next(currentUser ? '/home' : '/login');

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
