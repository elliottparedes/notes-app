export default defineNuxtPlugin(async (nuxtApp) => {
  // Initialize IndexedDB caches
  // This must run early to ensure cache is ready before any data fetching
  if (process.client) {
    const { initNotesCache } = await import('~/utils/notesCache');
    const { initProfilePictureCache } = await import('~/utils/profilePictureCache');

    await Promise.all([
      initNotesCache(),
      initProfilePictureCache()
    ]);
  }
});
