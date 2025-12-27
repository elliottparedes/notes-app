export default defineNuxtPlugin(async (nuxtApp) => {
  const notesStore = useNotesStore();
  const authStore = useAuthStore();
  const route = useRoute();

  // Only load notes if on the notes page - other pages will load on-demand
  const isNotesPage = route.path === '/notes' || route.path.startsWith('/notes/');

  console.log(`[NOTES PLUGIN] Current route: ${route.path}, isNotesPage: ${isNotesPage}`);

  // Load notes from server only if authenticated AND on notes page
  if (authStore.isAuthenticated && authStore.token && isNotesPage) {
    console.log('[NOTES PLUGIN] Loading notes data...');
    try {
      await notesStore.fetchNotes();
      await notesStore.loadFolderOrder();
      await notesStore.loadNoteOrder();
      await notesStore.loadTabsFromStorage();
    } catch (err) {
      console.error('Failed to initialize notes:', err);
    }
  } else {
    console.log('[NOTES PLUGIN] Skipping notes load (not on notes page or not authenticated)');
  }
});
