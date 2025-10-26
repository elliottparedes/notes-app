export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side - we can't access localStorage there
  if (import.meta.server) {
    return;
  }
  
  // Skip middleware for API routes and static files
  if (to.path.startsWith('/api/') || to.path.startsWith('/_nuxt/') || to.path.includes('.')) {
    return;
  }

  const authStore = useAuthStore();
  const nuxtApp = useNuxtApp();

  // During initial client load/hydration, check localStorage first to avoid redirects
  if (import.meta.client && nuxtApp.isHydrating && nuxtApp.payload.serverRendered) {
    const hasToken = localStorage.getItem('auth_token');
    
    if (hasToken) {
      // Has token - redirect away from auth pages
      if (to.path === '/login' || to.path === '/signup') {
        return navigateTo('/dashboard', { replace: true });
      }
      return;
    }
    
    // No token - redirect to login if accessing protected route
    const publicRoutes = ['/login', '/signup', '/'];
    if (!publicRoutes.includes(to.path)) {
      return navigateTo('/login', { replace: true });
    }
    
    return;
  }

  // Wait for auth initialization on client navigation
  if (process.client && !authStore.initialized) {
    await authStore.initializeAuth();
  }

  // Handle root path
  if (to.path === '/') {
    return navigateTo(authStore.isAuthenticated ? '/dashboard' : '/login');
  }

  // Define public routes
  const publicRoutes = ['/login', '/signup'];
  const isPublicRoute = publicRoutes.includes(to.path);

  // Redirect logic
  if (!authStore.isAuthenticated && !isPublicRoute) {
    return navigateTo('/login');
  }

  if (authStore.isAuthenticated && isPublicRoute) {
    return navigateTo('/dashboard');
  }
});

