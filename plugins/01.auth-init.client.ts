export default defineNuxtPlugin(async (nuxtApp) => {
  const authStore = useAuthStore();
  
  // Initialize auth state from localStorage before the app renders
  await authStore.initializeAuth();
});

