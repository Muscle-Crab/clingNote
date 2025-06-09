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
import sub from "@/views/Subscription.vue";

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
    path: '/subscription',
    name: 'subscription',
    component: sub
  },{
    path: '/privacy-policy',
    name: 'subscription',
    component: () => import('../views/privacy-policy.vue')
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

  if (to.path === '/') {
    if (currentUser) {
      return next('/home');
    } else {
      return next('/landing');
    }
  }

  if (requiresAuth && !currentUser) {
    return next('/login');
  }

  next();
});

export default router;
