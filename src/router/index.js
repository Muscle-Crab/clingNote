import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RegisterPage from '../views/UserRegistrationForm.vue';
import Login from '../views/Login.vue';
import { auth } from '../firebaseConfig'; // Import your Firebase authentication instance
import Room from '../views/Room.vue';

const routes = [
  {
    path: '/tasks',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
  },
  {
    path: '/profile/:userId',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    name: 'Discussion',
    component: () => import('@/views/Discussion.vue'),
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/room/:id',
    name: 'RoomInterior',
    component: Room,
    props: true // Pass route params as props to the component
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: RegisterPage
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

// Route guard to check if the user is authenticated
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const currentUser = auth.currentUser;

  if (requiresAuth) {
    if (!currentUser) {
      // If authentication state is not persisted, wait for it to initialize
      await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          if (user) {
            unsubscribe();
            if (['ds7513635@gmail.com', 'lacherylthompson2@gmail.com'].includes(user.email)) {
              next('/');
            } else {
              next();
            }
          } else {
            next('/login');
          }
        });
      });
    } else if (['ds7513635@gmail.com', 'lacherylthompson2@gmail.com'].includes(currentUser.email)) {
      next('/');
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
