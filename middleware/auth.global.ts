export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for API routes and static files
  if (to.path.startsWith('/api/') || to.path.startsWith('/_nuxt/') || to.path.includes('.')) {
    return;
  }

  const authStore = useAuthStore();
  
  // On server or client, check if we are authenticated
  // authStore.isAuthenticated relies on token, which is now hydrated from cookies on server
  
  // Handle root path - redirect authenticated users to dashboard immediately
  if (to.path === '/') {
    if (authStore.isAuthenticated) {
      return navigateTo('/dashboard', { replace: true });
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
    return navigateTo('/dashboard');
  }
});