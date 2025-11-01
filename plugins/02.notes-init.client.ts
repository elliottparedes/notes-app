export default defineNuxtPlugin(async (nuxtApp) => {
  const notesStore = useNotesStore();
  const authStore = useAuthStore();

  // Load notes from server if authenticated
  if (authStore.isAuthenticated && authStore.token) {
    try {
      await notesStore.fetchNotes();
      await notesStore.loadFolderOrder();
      await notesStore.loadNoteOrder();
      await notesStore.loadTabsFromStorage();
    } catch (err) {
      console.error('Failed to initialize notes:', err);
    }
  }
});
