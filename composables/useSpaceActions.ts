export function useSpaceActions() {
  const spacesStore = useSpacesStore();
  const foldersStore = useFoldersStore();
  const notesStore = useNotesStore();
  const toast = useToast();

  const showDeleteSpaceModal = ref(false);
  const deletingSpaceId = ref<number | null>(null);
  const isDeletingSpace = ref(false);

  async function handleSelectSpace(notebookId: number) {
    spacesStore.toggleSpace(notebookId);
    if (spacesStore.expandedSpaceIds.has(notebookId)) {
      spacesStore.setCurrentSpace(notebookId);
    }
  }

  function handleDeleteSpace(notebookId: number) {
    // Check if this is the last space
    if (spacesStore.spaces.length <= 1) {
      toast.error('Cannot delete the last remaining space');
      return;
    }

    deletingSpaceId.value = notebookId;
    showDeleteSpaceModal.value = true;
  }

  async function confirmDeleteSpace(selectedFolderId: Ref<number | null>) {
    if (deletingSpaceId.value === null) return;

    isDeletingSpace.value = true;

    try {
      const notebookIdToDelete = deletingSpaceId.value;

      // Get all folders in the space to be deleted
      const foldersInSpace = foldersStore.folders.filter(f => f.notebook_id === notebookIdToDelete);
      const sectionIdsInSpace = foldersInSpace.map(f => f.id);

      // Get all notes that are in these folders or directly in the space
      const notesInSpace = notesStore.notes.filter(n =>
        (n.section_id && sectionIdsInSpace.includes(n.section_id)) ||
        (n.notebook_id === notebookIdToDelete && !n.section_id)
      );

      // Check if the active note is in this space and clear it
      const activeNote = notesStore.activeNote;
      const isActiveNoteInSpace = activeNote && notesInSpace.some(n => n.id === activeNote?.id);
      if (isActiveNoteInSpace) {
        notesStore.activeTabId = null;
        notesStore.saveTabsToStorage();
      }

      // If the currently selected folder is in the deleted space, deselect it
      if (selectedFolderId.value && sectionIdsInSpace.includes(selectedFolderId.value)) {
        selectedFolderId.value = null;
      }

      await spacesStore.deleteSpace(notebookIdToDelete);
      toast.success('Space deleted successfully');

      // After space is deleted, refetch folders and notes to update UI
      await Promise.all([
        foldersStore.fetchFolders(null),
        notesStore.fetchNotes()
      ]);

      showDeleteSpaceModal.value = false;
      deletingSpaceId.value = null;

    } catch (error: any) {
      toast.error(error.data?.message || error.message || 'Failed to delete space');
    } finally {
      isDeletingSpace.value = false;
    }
  }

  function cancelDeleteSpace() {
    showDeleteSpaceModal.value = false;
    deletingSpaceId.value = null;
  }

  function handleSpaceDragOver(notebookId: number, isDraggingSpace: Ref<boolean>) {
    // Don't expand if reordering spaces
    if (isDraggingSpace.value) return;

    if (!spacesStore.expandedSpaceIds.has(notebookId)) {
      spacesStore.expandSpace(notebookId);
    }
  }

  return {
    showDeleteSpaceModal,
    deletingSpaceId,
    isDeletingSpace,
    handleSelectSpace,
    handleDeleteSpace,
    confirmDeleteSpace,
    cancelDeleteSpace,
    handleSpaceDragOver
  };
}
