export default defineNuxtPlugin((nuxtApp) => {
  const authStore = useAuthStore();
  
  // Initialize auth state from localStorage without blocking page render
  // On Netlify, this prevents hanging if API calls are slow
  if (process.client) {
    // Quick synchronous check - if no token, mark as initialized immediately
    const token = localStorage.getItem('auth_token');
    if (!token) {
      authStore.initialized = true;
      return;
    }
    
    // If token exists, initialize in background without blocking
    // This allows the page to render while auth initializes
    authStore.initializeAuth().catch((error) => {
      console.warn('Auth initialization error (non-blocking):', error);
      // Mark as initialized anyway to prevent hanging
      authStore.initialized = true;
    });
  } else {
    // Server side - mark as initialized immediately
    authStore.initialized = true;
  }
});

