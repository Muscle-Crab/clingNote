import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RegisterPage from '../views/UserRegistrationForm.vue';
import Login from '../views/Login.vue';
import { auth } from '../firebaseConfig'; // Import your Firebase authentication instance
import Room from '../views/Room.vue';
import Landing from '../views/landing.vue';
import Pickup from '../views/Pickup.vue';
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
  }, {
    path: '/landing',
    name: 'Landing',
    component: Landing,


  },{
    path: '/:pathMatch(.*)*',
    name: 'NotFoundComponent',
    component: () => import('@/views/NotFoundComponent.vue'),


  },{
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
  },{
    path: '/pickup',
    name: 'Pickup',
    component: Pickup
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
            resolve();
          } else {
            next('/login');
          }
        });
      });
    }
  }

  next();
});

export default router;

