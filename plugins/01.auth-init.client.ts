export default defineNuxtPlugin((nuxtApp) => {
  const authStore = useAuthStore();
  
  // Initialize auth state from cookies/localStorage without blocking page render
  if (process.client) {
    // Check cookie first (primary) then localStorage (legacy)
    const token = useCookie('auth_token').value || localStorage.getItem('auth_token');
    
    if (!token) {
      authStore.initialized = true;
      return;
    }
    
    // If token exists, initialize in background without blocking
    authStore.initializeAuth().catch((error) => {
      console.warn('Auth initialization error (non-blocking):', error);
      authStore.initialized = true;
    });
  } else {
    // Server side - mark as initialized immediately
    authStore.initialized = true;
  }
});

