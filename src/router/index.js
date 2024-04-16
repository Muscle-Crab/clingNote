import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RegisterPage from '../views/UserRegistrationForm.vue';
import Login from '../views/Login.vue';
import { auth } from '../firebaseConfig'; // Import your Firebase authentication instance

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true } // Add meta field to indicate authentication requirement
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
    meta: { requiresAuth: true } // Add meta field to indicate authentication requirement
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
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const currentUser = auth.currentUser; // Get the current user from Firebase authentication

  if (requiresAuth && !currentUser) {
    next('/login'); // Redirect to login page if authentication is required but user is not logged in
  } else {
    next(); // Proceed to the requested route
  }
});

export default router;
