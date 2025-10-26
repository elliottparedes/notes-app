// Track if we've already attempted auto-login in this session
let hasAttemptedAutoLogin = false;

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware for API routes and static files
  if (to.path.startsWith('/api/') || to.path.startsWith('/_nuxt/') || to.path.includes('.')) {
    return;
  }

  const authStore = useAuthStore();

  // On client-side, check for stored token and restore session (ONLY ONCE per page load)
  if (process.client && !authStore.user && !hasAttemptedAutoLogin) {
    hasAttemptedAutoLogin = true; // Prevent multiple attempts
    
    const storedToken = localStorage.getItem('auth_token');
    
    if (storedToken) {
      console.log('🔐 Attempting auto-login with stored token');
      authStore.token = storedToken;
      try {
        await authStore.fetchCurrentUser();
        console.log('✅ Auto-login successful');
      } catch (error) {
        // Token is invalid, will be cleared by fetchCurrentUser
        console.error('❌ Auto-login failed:', error);
        hasAttemptedAutoLogin = false; // Allow retry on next navigation
      }
    }
  }

  // Define public routes
  const publicRoutes = ['/login', '/signup', '/'];
  const isPublicRoute = publicRoutes.includes(to.path);

  // Redirect logic
  if (!authStore.isAuthenticated && !isPublicRoute) {
    // Not authenticated and trying to access protected route
    return navigateTo('/login');
  }

  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/signup')) {
    // Authenticated and trying to access auth pages
    return navigateTo('/dashboard');
  }
});

