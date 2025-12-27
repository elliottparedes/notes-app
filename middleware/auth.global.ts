export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for API routes and static files
  if (to.path.startsWith('/api/') || to.path.startsWith('/_nuxt/') || to.path.includes('.')) {
    return;
  }

  const authStore = useAuthStore();

  // Detect if user is on a mobile device
  const isMobileDevice = () => {
    if (process.server) {
      // Server-side: check user agent from headers
      const headers = useRequestHeaders();
      const userAgent = headers['user-agent'] || '';
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    } else {
      // Client-side: check user agent
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
  };

  const getDashboardRoute = () => {
    return isMobileDevice() ? '/mobile/home' : '/notes';
  };

  // On server or client, check if we are authenticated
  // authStore.isAuthenticated relies on token, which is now hydrated from cookies on server

  // Handle root path - redirect authenticated users to dashboard immediately
  if (to.path === '/') {
    if (authStore.isAuthenticated) {
      return navigateTo(getDashboardRoute(), { replace: true });
    }
    // Allow landing page to show for unauthenticated users
    return;
  }

  // Define public routes (marketing pages + auth pages)
  const publicRoutes = ['/login', '/signup', '/', '/features', '/about', '/faq', '/use-cases'];
  const isPublishedRoute = to.path.startsWith('/p/');
  const isPublicRoute = publicRoutes.includes(to.path) || isPublishedRoute;

  // Redirect unauthenticated users trying to access protected routes
  if (!authStore.isAuthenticated && !isPublicRoute) {
    return navigateTo('/login');
  }

  // Redirect authenticated users away from auth pages
  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/signup')) {
    return navigateTo(getDashboardRoute());
  }
});