export default defineNuxtPlugin(async (nuxtApp) => {
  const notesStore = useNotesStore();
  const authStore = useAuthStore();

  // Initialize notes from local storage
  await notesStore.initializeFromLocal();

  // Enable auto-sync if authenticated
  if (authStore.isAuthenticated && authStore.token) {
    const { enableAutoSync } = await import('~/utils/syncManager.client');
    enableAutoSync(authStore.token);

    // Do initial sync if online
    if (navigator.onLine) {
      notesStore.syncWithServer();
    }
  }

  // Watch for auth changes to enable/disable sync
  watch(
    () => authStore.isAuthenticated,
    async (isAuth) => {
      if (isAuth && authStore.token) {
        const { enableAutoSync } = await import('~/utils/syncManager.client');
        enableAutoSync(authStore.token);
        
        if (navigator.onLine) {
          await notesStore.syncWithServer();
        }
      } else {
        const { disableAutoSync } = await import('~/utils/syncManager.client');
        disableAutoSync();
      }
    }
  );
});

