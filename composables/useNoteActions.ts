export function useNoteActions() {
  const notesStore = useNotesStore();
  const toast = useToast();
  const noteToDelete = ref<string | null>(null);

  async function handleOpenNote(noteId: string) {
    // Reset delete confirmation when opening a note
    if (noteToDelete.value !== null) {
      noteToDelete.value = null;
    }
    await notesStore.openTab(noteId);
  }

  async function handleCreateNoteInFolder(folderId: number) {
    try {
      const newNote = await notesStore.createNote({
        title: '',
        content: '',
        folder_id: folderId
      });
      handleOpenNote(newNote.id);
    } catch (error) {
      toast.error('Failed to create note');
    }
  }

  function handleDeleteClick(noteId: string, event: MouseEvent) {
    event.stopPropagation();
    if (noteToDelete.value === noteId) {
      handleConfirmDelete(noteId);
    } else {
      noteToDelete.value = noteId;
    }
  }

  async function handleConfirmDelete(noteId: string) {
    try {
      await notesStore.deleteNote(noteId);
      toast.success('Note deleted');
      noteToDelete.value = null;

      const activeNote = notesStore.activeNote;
      if (activeNote?.id === noteId) {
        notesStore.closeTab(noteId);
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
