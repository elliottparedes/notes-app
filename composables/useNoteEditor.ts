export function useNoteEditor() {
  const notesStore = useNotesStore();
  const authStore = useAuthStore();
  const toast = useToast();

  const tagInput = ref('');
  const isPolishing = ref(false);
  const isAskingAI = ref(false);

  let titleSaveTimeout: NodeJS.Timeout | null = null;
  let contentSaveTimeout: NodeJS.Timeout | null = null;

  function handleTitleChange() {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    if (titleSaveTimeout) clearTimeout(titleSaveTimeout);

    titleSaveTimeout = setTimeout(async () => {
      if (!activeNote) return;
      try {
        await notesStore.updateNote(activeNote.id, {
          title: activeNote.title
        });
      } catch (error) {
        console.error('Failed to save title:', error);
      }
    }, 1000);
  }

  async function addTag() {
    const activeNote = notesStore.activeNote;
    const trimmedTag = tagInput.value.trim();
    if (!trimmedTag || !activeNote) return;

    const currentTags = activeNote.tags || [];

    // Check if tag already exists
    if (currentTags.includes(trimmedTag)) {
      tagInput.value = '';
      return;
    }

    // Update local state
    activeNote.tags = [...currentTags, trimmedTag];
    tagInput.value = '';

    // Save changes
    await saveTags();
  }

  async function removeTag(tag: string) {
    const activeNote = notesStore.activeNote;
    if (!activeNote || !activeNote.tags) return;

    // Update local state
    activeNote.tags = activeNote.tags.filter(t => t !== tag);

    // Save changes
    await saveTags();
  }

  async function saveTags() {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    try {
      await notesStore.updateNote(activeNote.id, {
        tags: activeNote.tags
      });
    } catch (error) {
      console.error('Failed to save tags:', error);
      toast.error('Failed to save tags');
    }
  }

  function handleContentChange(newContent: string) {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    // Update local state immediately
    activeNote.content = newContent;

    if (contentSaveTimeout) clearTimeout(contentSaveTimeout);

    contentSaveTimeout = setTimeout(async () => {
      if (!activeNote) return;
      try {
        await notesStore.updateNote(activeNote.id, {
          content: activeNote.content
        });
      } catch (error) {
        console.error('[Dashboard] Failed to save content:', error);
        toast.error('Failed to save changes');
      }
    }, 2000);
  }

  async function polishNote() {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    const originalNoteId = activeNote.id;
    const originalNoteTitle = activeNote.title;
    const originalNoteContent = activeNote.content;

    if (!originalNoteTitle?.trim() && !originalNoteContent?.trim()) {
      toast.error('Add some content to your note first');
      return;
    }

    isPolishing.value = true;

    try {
      if (!authStore.token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await $fetch<{ title: string; content: string }>('/api/notes/polish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`
        },
        body: {
          title: originalNoteTitle || 'Untitled Note',
          content: originalNoteContent || ''
        }
      });

      // Only update if the active note hasn't changed
      const currentActiveNote = notesStore.activeNote;
      if (currentActiveNote && currentActiveNote.id === originalNoteId) {
        currentActiveNote.title = response.title;
        currentActiveNote.content = response.content;
      }

      // Always save changes to the original note ID
      await notesStore.updateNote(originalNoteId, {
        title: response.title,
        content: response.content
      });

      toast.success('Note polished! ✨');
    } catch (error: any) {
      console.error('Polish error:', error);
      toast.error(error.data?.message || 'Failed to polish note with AI');
    } finally {
      isPolishing.value = false;
    }
  }

  async function askAINote(prompt: string) {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    const originalNoteId = activeNote.id;
    const originalNoteTitle = activeNote.title;
    const originalNoteContent = activeNote.content;

    if (!prompt || !prompt.trim()) {
      return;
    }

    isAskingAI.value = true;

    try {
      if (!authStore.token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await $fetch<{ content: string }>('/api/notes/ask-ai', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`
        },
        body: {
          title: originalNoteTitle || 'Untitled Note',
          content: originalNoteContent || '',
          prompt: prompt
        }
      });

      // Only update if the active note hasn't changed
      const currentActiveNote = notesStore.activeNote;
      if (currentActiveNote && currentActiveNote.id === originalNoteId) {
        currentActiveNote.content = response.content;
      }

      // Always save changes to the original note ID
      await notesStore.updateNote(originalNoteId, {
        content: response.content
      });

      toast.success('Note updated! ✨');
    } catch (error: any) {
      console.error('AskAI error:', error);
      toast.error(error.data?.message || 'Failed to process AI request');
    } finally {
      isAskingAI.value = false;
    }
  }

  async function downloadPDF() {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    try {
      if (!authStore.token) {
        toast.error('Not authenticated');
        return;
      }

      toast.info('Generating PDF...');

      const response = await $fetch(`/api/notes/${activeNote.id}/download-pdf`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        responseType: 'blob',
      });

      // Create blob URL and trigger download
      const blob = new Blob([response], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${activeNote.title || 'note'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      toast.success('PDF downloaded successfully');
    } catch (error: any) {
      console.error('PDF download error:', error);
      toast.error(error.data?.message || 'Failed to download PDF');
    }
  }

  return {
    tagInput,
    isPolishing,
    isAskingAI,
    handleTitleChange,
    handleContentChange,
    addTag,
    removeTag,
    polishNote,
    askAINote,
    downloadPDF
  };
}
