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
    const publicRoutes = ['/login', '/signup', '/', '/features', '/about', '/faq', '/use-cases'];
    const isPublishedRoute = to.path.startsWith('/p/');
    if (!publicRoutes.includes(to.path) && !isPublishedRoute) {
      return navigateTo('/login', { replace: true });
    }
    
    return;
  }

  // Wait for auth initialization on client navigation
  if (process.client && !authStore.initialized) {
    await authStore.initializeAuth();
  }

  // Handle root path - allow landing page, redirect authenticated users to dashboard
  if (to.path === '/') {
    if (authStore.isAuthenticated) {
      return navigateTo('/dashboard', { replace: true });
    }
    // Allow landing page to show for unauthenticated users
    return;
  }

  // Define public routes (marketing pages + auth pages)
  const publicRoutes = ['/login', '/signup', '/features', '/about', '/faq', '/use-cases'];
  const isPublishedRoute = to.path.startsWith('/p/');
  const isPublicRoute = publicRoutes.includes(to.path) || isPublishedRoute;

  // Redirect logic
  if (!authStore.isAuthenticated && !isPublicRoute) {
    return navigateTo('/login');
  }

  // Don't redirect authenticated users from published routes (they should be able to view them)
  // Only redirect from /login and /signup
  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/signup')) {
    return navigateTo('/dashboard');
  }
});

