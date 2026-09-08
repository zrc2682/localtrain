import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guest: true },
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/UserDashboard.vue'),
      meta: { requiresAuth: true },
    },
   {
     path: '/challenges/:id',
     name: 'ChallengeDetail',
     component: () => import('../views/ChallengeDetail.vue'),
     meta: { requiresAuth: true },
   },
    {
      path: '/containers',
      name: 'Containers',
      component: () => import('../views/UserContainers.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/leaderboard',
      name: 'Leaderboard',
      component: () => import('../views/LeaderboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'Profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('../views/AdminDashboard.vue'),
      meta: { requiresAuth: true, admin: true },
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore();
  if (auth.token && !auth.user) {
    await auth.fetchMe();
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    next('/login');
    return;
  }

  if (to.meta.guest && auth.isLoggedIn) {
    next('/dashboard');
    return;
  }

  if (to.meta.admin && !auth.isAdmin) {
    next('/dashboard');
    return;
  }

  next();
});

export default router;
