export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();
  
  // Initialize auth state from localStorage before the app renders
  await authStore.initializeAuth();
});

