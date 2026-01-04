import { nextTick } from 'vue';
import { marked } from 'marked';

// Configure marked for TipTap-compatible HTML output
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Convert markdown to TipTap-compatible HTML
 */
function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // Parse markdown to HTML
  let html = marked.parse(markdown, { async: false }) as string;

  // Post-process for TipTap compatibility
  html = html
    // Ensure paragraphs are properly formatted
    .replace(/<p>\s*<\/p>/g, '<p></p>')
    // Convert task list items to TipTap format
    .replace(
      /<li>\s*\[([ xX])\]\s*/g,
      (_, checked) => `<li data-type="taskItem" data-checked="${checked.toLowerCase() === 'x'}"><label><input type="checkbox" ${checked.toLowerCase() === 'x' ? 'checked' : ''}></label><div>`
    )
    .replace(/<\/li>/g, (match, offset, string) => {
      // Check if this is a task item by looking backwards
      const before = string.substring(Math.max(0, offset - 200), offset);
      if (before.includes('data-type="taskItem"')) {
        return '</div></li>';
      }
      return match;
    })
    // Convert task lists to TipTap format
    .replace(/<ul>\s*(<li data-type="taskItem")/g, '<ul data-type="taskList">$1')
    // Handle wiki-style note links [[Note Title]]
    .replace(
      /\[\[([^\]]+)\]\]/g,
      '<a data-note-link="true" href="#note:$1">$1</a>'
    )
    // Clean up excessive whitespace
    .trim();

  return html;
}

export function useNoteEditor() {
  const notesStore = useNotesStore();
  const authStore = useAuthStore();
  const toast = useToast();

  const tagInput = ref('');
  const isPolishing = ref(false);
  const isAskingAI = ref(false);

  let contentSaveTimeout: NodeJS.Timeout | null = null;

  async function handleTitleChange() {
    const activeNote = notesStore.activeNote;
    if (!activeNote) return;

    try {
      await notesStore.updateNote(activeNote.id, {
        title: activeNote.title
      });
    } catch (error) {
      console.error('Failed to save title:', error);
    }
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
    await nextTick(); // Ensure loading state is rendered

    let accumulatedContent = '';

    try {
      if (!authStore.token) {
        toast.error('Not authenticated');
        return;
      }

      let lastUpdate = 0;
      let isFirstChunk = true;

      await streamAIResponse(
        '/api/pages/polish',
        {
          title: originalNoteTitle || 'Untitled Note',
          content: originalNoteContent || ''
        },
        (chunk) => {
          accumulatedContent += chunk;

          // Clear content on first chunk to avoid empty editor state during connection
          if (isFirstChunk) {
            if (activeNote.id === originalNoteId) {
              activeNote.content = '';
            }
            isFirstChunk = false;
          }

          // Convert markdown to HTML in real-time as it streams
          const now = Date.now();
          if (activeNote.id === originalNoteId && now - lastUpdate > 50) {
             activeNote.content = markdownToHtml(accumulatedContent);
             lastUpdate = now;
          }
        }
      );

      // Final conversion to ensure complete content is rendered
      const htmlContent = markdownToHtml(accumulatedContent);

      // Update editor with final HTML content
      if (activeNote.id === originalNoteId) {
        activeNote.content = htmlContent;
      }

      // Final save with HTML content
      await notesStore.updateNote(originalNoteId, {
        content: htmlContent
      });

      toast.success('Note polished! ✨');
    } catch (error: any) {
      console.error('Polish error:', error);
      // Restore original content on error
      if (activeNote.id === originalNoteId) {
        activeNote.content = originalNoteContent;
      }
      toast.error(error.message || 'Failed to polish note with AI');
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
    await nextTick(); // Ensure loading state is rendered

    let accumulatedContent = '';

    try {
      if (!authStore.token) {
        toast.error('Not authenticated');
        return;
      }

      let lastUpdate = 0;
      let isFirstChunk = true;

      await streamAIResponse(
        '/api/pages/ask-ai',
        {
          title: originalNoteTitle || 'Untitled Note',
          content: originalNoteContent || '',
          prompt: prompt
        },
        (chunk) => {
          accumulatedContent += chunk;

          // Clear content on first chunk
          if (isFirstChunk) {
            if (activeNote.id === originalNoteId) {
              activeNote.content = '';
            }
            isFirstChunk = false;
          }

          // Convert markdown to HTML in real-time as it streams
          const now = Date.now();
          if (activeNote.id === originalNoteId && now - lastUpdate > 50) {
            activeNote.content = markdownToHtml(accumulatedContent);
            lastUpdate = now;
          }
        }
      );

      // Final conversion to ensure complete content is rendered
      const htmlContent = markdownToHtml(accumulatedContent);

      // Update editor with final HTML content
      if (activeNote.id === originalNoteId) {
        activeNote.content = htmlContent;
      }

      // Final save with HTML content
      await notesStore.updateNote(originalNoteId, {
        content: htmlContent
      });

      toast.success('Note updated! ✨');
    } catch (error: any) {
      console.error('AskAI error:', error);
      // Restore original content on error
      if (activeNote.id === originalNoteId) {
        activeNote.content = originalNoteContent;
      }
      toast.error(error.message || 'Failed to process AI request');
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

      const response = await $fetch(`/api/pages/${activeNote.id}/download-pdf`, {
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
