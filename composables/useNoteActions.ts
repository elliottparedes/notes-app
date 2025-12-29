export function useNoteActions() {
  const notesStore = useNotesStore();
  const toast = useToast();
  const noteToDelete = ref<string | null>(null);

  async function handleOpenNote(pageId: string) {
    // Reset delete confirmation when opening a note
    if (noteToDelete.value !== null) {
      noteToDelete.value = null;
    }
    await notesStore.openTab(pageId);
  }

  async function handleCreateNoteInFolder(sectionId: number) {
    try {
      const newNote = await notesStore.createNote({
        title: '',
        content: '',
        section_id: sectionId
      });
      handleOpenNote(newNote.id);
    } catch (error) {
      toast.error('Failed to create note');
    }
  }

  function handleDeleteClick(pageId: string, event: MouseEvent) {
    event.stopPropagation();
    if (noteToDelete.value === pageId) {
      handleConfirmDelete(pageId);
    } else {
      noteToDelete.value = pageId;
    }
  }

  async function handleConfirmDelete(pageId: string) {
    try {
      await notesStore.deleteNote(pageId);
      toast.success('Note deleted');
      noteToDelete.value = null;

      const activeNote = notesStore.activeNote;
      if (activeNote?.id === pageId) {
        notesStore.closeTab(pageId);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
      noteToDelete.value = null;
    }
  }

  function handleDeleteCancel() {
    noteToDelete.value = null;
  }

  function handleCloseActiveNote() {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;
    notesStore.closeTab(activeNote.id);
  }

  return {
    noteToDelete,
    handleOpenNote,
    handleCreateNoteInFolder,
    handleDeleteClick,
    handleConfirmDelete,
    handleDeleteCancel,
    handleCloseActiveNote
  };
}
