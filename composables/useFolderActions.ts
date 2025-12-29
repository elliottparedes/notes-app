import type { Folder } from '~/types';

export function useFolderActions() {
  const foldersStore = useFoldersStore();
  const notesStore = useNotesStore();
  const spacesStore = useSpacesStore();
  const toast = useToast();
  const { getOrderedNotesForFolder } = useNotesFormatting();

  const showCreateFolderModal = ref(false);
  const showFolderEditModal = ref(false);
  const newFolderName = ref('');
  const targetSpaceIdForFolderCreation = ref<number | undefined>(undefined);
  const editingFolder = ref<Folder | null>(null);
  const isCreatingFolder = ref(false);

  async function handleSelectFolder(sectionId: number, selectedFolderId: Ref<number | null>, previousFolderId: Ref<number | null>, handleOpenNote: (pageId: string) => Promise<void>) {
    // Track previous folder before switching
    previousFolderId.value = selectedFolderId.value;
    selectedFolderId.value = sectionId;

    // Automatically open the first note in the folder
    await nextTick();
    const notes = getOrderedNotesForFolder(sectionId);
    if (notes.length > 0) {
      await handleOpenNote(notes[0].id);
    } else {
      // If the folder is empty, clear the active note
      notesStore.activeTabId = null;
    }
  }

  async function handleDeleteFolder(sectionId: number, selectedFolderId: Ref<number | null>) {
    try {
      // If the deleted folder is the currently selected one, deselect it
      if (selectedFolderId.value === sectionId) {
        selectedFolderId.value = null;
      }

      // If the active note is in this folder, clear it
      const activeNote = notesStore.activeNote;
      if (activeNote && activeNote.section_id === sectionId) {
        notesStore.activeTabId = null;
        notesStore.saveTabsToStorage();
      }

      await foldersStore.deleteFolder(sectionId);

      // Refresh notes to remove deleted notes from the list
      await notesStore.fetchNotes();

      toast.success('Section deleted');
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast.error('Failed to delete section');
    }
  }

  function openCreateFolderModal(notebookId?: number) {
    newFolderName.value = '';
    targetSpaceIdForFolderCreation.value = notebookId;
    showCreateFolderModal.value = true;
  }

  async function handleCreateFolder() {
    if (!newFolderName.value.trim() || isCreatingFolder.value) return;

    isCreatingFolder.value = true;
    try {
      await foldersStore.createFolder({
        name: newFolderName.value.trim(),
        notebook_id: targetSpaceIdForFolderCreation.value || spacesStore.currentSpaceId || undefined
      });
      showCreateFolderModal.value = false;
      toast.success('Folder created');
    } catch (error) {
      toast.error('Failed to create folder');
    } finally {
      isCreatingFolder.value = false;
    }
  }

  function openEditFolderModal(folder: Section) {
    editingFolder.value = folder;
    showFolderEditModal.value = true;
  }

  return {
    showCreateFolderModal,
    showFolderEditModal,
    newFolderName,
    targetSpaceIdForFolderCreation,
    editingFolder,
    isCreatingFolder,
    handleSelectFolder,
    handleDeleteFolder,
    openCreateFolderModal,
    handleCreateFolder,
    openEditFolderModal
  };
}
