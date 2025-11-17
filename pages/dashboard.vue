<script setup lang="ts">
import type { Note, CreateNoteDto, UpdateNoteDto, Folder } from '~/models';
import type { NoteTemplate } from '~/types/noteTemplate';
import { noteTemplates } from '~/utils/noteTemplates';

// Stores
const authStore = useAuthStore();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const sharedNotesStore = useSharedNotesStore();
const spacesStore = useSpacesStore();
const toast = useToast();
const router = useRouter();
const route = useRoute();


// State
const searchQuery = ref('');
const selectedFolderId = ref<number | null>(null);
const loading = ref(false);
const isCreating = ref(false);
const hasInitialized = ref(false);
const isMounted = ref(false); // Track if we're on client to prevent hydration mismatch
const isLoadingNoteFromSearch = ref(false); // Track when loading note from search (mobile)
// Computed to ensure empty state doesn't show when loading
const shouldShowEmptyState = computed(() => {
  const isLoading = isLoadingNoteFromSearch.value;
  const justSelected = noteJustSelectedFromSearch.value;
  const hasActiveNote = !!activeNote.value;
  const shouldShow = !isLoading && !justSelected && !hasActiveNote;
  
  // Log when computed is evaluated
  if (isLoading || justSelected || !hasActiveNote) {
    console.log('[Dashboard] shouldShowEmptyState computed:', {
      isLoading,
      justSelected,
      hasActiveNote,
      shouldShow,
      activeNoteId: activeNote.value?.id,
      timestamp: Date.now()
    });
  }
  
  // Never show empty state if we're loading from search OR just selected (prevent flash)
  if (isLoading || justSelected) return false;
  // Only show if no active note
  return !hasActiveNote;
});

// Mobile menu state
const isMobileSidebarOpen = ref(false); // Keep for now but will remove drawer
const isSearchExpanded = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);
const showMobileSpacesSheet = ref(false);
const showMobileFoldersSheet = ref(false);
const showMobileCreateMenu = ref(false);
const spaceButtonRef = ref<HTMLButtonElement | null>(null);
const folderButtonRef = ref<HTMLButtonElement | null>(null);
const createButtonRef = ref<HTMLButtonElement | null>(null);
const spacesDropdownPos = ref({ top: 0, left: 0, width: 0 });
const foldersDropdownPos = ref({ top: 0, left: 0, width: 0 });
const createDropdownPos = ref({ top: 0, left: 0, width: 0 });

// Folder menu state
const folderMenuOpen = ref<number | null>(null);
const folderMenuPos = ref({ top: 0, left: 0, width: 0 });

// Active note editing state
const editForm = reactive<UpdateNoteDto & { content: string }>({
  title: '',
  content: '',
  tags: [],
  folder: '',
  folder_id: null as number | null
});
const isSaving = ref(false);
const autoSaveTimeout = ref<NodeJS.Timeout | null>(null);
const isLocked = ref(false);
// UnifiedEditor exposes both getHTML and getCurrentContent for both modes
const collaborativeEditorRef = ref<{ getCurrentContent: () => string; getHTML: () => string } | null>(null);
const tiptapEditorRef = ref<{ getHTML: () => string; getCurrentContent: () => string } | null>(null);
const showFolderDropdown = ref(false);
// Flag to prevent auto-save when programmatically updating editForm (e.g., switching tabs/spaces)
const isProgrammaticUpdate = ref(false);
const folderDropdownPos = ref({ top: 0, left: 0 });
const isPolishing = ref(false);
const isPublishing = ref(false);
const publishStatus = ref<{ is_published: boolean; share_url?: string } | null>(null);
const showPublishModal = ref(false);
const attachments = ref<Array<import('~/models').Attachment>>([]);
const isLoadingAttachments = ref(false);
const fileUploadInputRef = ref<HTMLInputElement | null>(null);

// Folder publish status
const folderPublishStatuses = ref<Map<number, { is_published: boolean; share_url?: string }>>(new Map());
const showFolderPublishModal = ref(false);
const currentFolderPublishStatus = ref<{ folderId: number; folderName: string; is_published: boolean; share_url?: string } | null>(null);
const showUnpublishFolderModal = ref(false);
const folderToUnpublish = ref<{ folderId: number; folderName: string } | null>(null);

// Track previous values for change detection (to handle collaborative notes correctly)
const prevTitle = ref<string>('');
const prevContent = ref<string>('');
const prevFolderId = ref<number | null>(null);

// FAB menu state
const showFabMenu = ref(false);

// Note creation submenu state (in sidebar)
const showNoteCreationMenu = ref(false);

// User menu state
const showUserMenu = ref(false);

// Shared notes section state - persist to localStorage

// Desktop sidebar visibility state - persist to localStorage
const isDesktopSidebarVisible = ref(true);

// Load saved state from localStorage on mount
if (process.client) {
  const savedSidebarState = localStorage.getItem('desktopSidebarVisible');
  if (savedSidebarState !== null) {
    isDesktopSidebarVisible.value = savedSidebarState === 'true';
  }
}

// Save state to localStorage when it changes
watch(isDesktopSidebarVisible, (newValue) => {
  if (process.client) {
    localStorage.setItem('desktopSidebarVisible', String(newValue));
  }
});

// Made with Love section visibility - persist to localStorage
const showMadeWithLove = ref(true);

// Load saved state from localStorage on mount
if (process.client) {
  const savedMadeWithLove = localStorage.getItem('showMadeWithLove');
  if (savedMadeWithLove !== null) {
    showMadeWithLove.value = savedMadeWithLove === 'true';
  }
}

// Save state to localStorage when it changes
watch(showMadeWithLove, (newValue) => {
  if (process.client) {
    localStorage.setItem('showMadeWithLove', String(newValue));
  }
});

function dismissMadeWithLove() {
  showMadeWithLove.value = false;
}

// Delete confirmation modal
const showDeleteModal = ref(false);
const noteToDelete = ref<Note | null>(null);
const isDeleting = ref(false);
const noteShareCount = ref(0); // Track how many users this note is shared with
const showMobileDeleteModal = ref(false);
const noteToDeleteMobile = ref<Note | null>(null);

// Keyboard shortcuts modal
const showShortcutsModal = ref(false);

// Search modal
const showSearchModal = ref(false);
const noteJustSelectedFromSearch = ref(false); // Track if note was just selected from search

// Keyboard shortcut handler reference
let keyboardShortcutHandler: ((event: KeyboardEvent) => void) | null = null;

// Folder management modals
const showCreateFolderModal = ref(false);
const showRenameFolderModal = ref(false);
const showDeleteFolderModal = ref(false);
const newFolderName = ref('');
const renameFolderName = ref('');
const folderToManage = ref<number | null>(null);
const isFolderActionLoading = ref(false);

// Folder container ref (kept for potential future use)
const foldersContainerRef = ref<HTMLElement | null>(null);

// AI generation modal
const showAiGenerateModal = ref(false);
const aiPrompt = ref('');
const isGeneratingAi = ref(false);

// Template selection modal
const showTemplateModal = ref(false);

// Recipe import modal
const showRecipeImportModal = ref(false);
const recipeUrl = ref('');
const isImportingRecipe = ref(false);


// Session key to force re-render on new sessions
const sessionKey = ref('default');

// Watch search expansion to focus input
watch(isSearchExpanded, (expanded) => {
  if (expanded) {
    // Wait for both the DOM update and the transition to start
    nextTick(() => {
      setTimeout(() => {
        searchInputRef.value?.focus();
      }, 50); // Small delay to ensure transition has started
    });
  }
});

// Close menus when clicking anywhere
if (process.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    const isUserButton = target.closest('[data-user-menu-button]');
    const isUserDropdown = target.closest('[data-user-menu-dropdown]');
    const isFabButton = target.closest('[data-fab-button]');
    const isFabMenu = target.closest('[data-fab-menu]');
    const isNoteCreationButton = target.closest('[data-note-creation-button]');
    const isNoteCreationMenu = target.closest('[data-note-creation-menu]');
    
    if (!isUserButton && !isUserDropdown) {
      showUserMenu.value = false;
    }
    
    if (!isFabButton && !isFabMenu) {
      showFabMenu.value = false;
    }
    
    if (!isNoteCreationButton && !isNoteCreationMenu) {
      showNoteCreationMenu.value = false;
    }
  });
}

// Fetch data on mount
// Function to load all data
async function loadData() {
  loading.value = true;
  try {
    // Fetch spaces first, then folders (which depends on current space)
    await spacesStore.fetchSpaces();
    
    // Ensure spaces are loaded before proceeding
    if (spacesStore.spaces.length === 0) {
      console.warn('[Dashboard] No spaces found after fetch');
    }
    
    await Promise.all([
      foldersStore.fetchFolders(),
      notesStore.fetchNotes(),
      notesStore.loadNoteOrder(),
      sharedNotesStore.fetchSharedNotes()
    ]);
    
    // Ensure folders are loaded before marking as initialized
    // Wait an extra tick to ensure all reactive updates are complete
    await nextTick();
    
    hasInitialized.value = true;
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to load data',
      color: 'error'
    });
    // Still mark as initialized to show error state
    hasInitialized.value = true;
  } finally {
    loading.value = false;
  }
}

// Animation state for space switching
const isSwitchingSpace = ref(false);

// Watch for space changes and refetch folders, update tabs
watch(() => spacesStore.currentSpaceId, async (newSpaceId, oldSpaceId) => {
  if (hasInitialized.value && newSpaceId !== oldSpaceId && newSpaceId !== null) {
    console.log('[Dashboard] Space watcher triggered:', {
      oldSpaceId,
      newSpaceId,
      isLoadingNoteFromSearch: isLoadingNoteFromSearch.value,
      noteJustSelectedFromSearch: noteJustSelectedFromSearch.value,
      timestamp: Date.now()
    });
    
    try {
      // Start space switching animation
      // BUT: Don't set isSwitchingSpace if we're loading from search (to prevent hiding activeNote)
      if (!isLoadingNoteFromSearch.value) {
        isSwitchingSpace.value = true;
        console.log('[Dashboard] Setting isSwitchingSpace=true');
      } else {
        console.log('[Dashboard] Skipping isSwitchingSpace (loading from search)');
      }
      
      // First, filter tabs BEFORE animation starts to prevent flashing
      // We'll use the old folders to determine which tabs to close
      const oldSpaceFolderIds = new Set(
        foldersStore.folders.map(f => f.id)
      );
      
      // Pre-filter tabs based on current folder state (before fetching new folders)
      const tabsToClose = notesStore.openTabs.filter(noteId => {
        const note = notesStore.notes.find(n => n.id === noteId);
        if (!note) return true; // Remove if note not found
        
        // Keep shared notes and notes without folders
        if (note.share_permission || note.folder_id === null) {
          return false; // Keep these tabs
        }
        
        // Close tabs that belong to old space folders
        return oldSpaceFolderIds.has(note.folder_id);
      });
      
      // If we have tabs to close, close them immediately before animation
      if (tabsToClose.length > 0) {
        // Remove tabs that should close
        notesStore.openTabs = notesStore.openTabs.filter(id => !tabsToClose.includes(id));
        
        // Update active tab if it's being closed
        if (notesStore.activeTabId && tabsToClose.includes(notesStore.activeTabId)) {
          const remainingTabs = notesStore.openTabs.filter(id => !tabsToClose.includes(id));
          if (remainingTabs.length > 0 && remainingTabs[0]) {
            notesStore.setActiveTab(remainingTabs[0]);
          } else {
            notesStore.activeTabId = null;
          }
        }
        
        notesStore.saveTabsToStorage();
      }
      
      // Wait for tab fade out animation
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Scroll folders up (wrap up animation)
      if (foldersContainerRef.value) {
        foldersContainerRef.value.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';
        foldersContainerRef.value.style.transform = 'translateY(-100%)';
        foldersContainerRef.value.style.opacity = '0';
      }
      
      // Wait for scroll up animation
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Fetch new folders (silently)
      await foldersStore.fetchFolders(undefined, true);
      await sharedNotesStore.fetchSharedNotes();
      
      // Final tab validation after folders are loaded
      // This ensures tabs that should stay are still valid
      const currentSpaceFolderIds = new Set(
        foldersStore.folders.map(f => f.id)
      );
      
      const validTabs = notesStore.openTabs.filter(noteId => {
        const note = notesStore.notes.find(n => n.id === noteId);
        if (!note) {
          return false;
        }
        
        // Keep shared notes for collaborative editing
        if (note.share_permission) {
          return true;
        }
        
        // Keep notes without folders (global notes)
        if (note.folder_id === null) {
          return true;
        }
        
        // Check if note's folder belongs to current space
        const noteFolder = foldersStore.getFolderById(note.folder_id);
        if (!noteFolder) {
          return false;
        }
        
        return currentSpaceFolderIds.has(note.folder_id);
      });
      
      // Only update if there's a difference (to avoid unnecessary reactivity)
      if (validTabs.length !== notesStore.openTabs.length || 
          validTabs.some((id, i) => notesStore.openTabs[i] !== id)) {
        notesStore.openTabs = validTabs;
        
        // Update active tab if it's no longer valid
        if (notesStore.activeTabId && !validTabs.includes(notesStore.activeTabId)) {
          if (validTabs.length > 0 && validTabs[0]) {
            notesStore.setActiveTab(validTabs[0]);
          } else {
            notesStore.activeTabId = null;
          }
        }
        
        notesStore.saveTabsToStorage();
      }
      
      // Wait for next tick to ensure DOM is updated with new folders
      await nextTick();
      
      // Scroll folders down (wrap down animation) - start from above
      if (foldersContainerRef.value) {
        foldersContainerRef.value.style.transform = 'translateY(-100%)';
        foldersContainerRef.value.style.opacity = '0';
        
        // Force reflow
        await nextTick();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Animate down
        foldersContainerRef.value.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-in';
        foldersContainerRef.value.style.transform = 'translateY(0)';
        foldersContainerRef.value.style.opacity = '1';
      }
      
      // Wait for scroll down animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clean up animation styles
      if (foldersContainerRef.value) {
        foldersContainerRef.value.style.transition = '';
        foldersContainerRef.value.style.transform = '';
        foldersContainerRef.value.style.opacity = '';
      }
      
      // Wait a bit more to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // End space switching animation - this will restore activeNote if it's valid
      // But don't clear it if we're loading from search (keep loading state)
      if (!isLoadingNoteFromSearch.value) {
        isSwitchingSpace.value = false;
        console.log('[Dashboard] Clearing isSwitchingSpace');
      } else {
        console.log('[Dashboard] Keeping isSwitchingSpace=false (loading from search)');
        // Still clear it, but loading state will prevent activeNote from being hidden
        isSwitchingSpace.value = false;
      }
    } catch (error) {
      console.error('Failed to fetch folders for new space:', error);
      isSwitchingSpace.value = false;
      
      // Clean up on error
      if (foldersContainerRef.value) {
        foldersContainerRef.value.style.transition = '';
        foldersContainerRef.value.style.transform = '';
        foldersContainerRef.value.style.opacity = '';
      }
    }
  }
});

onMounted(async () => {
  isMounted.value = true; // Mark as mounted to prevent hydration mismatch
  
  if (process.client) {
    // Load session version
    sessionKey.value = localStorage.getItem('session_version') || 'default';
    
    // Restore selected folder from sessionStorage
    const savedFolderId = sessionStorage.getItem('selected_folder_id');
    if (savedFolderId && savedFolderId !== 'null') {
      selectedFolderId.value = parseInt(savedFolderId);
    }

    // Keyboard shortcut: Ctrl+P or Cmd+P to open search
    keyboardShortcutHandler = (event: KeyboardEvent) => {
      // Check if Ctrl+P (Windows/Linux) or Cmd+P (Mac) is pressed
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        showSearchModal.value = true;
      }
    };

    window.addEventListener('keydown', keyboardShortcutHandler);
  }

  await loadData();
  
  // Load open tabs
  if (process.client) {
    await notesStore.loadTabsFromStorage();
  }
  
  // Data loaded
  await nextTick();
});

onUnmounted(() => {
  // Clean up keyboard shortcut listener
  if (process.client && keyboardShortcutHandler) {
    window.removeEventListener('keydown', keyboardShortcutHandler);
    keyboardShortcutHandler = null;
  }
});

// Refresh notes when navigating back (onActivated for KeepAlive)
onActivated(async () => {
  // Only refresh if already initialized (skip first mount)
  if (hasInitialized.value) {
    try {
      await Promise.all([
        foldersStore.fetchFolders(),
        notesStore.fetchNotes()
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }
});

// Watch for navigation back to dashboard (alternative to onActivated)
watch(() => route.path, async (newPath) => {
  if (newPath === '/dashboard' && hasInitialized.value) {
    // Restore selected folder from sessionStorage
    if (process.client) {
      const savedFolderId = sessionStorage.getItem('selected_folder_id');
      if (savedFolderId && savedFolderId !== 'null') {
        selectedFolderId.value = parseInt(savedFolderId);
      } else {
        selectedFolderId.value = null;
      }
    }
    
    // Refresh data when navigating back to dashboard
    try {
      await Promise.all([
        notesStore.fetchNotes(),
        foldersStore.fetchFolders()
      ]);
    } catch (error) {
      console.error('Failed to refresh on navigation:', error);
    }
  }
}, { immediate: false });


// Active note from store - ensure reactivity for folder_id changes
// Hide note during space switching to prevent flashing
const activeNote = computed(() => {
  const storeNote = notesStore.activeNote;
  const isLoading = isLoadingNoteFromSearch.value;
  const isSwitching = isSwitchingSpace.value;
  
  // Log when activeNote computed is evaluated and might return null
  if (!storeNote || (isSwitching && !isLoading)) {
    console.log('[Dashboard] activeNote computed:', {
      storeNoteId: storeNote?.id,
      isSwitchingSpace: isSwitching,
      isLoadingNoteFromSearch: isLoading,
      willReturnNull: isSwitching && !isLoading && storeNote && !storeNote.share_permission && storeNote.folder_id !== null,
      timestamp: Date.now()
    });
  }
  
  // Don't show active note if we're switching spaces and it's being closed
  // BUT: Don't hide it if we're loading from search (keep loading indicator visible)
  if (isSwitchingSpace.value && !isLoadingNoteFromSearch.value) {
    // Check if current active note is valid
    const note = notesStore.activeNote;
    if (note) {
      // During space switch, only show if it's a shared note or has no folder (global)
      // Otherwise, hide it to prevent flashing
      if (note.share_permission || note.folder_id === null) {
        return note;
      }
      // Check if note's folder belongs to the new space (we'll verify after folders load)
      // For now, hide it during transition to prevent flash
      return null;
    }
  }
  return notesStore.activeNote;
});

// Notes without folders (for "All Notes" section)
// Only show notes that belong to the current space and have no folder
// Notes are associated with spaces through folders, so notes without folders
// are shown in the current space context
// We need to exclude notes that belong to folders in other spaces
const notesWithoutFolder = computed(() => {
  const currentSpaceId = spacesStore.currentSpaceId;
  if (!currentSpaceId) return [];
  
  // Get all folder IDs in the current space
  const currentSpaceFolderIds = new Set(
    foldersStore.folders
      .filter(f => f.space_id === currentSpaceId)
      .map(f => f.id)
  );
  
  return notesStore.notes.filter(note => {
    // Only show notes owned by user (not shared with them)
    if (note.share_permission) return false;
    
    // Only show notes without folders (root level)
    if (note.folder_id !== null) {
      // If note has a folder_id, check if it belongs to current space
      // If folder is not in current space folders, exclude it
      if (!currentSpaceFolderIds.has(note.folder_id)) {
        return false;
      }
      // If it has a folder_id, it's not a root note, so exclude it
      return false;
    }
    
    // Note is without folder (folder_id === null), show it in current space
    return true;
  });
});

// Filtered notes for selected folder (for mobile list view)
const filteredNotesForFolder = computed(() => {
  if (selectedFolderId.value === null) return [];
  
  const currentSpaceId = spacesStore.currentSpaceId;
  if (!currentSpaceId) return [];
  
  // Get the selected folder to verify it belongs to current space
  const selectedFolder = foldersStore.getFolderById(selectedFolderId.value);
  if (!selectedFolder || selectedFolder.space_id !== currentSpaceId) return [];
  
  return notesStore.notes.filter(note => {
    // Only show notes owned by user (not shared with them)
    if (note.share_permission) return false;
    
    // Only show notes in the selected folder (direct children only, not subfolders)
    // This ensures we don't show notes from subfolders
    if (note.folder_id !== selectedFolderId.value) return false;
    
    // Notes are associated with spaces through folders, so if the folder
    // belongs to the current space, the note does too
    return true;
  }).sort((a, b) => {
    // Sort by updated_at descending (most recent first)
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
});

// Display notes for mobile (folder selected or all notes without folders)
const displayNotes = computed(() => {
  if (selectedFolderId.value !== null) {
    // Show notes in selected folder
    return filteredNotesForFolder.value;
  } else {
    // Show all notes without folders (Quick Notes)
    return notesWithoutFolder.value.sort((a, b) => {
      // Sort by updated_at descending (most recent first)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }
});

// Watch for active note folder_id changes separately to catch moves
watch(
  () => activeNote.value?.folder_id,
  (newFolderId, oldFolderId) => {
    const note = activeNote.value;
    
    if (!note) return;
    
    // If folder_id changed, update editForm immediately
    if (newFolderId !== oldFolderId && newFolderId !== editForm.folder_id) {
      console.log('[Dashboard] Folder changed, updating editForm', {
        oldFolderId: editForm.folder_id,
        newFolderId: note.folder_id
      });
      
      const folderName = note.folder_id 
        ? foldersStore.getFolderById(note.folder_id)?.name || null
        : null;
      
      editForm.folder_id = note.folder_id || null;
      editForm.folder = folderName || '';
      prevFolderId.value = note.folder_id || null;
      
      console.log('[Dashboard] editForm.folder_id updated', {
        folder_id: editForm.folder_id,
        folder: editForm.folder
      });
    }
  },
  { immediate: false }
);

// Clear attachments when active note becomes null
watch(() => activeNote.value?.id, (newId, oldId) => {
  if (!newId && oldId) {
    // Note was closed, clear attachments
    attachments.value = [];
  }
});

// Watch for active note changes and load it
watch(activeNote, (note, oldNote) => {
  // Close mobile sidebar when a note becomes active
  if (note && (!oldNote || oldNote.id !== note.id)) {
    isMobileSidebarOpen.value = false;
    
    // If we were loading from search and the note is now active, DON'T clear loading state here
    // The handleNoteSelected function will handle clearing it after editor is mounted
    // This prevents race conditions where the watcher clears loading before editor is ready
  }
  
  // Skip if note hasn't actually changed (prevent duplicate updates)
  // But ALWAYS update if folder_id changed (even if same note)
  // OR if sharing status changed (e.g., after unsharing)
  const folderIdChanged = oldNote && note && oldNote.id === note.id && oldNote.folder_id !== note.folder_id;
  const sharingStatusChanged = oldNote && note && oldNote.id === note.id && 
    ((oldNote.is_shared !== note.is_shared) || (oldNote.share_permission !== note.share_permission));
  
  console.log('[Dashboard] Active note watcher triggered', {
    noteId: note?.id,
    oldNoteId: oldNote?.id,
    sameNote: oldNote?.id === note?.id,
    folderIdChanged,
    sharingStatusChanged,
    oldNoteIsShared: oldNote?.is_shared,
    newNoteIsShared: note?.is_shared,
    oldFolderId: oldNote?.folder_id,
    newFolderId: note?.folder_id,
    updatedAtChanged: oldNote?.updated_at !== note?.updated_at
  });
  
  if (oldNote && note && oldNote.id === note.id && oldNote.updated_at === note.updated_at && !folderIdChanged && !sharingStatusChanged) {
    console.log('[Dashboard] Skipping update - note unchanged');
    return;
  }
  
    if (note) {
    console.log('[Dashboard] Active note changed:', {
      id: note.id.substring(0, 20),
      is_shared: note.is_shared,
      share_permission: note.share_permission,
      willUseCollabEditor: !!(note.is_shared || note.share_permission),
      hasContent: !!note.content,
      contentLength: note.content ? note.content.length : 0
    });
    
    // Check publish status
    checkPublishStatus();
    
    // Clear and load attachments for the active note
    attachments.value = [];
    loadAttachments(note.id);
    
    // If note doesn't have content or seems incomplete, try to fetch it
    if ((!note.content || note.content === '') && process.client) {
      console.log('[Dashboard] Note missing content, fetching full note:', note.id);
      notesStore.fetchNote(note.id).catch(err => {
        console.error('[Dashboard] Failed to fetch note:', err);
      });
    }
    
    // For collaborative notes, don't update editForm.content (CollaborativeEditor handles it)
    // Only update title and metadata for the UI
    // BUT if transitioning FROM collaborative TO regular (unsharing), update content
    const wasCollaborative = oldNote && (oldNote.is_shared || oldNote.share_permission);
    const isNowCollaborative = note.is_shared || note.share_permission;
    const transitioningToRegular = wasCollaborative && !isNowCollaborative;
    
    if (isNowCollaborative && !transitioningToRegular) {
      console.log('[Dashboard] Loading collaborative note');
      
      // Set flag to prevent auto-save during programmatic update
      isProgrammaticUpdate.value = true;
      
      try {
        editForm.title = note.title;
        editForm.tags = note.tags || [];
        editForm.folder = note.folder || '';
        editForm.folder_id = note.folder_id || null;
        // CRITICAL: Update editForm.content with note.content so UnifiedEditor gets it as initialContent
        // This is especially important when sharing a note - the content must be available
        if (note.content) {
          editForm.content = note.content;
          console.log('[Dashboard] Updated editForm.content for collaborative note', {
            contentLength: note.content.length,
            preview: note.content.substring(0, 100)
          });
        }
        
        // Initialize previous values for change detection
        prevTitle.value = note.title;
        prevContent.value = editForm.content || note.content || ''; // Use note content if editForm is empty
        prevFolderId.value = note.folder_id || null;
      } finally {
        // Clear flag after update
        nextTick(() => {
          isProgrammaticUpdate.value = false;
        });
      }
    } else {
      // For regular notes, ALWAYS update if it's a different note
      // OR if content/folder changed (even if same note)
      const isDifferentNote = !oldNote || oldNote.id !== note.id;
      const contentChanged = note.content !== editForm.content;
      const folderChanged = folderIdChanged || note.folder_id !== editForm.folder_id;
      
      console.log('[Dashboard] Regular note update check', {
        isDifferentNote,
        contentChanged,
        folderChanged,
        folderIdChanged,
        noteFolderId: note.folder_id,
        editFormFolderId: editForm.folder_id,
        noteContent: note.content ? note.content.substring(0, 50) : 'null/undefined',
        editFormContent: editForm.content ? editForm.content.substring(0, 50) : 'null/undefined'
      });
      
      // Always update editForm when switching to a different note
      // OR when content/folder changed (for same note)
      if (isDifferentNote || contentChanged || folderChanged) {
        console.log('[Dashboard] Updating editForm with note data', {
          folder_id: note.folder_id,
          folder: note.folder,
          isShared: note.is_shared || note.share_permission
        });
        
        // Set flag to prevent auto-save from triggering during programmatic update
        // This is critical for shared notes to prevent overwriting collaborative edits
        isProgrammaticUpdate.value = true;
        
        try {
          // Update editForm - use folder name from foldersStore if available
          const folderName = note.folder_id 
            ? foldersStore.getFolderById(note.folder_id)?.name || note.folder || null
            : null;
          
          Object.assign(editForm, {
            title: note.title,
            content: note.content || '',
            tags: note.tags || [],
            folder: folderName || '',
            folder_id: note.folder_id || null
          });
          
          // Initialize previous values for change detection
          prevTitle.value = note.title;
          prevContent.value = note.content || '';
          prevFolderId.value = note.folder_id || null;
          
          console.log('[Dashboard] editForm updated', {
            folder_id: editForm.folder_id,
            folder: editForm.folder,
            folderName
          });
        } finally {
          // Clear flag after a tick to allow user-initiated edits to trigger saves
          nextTick(() => {
            isProgrammaticUpdate.value = false;
          });
        }
      }
    }
    
    // Load lock state
    if (process.client && note.id) {
      const savedLockState = localStorage.getItem(`note-${note.id}-locked`);
      isLocked.value = savedLockState === 'true';
    }
  }
}, { immediate: true });

// Auto-save on content change (only when not locked)
// IMPORTANT: Skip auto-save for collaborative notes title/content (Y.Doc handles syncing)
// LOCK DOWN: Never auto-save shared notes unless it's a user-initiated change
watch([() => editForm.title, () => editForm.content, () => editForm.folder_id], 
  ([newTitle, newContent, newFolderId]) => {
    if (isLocked.value || !activeNote.value) return;
    
    // CRITICAL: Skip auto-save if this is a programmatic update (e.g., switching tabs/spaces)
    // This prevents overwriting shared notes when switching contexts
    if (isProgrammaticUpdate.value) {
      console.log('[Dashboard] Skipping auto-save - programmatic update in progress');
      return;
    }
    
    // Detect what changed
    const titleChanged = newTitle !== prevTitle.value;
    const contentChanged = newContent !== prevContent.value;
    const folderChanged = newFolderId !== prevFolderId.value;
    
    // Update previous values (handle undefined)
    prevTitle.value = (newTitle as string) || '';
    prevContent.value = (newContent as string) || '';
    prevFolderId.value = (newFolderId as number | null) ?? null;
    
    // For collaborative/shared notes: NEVER auto-save title/content (Y.Doc handles it)
    // Only allow folder changes if they're user-initiated (not from programmatic updates)
    const isCollaborative = activeNote.value.is_shared || activeNote.value.share_permission;
    if (isCollaborative) {
      // For shared notes, skip ALL auto-saves - only user-initiated saves should work
      // Y.Doc handles content sync, and we don't want to overwrite collaborative edits
      console.log('[Dashboard] Skipping auto-save for shared/collaborative note - Y.Doc handles syncing');
      return;
    }
    
    if (autoSaveTimeout.value) {
      clearTimeout(autoSaveTimeout.value);
    }
    
    autoSaveTimeout.value = setTimeout(() => {
      saveNote(true);
    }, 1000); // Auto-save after 1 second of inactivity
  }
);

const userInitial = computed(() => {
  const name = (authStore.currentUser?.name || authStore.currentUser?.email || 'User') as string;
  return name.charAt(0).toUpperCase();
});

// Breadcrumb path for current folder
const folderBreadcrumb = computed(() => {
  if (selectedFolderId.value === null) {
    return [];
  }
  
  const breadcrumb: Array<{ id: number; name: string }> = [];
  let currentId: number | null = selectedFolderId.value;
  
  // Build breadcrumb by traversing up parent folders
  while (currentId !== null) {
    const folder = foldersStore.getFolderById(currentId);
    if (!folder) break;
    
    breadcrumb.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  
  return breadcrumb;
});

// Folder selection
function selectFolder(folderId: number) {
  selectedFolderId.value = folderId;
  // Don't close mobile sidebar - user may want to browse folders
  // Sidebar only closes when note is opened, settings/logout clicked, or X button clicked
  // Persist selected folder to sessionStorage
  if (process.client) {
    sessionStorage.setItem('selected_folder_id', String(folderId));
  }
}

function selectAllNotes() {
  selectedFolderId.value = null;
  // Don't close mobile sidebar - user may want to browse folders
  // Sidebar only closes when note is opened, settings/logout clicked, or X button clicked
  // Clear persisted folder selection
  if (process.client) {
    sessionStorage.removeItem('selected_folder_id');
  }
}

// Folder tree handlers (no toggle needed - folders always show notes)

// Mobile sheet handlers
function handleOpenSpacesSheet() {
  nextTick(() => {
    if (!spaceButtonRef.value) {
      // Fallback positioning if ref not available
      spacesDropdownPos.value = {
        top: 60,
        left: 16,
        width: Math.min(window.innerWidth - 32, 360)
      };
    } else {
      const rect = spaceButtonRef.value.getBoundingClientRect();
      spacesDropdownPos.value = {
        top: rect.bottom + 8,
        left: Math.max(8, rect.left),
        width: Math.min(window.innerWidth - Math.max(8, rect.left) - 8, 360)
      };
    }
    showMobileSpacesSheet.value = true;
  });
}

function handleOpenFoldersSheet() {
  nextTick(() => {
    if (!folderButtonRef.value) {
      // Fallback positioning if ref not available
      foldersDropdownPos.value = {
        top: 60,
        left: 16,
        width: Math.min(window.innerWidth - 32, 400)
      };
    } else {
      const rect = folderButtonRef.value.getBoundingClientRect();
      foldersDropdownPos.value = {
        top: rect.bottom + 8,
        left: Math.max(8, rect.left),
        width: Math.min(window.innerWidth - Math.max(8, rect.left) - 8, 400)
      };
    }
    showMobileFoldersSheet.value = true;
  });
}

function handleOpenCreateMenu() {
  nextTick(() => {
    if (!createButtonRef.value) {
      // Fallback positioning if ref not available
      createDropdownPos.value = {
        top: 60,
        left: Math.max(8, window.innerWidth - 288),
        width: 280
      };
    } else {
      const rect = createButtonRef.value.getBoundingClientRect();
      createDropdownPos.value = {
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - 280), // Position dropdown to the left of button
        width: 280
      };
    }
    showMobileCreateMenu.value = true;
  });
}

function handleOpenFolderMenu(folderId: number, event: MouseEvent) {
  event.stopPropagation();
  folderMenuOpen.value = folderId;
  
  nextTick(() => {
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    folderMenuPos.value = {
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - 200),
      width: 200
    };
  });
}

function handleCloseFolderMenu() {
  folderMenuOpen.value = null;
}

async function handleSelectSpace(spaceId: number) {
  if (spacesStore.currentSpaceId === spaceId) {
    showMobileSpacesSheet.value = false;
    return;
  }
  
  spacesStore.setCurrentSpace(spaceId);
  // Reset folder selection when space changes
  selectedFolderId.value = null;
  if (process.client) {
    sessionStorage.removeItem('selected_folder_id');
  }
  showMobileSpacesSheet.value = false;
}

function handleSelectFolder(folderId: number) {
  selectFolder(folderId);
  showMobileFoldersSheet.value = false;
}

// Computed: Get folders to display (all folders in current space)
const displayedFolders = computed(() => {
  const currentSpaceId = spacesStore.currentSpaceId;
  if (!currentSpaceId) return [];
  return foldersStore.folders.filter(f => f.space_id === currentSpaceId);
});

// Computed: Get note count for a folder
const getFolderNoteCount = (folderId: number) => {
  return notesStore.notes.filter(n => n.folder_id === folderId && !n.share_permission).length;
};

// Handle folder click - always select folder (no navigation needed)
function handleFolderClick(folder: Folder) {
  handleSelectFolder(folder.id);
}


async function handleCreateNoteInFolder(folderId: number) {
  if (isCreating.value) return;
  
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'Untitled Note',
      content: '',
      folder_id: folderId
    };
    
    const note = await notesStore.createNote(noteData);
    // Refresh notes and open in a new tab
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
    // Close mobile sidebar when note is opened
    isMobileSidebarOpen.value = false;
    
    toast.add({
      title: 'Success',
      description: 'Note created in folder',
      color: 'success'
    });
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleQuickNoteInFolder(folderId: number) {
  if (isCreating.value) return;
  
  isCreating.value = true;
  
  try {
    // Create a note with timestamp
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const noteData: CreateNoteDto = {
      title: timestamp,
      content: `<p></p>`,
      folder_id: folderId
    };
    
    const note = await notesStore.createNote(noteData);
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
    
    toast.add({
      title: 'Success',
      description: 'Quick note created',
      color: 'success'
    });
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create quick note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleListNoteInFolder(folderId: number) {
  if (isCreating.value) return;
  
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'New List',
      content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      folder_id: folderId
    };
    
    const note = await notesStore.createNote(noteData);
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
    // Close mobile sidebar when note is opened
    isMobileSidebarOpen.value = false;
    
    toast.add({
      title: 'Success',
      description: 'List note created in folder',
      color: 'success'
    });
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create list note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleDailyNoteInFolder(folderId: number) {
  if (isCreating.value) return;
  
  isCreating.value = true;
  
  try {
    // Find the Daily Journal template
    const dailyJournalTemplate = noteTemplates.find(t => t.id === 'daily-journal');
    
    if (!dailyJournalTemplate) {
      toast.add({
        title: 'Error',
        description: 'Daily Journal template not found',
        color: 'error'
      });
      return;
    }
    
    const noteData: CreateNoteDto = {
      title: `Daily Journal - ${new Date().toLocaleDateString()}`,
      content: dailyJournalTemplate.content,
      folder_id: folderId
    };
    
    const note = await notesStore.createNote(noteData);
    
    toast.add({
      title: 'Success',
      description: 'Daily journal created successfully',
      color: 'success'
    });
    
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create daily note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

function handleTemplateNoteInFolder(folderId: number) {
  // Store folder ID to use when template is selected
  selectedFolderIdForTemplate.value = folderId;
  showTemplateModal.value = true;
}

function handleAiGenerateInFolder(folderId: number) {
  // Store folder ID to use when AI note is generated
  selectedFolderIdForAi.value = folderId;
  openAiGenerateModal();
}

function handleRecipeImportInFolder(folderId: number) {
  // Store folder ID to use when recipe is imported
  selectedFolderIdForRecipe.value = folderId;
  openRecipeImportModal();
}

// Store folder IDs for template, AI, and recipe actions
const selectedFolderIdForTemplate = ref<number | null>(null);
const selectedFolderIdForAi = ref<number | null>(null);
const selectedFolderIdForRecipe = ref<number | null>(null);

function handleRenameFolder(folderId: number) {
  const folder = foldersStore.getFolderById(folderId);
  if (folder) {
    folderToManage.value = folderId;
    renameFolderName.value = folder.name;
    showRenameFolderModal.value = true;
  }
}

function handleDeleteFolder(folderId: number) {
  folderToManage.value = folderId;
  showDeleteFolderModal.value = true;
}

// Check folder publish status
async function checkFolderPublishStatus(folderId: number) {
  try {
    const status = await $fetch<{ is_published: boolean; share_url?: string; parent_space_published?: boolean }>(`/api/folders/${folderId}/publish-status`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    folderPublishStatuses.value.set(folderId, status);
    return status;
  } catch (error) {
    console.error('Error checking folder publish status:', error);
    folderPublishStatuses.value.set(folderId, { is_published: false });
    return { is_published: false };
  }
}

// Publish/Unpublish folder handlers
async function handlePublishFolder(folderId: number) {
  try {
    // Check if parent space is published
    const folder = foldersStore.getFolderById(folderId);
    if (folder) {
      const status = await checkFolderPublishStatus(folderId);

      // If already published, show modal with link
      if (status.is_published && status.share_url) {
        currentFolderPublishStatus.value = {
          folderId,
          folderName: folder.name,
          is_published: true,
          share_url: status.share_url
        };
        showFolderPublishModal.value = true;
        return;
      }

      if (status.parent_space_published) {
        const confirmed = confirm('This folder is in a published space. Publishing the space already makes all folders and notes public. Do you still want to publish this folder separately?');
        if (!confirmed) return;
      }

      const response = await $fetch<{ share_id: string; share_url: string }>(`/api/folders/${folderId}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      });

      // Update status and show modal
      folderPublishStatuses.value.set(folderId, { is_published: true, share_url: response.share_url });
      currentFolderPublishStatus.value = {
        folderId,
        folderName: folder.name,
        is_published: true,
        share_url: response.share_url
      };
      showFolderPublishModal.value = true;

      toast.add({
        title: 'Folder Published',
        description: `All notes and subfolders in "${folder.name}" are now publicly accessible`,
        color: 'success'
      });

      // Refresh folders to show updated state
      await foldersStore.fetchFolders();
    }
  } catch (error: any) {
    console.error('Error publishing folder:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to publish folder',
      color: 'error'
    });
  }
}

async function handleCopyFolderLink(folderId: number) {
  try {
    const folder = foldersStore.getFolderById(folderId);
    if (!folder) return;

    // Get current status
    const status = await checkFolderPublishStatus(folderId);

    if (status.is_published && status.share_url) {
      if (process.client && navigator.clipboard) {
        navigator.clipboard.writeText(status.share_url);
        toast.add({
          title: 'Link Copied',
          description: 'Folder share link copied to clipboard',
          color: 'success'
        });
      }
    } else {
      toast.add({
        title: 'Not Published',
        description: 'This folder is not published yet',
        color: 'warning'
      });
    }
  } catch (error: any) {
    console.error('Error copying folder link:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to copy link',
      color: 'error'
    });
  }
}

async function handleUnpublishFolder(folderId: number) {
  const folder = foldersStore.getFolderById(folderId);
  if (!folder) return;

  // Show confirmation modal
  folderToUnpublish.value = {
    folderId,
    folderName: folder.name
  };
  showUnpublishFolderModal.value = true;
}

async function confirmUnpublishFolder() {
  if (!folderToUnpublish.value) return;

  try {
    const { folderId, folderName } = folderToUnpublish.value;

    await $fetch(`/api/folders/${folderId}/unpublish`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });

    // Update status
    folderPublishStatuses.value.set(folderId, { is_published: false });
    showFolderPublishModal.value = false;
    showUnpublishFolderModal.value = false;
    folderToUnpublish.value = null;

    toast.add({
      title: 'Folder Unpublished',
      description: `"${folderName}" and all its contents are no longer publicly accessible`,
      color: 'success'
    });

    await foldersStore.fetchFolders();
  } catch (error: any) {
    console.error('Error unpublishing folder:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to unpublish folder',
      color: 'error'
    });
  }
}

async function handleMoveUp(folderId: number) {
  try {
    const siblings = foldersStore.getSiblings(folderId);
    const currentIndex = siblings.findIndex(f => f.id === folderId);
    if (currentIndex > 0) {
      // reorderFolder already calls fetchFolders() internally, so no need to call it again
      await foldersStore.reorderFolder(folderId, currentIndex - 1);
      
      toast.add({
        title: 'Success',
        description: 'Folder moved up',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Move up error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to move folder up',
      color: 'error'
    });
  }
}

async function handleMoveDown(folderId: number) {
  try {
    const siblings = foldersStore.getSiblings(folderId);
    const currentIndex = siblings.findIndex(f => f.id === folderId);
    if (currentIndex !== -1 && currentIndex < siblings.length - 1) {
      // reorderFolder already calls fetchFolders() internally, so no need to call it again
      await foldersStore.reorderFolder(folderId, currentIndex + 1);
      
      toast.add({
        title: 'Success',
        description: 'Folder moved down',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Move down error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to move folder down',
      color: 'error'
    });
  }
}

async function handleFolderReorder(folderId: number, newIndex: number) {
  try {
    console.log('[Dashboard] Reordering folder', { folderId, newIndex });
    // reorderFolder already calls fetchFolders() internally, so no need to call it again
    await foldersStore.reorderFolder(folderId, newIndex);
  } catch (error) {
    console.error('Reorder folder error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to reorder folder',
      color: 'error'
    });
  }
}


// Folder CRUD operations
function openCreateFolderModal() {
  newFolderName.value = '';
  showCreateFolderModal.value = true;
  isMobileSidebarOpen.value = false;
}

async function createFolder() {
  const name = newFolderName.value.trim();
  if (!name) {
    toast.add({
      title: 'Validation Error',
      description: 'Folder name cannot be empty',
      color: 'error'
    });
    return;
  }

  isFolderActionLoading.value = true;

  try {
    const folder = await foldersStore.createFolder({
      name
    });

    toast.add({
      title: 'Success',
      description: `Folder "${name}" created`,
      color: 'success'
    });

    showCreateFolderModal.value = false;
    selectedFolderId.value = folder.id;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

async function renameFolder() {
  const folderId = folderToManage.value;
  const newName = renameFolderName.value.trim();
  
  if (!folderId || !newName) return;

  const folder = foldersStore.getFolderById(folderId);
  if (newName === folder?.name) {
    showRenameFolderModal.value = false;
    return;
  }

  isFolderActionLoading.value = true;

  try {
    await foldersStore.updateFolder(folderId, { name: newName });

    toast.add({
      title: 'Success',
      description: `Folder renamed to "${newName}"`,
      color: 'success'
    });

    showRenameFolderModal.value = false;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to rename folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

async function deleteFolder() {
  const folderId = folderToManage.value;
  if (!folderId) return;

  isFolderActionLoading.value = true;

  try {
    await foldersStore.deleteFolder(folderId);

    const folder = foldersStore.getFolderById(folderId);
    toast.add({
      title: 'Success',
      description: `Folder "${folder?.name}" deleted`,
      color: 'success'
    });

    if (selectedFolderId.value === folderId) {
      selectedFolderId.value = null;
    }

    showDeleteFolderModal.value = false;
    
    // Refresh notes to update the list
    await notesStore.fetchNotes();
  } catch (error) {
    console.error('Delete folder error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to delete folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

// Share note functions - REMOVED (collaboration feature disabled)

async function removeShare(shareId: number) {
  try {
    // Preserve the active note ID before unsharing
    const activeNoteId = activeNote.value?.id;
    const wasShared = activeNote.value?.is_shared || activeNote.value?.share_permission;
    
    // If the note is currently shared (using CollaborativeEditor), save the current content
    // from CollaborativeEditor's Y.Doc to the database before unsharing
    if (wasShared && activeNote.value) {
      console.log('[Dashboard] Saving CollaborativeEditor content before unsharing');
      try {
        // Get the current content directly from UnifiedEditor (collaborative mode)
        let contentToSave = '';
        if (collaborativeEditorRef.value?.getCurrentContent) {
          contentToSave = collaborativeEditorRef.value.getCurrentContent();
          console.log('[Dashboard] Got content from UnifiedEditor (collaborative), length:', contentToSave.length);
        } else {
          // Fallback: use content from activeNote (updated by UnifiedEditor's @update:content)
          contentToSave = activeNote.value.content || '';
          console.log('[Dashboard] Using content from activeNote, length:', contentToSave.length);
        }
        
        // Only save if we have content
        if (contentToSave || activeNote.value.title) {
          await notesStore.updateNote(activeNoteId!, {
            title: activeNote.value.title,
            content: contentToSave, // Get content from CollaborativeEditor
            tags: activeNote.value.tags || [],
            folder_id: activeNote.value.folder_id || null
          });
          console.log('[Dashboard] Content saved successfully, length:', contentToSave.length);
        }
      } catch (saveError) {
        console.error('[Dashboard] Failed to save content before unsharing:', saveError);
        // Continue with unsharing even if save fails
      }
    }
    
    await sharedNotesStore.removeShare(shareId);
    
    // Refresh notes to update the is_shared field
    await notesStore.fetchNotes();
    
    // Explicitly refetch the active note to ensure it has correct data
    if (activeNoteId) {
      await notesStore.fetchNote(activeNoteId);
      
      // Force update editForm after unsharing to ensure content is displayed
      // The active note watcher should pick this up, but we'll trigger it manually if needed
      await nextTick();
      
      // Ensure the note is in the notes array and properly updated
      const updatedNote = notesStore.notes.find(n => n.id === activeNoteId);
      if (updatedNote && activeNote.value) {
        // Force reactivity update by ensuring the note reference is updated
        const noteIndex = notesStore.notes.findIndex(n => n.id === activeNoteId);
        if (noteIndex !== -1) {
          // Update the note in the array to trigger reactivity
          notesStore.notes[noteIndex] = { ...updatedNote };
        }
      }
    }
    
    toast.add({
      title: 'Success',
      description: 'Share removed',
      color: 'success'
    });
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to remove share',
      color: 'error'
    });
  }
}


// Computed for current note shares
const currentNoteShares = computed(() => {
  if (!activeNote.value) return [];
  return sharedNotesStore.getSharesForNote(activeNote.value.id);
});

// Helper function to generate user color for collaboration
function generateUserColor(userId?: number): string {
  if (!userId) return '#3b82f6';
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
  return colors[userId % colors.length] || '#3b82f6';
}

// Note CRUD operations
async function handleCreateNote() {
  if (isCreating.value) return;
  
  showFabMenu.value = false;
  showNoteCreationMenu.value = false;
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'Untitled Note',
      content: '',
      folder_id: null
    };
    
    const note = await notesStore.createNote(noteData);
    // Refresh notes and open in a new tab
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleListNote() {
  if (isCreating.value) return;
  
  showFabMenu.value = false;
  showNoteCreationMenu.value = false;
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'New List',
      content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      folder_id: null
    };
    
    const note = await notesStore.createNote(noteData);
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create list note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

function handleAiGenerate() {
  showFabMenu.value = false;
  showNoteCreationMenu.value = false;
  openAiGenerateModal();
}

function openAiGenerateModal() {
  aiPrompt.value = '';
  showAiGenerateModal.value = true;
}

function handleTemplateNote() {
  showFabMenu.value = false;
  showNoteCreationMenu.value = false;
  showTemplateModal.value = true;
}

async function createNoteFromTemplate(template: NoteTemplate) {
  if (isCreating.value) return;
  
  const folderId = selectedFolderIdForTemplate.value;
  showTemplateModal.value = false;
  isCreating.value = true;
  selectedFolderIdForTemplate.value = null;
  
  try {
    const noteData: CreateNoteDto = {
      title: template.title,
      content: template.content,
      folder_id: folderId ?? null
    };
    
    const note = await notesStore.createNote(noteData);
    
    toast.add({
      title: 'Success',
      description: `Created note from ${template.title} template`,
      color: 'success'
    });
    
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create note from template',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function generateAiNote() {
  const prompt = aiPrompt.value.trim();
  if (!prompt) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter a prompt for the AI',
      color: 'error'
    });
    return;
  }

  const folderId = selectedFolderIdForAi.value;
  isGeneratingAi.value = true;
  // Don't clear folderId yet - we need it for the API call

  try {
    const response = await $fetch<Note>('/api/notes/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        prompt: prompt,
        folder_id: folderId ?? null
      }
    });

    // Track analytics
    try {
      await $fetch('/api/analytics/track', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: {
          event_type: 'note_generated',
          event_data: { note_id: response.id, prompt_length: prompt.length },
          note_id: response.id,
        },
      });
    } catch (e) {
      // Ignore analytics errors
    }

    toast.add({
      title: 'Success',
      description: 'AI-generated note created successfully',
      color: 'success'
    });

    showAiGenerateModal.value = false;
    selectedFolderIdForAi.value = null;
    await notesStore.fetchNotes();
    await notesStore.openTab(response.id);
  } catch (error) {
    console.error('AI generation error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to generate note with AI. Please try again.',
      color: 'error'
    });
    // Reset folder ID on error so user can try again
    selectedFolderIdForAi.value = null;
  } finally {
    isGeneratingAi.value = false;
  }
}

function handleRecipeImport() {
  showFabMenu.value = false;
  showNoteCreationMenu.value = false;
  openRecipeImportModal();
}

function openRecipeImportModal() {
  recipeUrl.value = '';
  showRecipeImportModal.value = true;
}

async function importRecipe() {
  const url = recipeUrl.value.trim();
  if (!url) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter a recipe URL',
      color: 'error'
    });
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter a valid URL',
      color: 'error'
    });
    return;
  }

  const folderId = selectedFolderIdForRecipe.value;
  isImportingRecipe.value = true;
  // Don't clear folderId yet - we need it for the API call

  try {
    const response = await $fetch<Note>('/api/notes/import-recipe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        url: url,
        folder_id: folderId ?? null
      }
    });

    toast.add({
      title: 'Success',
      description: 'Recipe imported successfully',
      color: 'success'
    });

    showRecipeImportModal.value = false;
    selectedFolderIdForRecipe.value = null;
    await notesStore.fetchNotes();
    await notesStore.openTab(response.id);
  } catch (error: any) {
    console.error('Recipe import error:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to import recipe. Please try again.',
      color: 'error'
    });
    // Reset folder ID on error so user can try again
    selectedFolderIdForRecipe.value = null;
  } finally {
    isImportingRecipe.value = false;
  }
}

async function handleDeleteNote(note: Note) {
  noteToDelete.value = note;
  noteShareCount.value = 0;
  
  // Check if note is shared and get count
  if (note.is_shared) {
    try {
      const shares = sharedNotesStore.getSharesForNote(note.id);
      noteShareCount.value = shares.length;
    } catch (error) {
      console.error('Error fetching share count:', error);
    }
  }
  
  showDeleteModal.value = true;
}

function handleDeleteNoteMobile(note: Note) {
  noteToDeleteMobile.value = note;
  showMobileDeleteModal.value = true;
}

async function confirmDeleteMobile() {
  if (!noteToDeleteMobile.value) return;
  
  isDeleting.value = true;
  const deletedNoteId = noteToDeleteMobile.value.id;
  const wasShared = noteToDeleteMobile.value.is_shared || noteToDeleteMobile.value.share_permission;
  const wasActiveNote = notesStore.activeTabId === deletedNoteId;

  try {
    // Close the tab if it's open
    if (notesStore.openTabs.includes(deletedNoteId)) {
      notesStore.closeTab(deletedNoteId);
    }
    
    // If this was the active note, close it gracefully
    if (wasActiveNote) {
      notesStore.activeTabId = null;
    }
    
    // Delete the note - shared_notes entries will be automatically deleted via CASCADE
    await notesStore.deleteNote(deletedNoteId);
    
    // Refresh shared notes list if this was a shared note
    if (wasShared) {
      await sharedNotesStore.fetchSharedNotes();
    }
    
    // Force refresh the notes list to ensure UI updates
    await notesStore.fetchNotes();
    
    toast.add({
      title: 'Success',
      description: 'Note deleted successfully',
      color: 'success'
    });
    
    showMobileDeleteModal.value = false;
    noteToDeleteMobile.value = null;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to delete note',
      color: 'error'
    });
  } finally {
    isDeleting.value = false;
  }
}

function cancelDeleteMobile() {
  showMobileDeleteModal.value = false;
  noteToDeleteMobile.value = null;
}

async function confirmDelete() {
  if (!noteToDelete.value) return;

  isDeleting.value = true;
  const deletedNoteId = noteToDelete.value.id;
  const wasShared = noteToDelete.value.is_shared || noteToDelete.value.share_permission;

  try {
    // Close the tab if it's open
    if (notesStore.openTabs.includes(deletedNoteId)) {
      notesStore.closeTab(deletedNoteId);
    }
    
    // Delete the note - shared_notes entries will be automatically deleted via CASCADE
    await notesStore.deleteNote(deletedNoteId);
    
    // Refresh shared notes list if this was a shared note
    if (wasShared) {
      await sharedNotesStore.fetchSharedNotes();
    }
    
    // Force refresh the notes list to ensure UI updates
    await notesStore.fetchNotes();
    
    toast.add({
      title: 'Success',
      description: 'Note deleted successfully',
      color: 'success'
    });
    
    showDeleteModal.value = false;
    noteToDelete.value = null;
    noteShareCount.value = 0;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to delete note',
      color: 'error'
    });
  } finally {
    isDeleting.value = false;
  }
}

function cancelDelete() {
  showDeleteModal.value = false;
  noteToDelete.value = null;
  noteShareCount.value = 0;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getPreview(content: string | null): string {
  if (!content) return 'No content';
  
  // Strip HTML tags to get plain text
  const text = content.replace(/<[^>]*>/g, '').trim();
  
  // Limit length
  return text.substring(0, 150) + (text.length > 150 ? '...' : '');
}

function getRenderedPreview(content: string | null): string {
  if (!content) return '<p class="text-gray-400 dark:text-gray-500">No content</p>';
  
  // Limit to first 200 characters of HTML
  const truncated = content.substring(0, 200) + (content.length > 200 ? '...' : '');
  
  return truncated;
}

function toggleFabMenu() {
  showFabMenu.value = !showFabMenu.value;
}

function toggleNoteCreationMenu() {
  showNoteCreationMenu.value = !showNoteCreationMenu.value;
}

// Handler for Daily Note (creates from Daily Journal template)
async function handleDailyNote() {
  if (isCreating.value) return;
  
  showNoteCreationMenu.value = false;
  isCreating.value = true;
  
  try {
    // Find the Daily Journal template
    const dailyJournalTemplate = noteTemplates.find(t => t.id === 'daily-journal');
    
    if (!dailyJournalTemplate) {
      toast.add({
        title: 'Error',
        description: 'Daily Journal template not found',
        color: 'error'
      });
      return;
    }
    
    const noteData: CreateNoteDto = {
      title: `Daily Journal - ${new Date().toLocaleDateString()}`,
      content: dailyJournalTemplate.content,
      folder_id: null
    };
    
    const note = await notesStore.createNote(noteData);
    
    toast.add({
      title: 'Success',
      description: 'Daily journal created successfully',
      color: 'success'
    });
    
    await notesStore.fetchNotes();
    await notesStore.openTab(note.id);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create daily note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

// Note opening and tab management
// Handle loading start from search - set state synchronously
function handleLoadingStart() {
  console.log('[Dashboard] handleLoadingStart called - setting loading state');
  // Set loading state IMMEDIATELY and SYNCHRONOUSLY
  // This must happen before any re-render when modal closes
  isLoadingNoteFromSearch.value = true;
  noteJustSelectedFromSearch.value = true;
  console.log('[Dashboard] Loading state set:', {
    isLoadingNoteFromSearch: isLoadingNoteFromSearch.value,
    noteJustSelectedFromSearch: noteJustSelectedFromSearch.value,
    activeNote: activeNote.value?.id,
    showSearchModal: showSearchModal.value
  });
}

// Handle note selection from search modal
async function handleNoteSelected(note: Note, shouldShowLoading: boolean = true) {
  console.log('[Dashboard] handleNoteSelected called:', {
    noteId: note.id,
    shouldShowLoading,
    currentLoadingState: isLoadingNoteFromSearch.value,
    currentActiveNote: activeNote.value?.id,
    timestamp: Date.now()
  });
  
  // CRITICAL: Loading state should already be set by @loading-start handler
  // But ensure it's set here too as a backup - MUST be set BEFORE any space switching
  if (shouldShowLoading && process.client) {
    // Force synchronous update - set IMMEDIATELY before any async operations
    noteJustSelectedFromSearch.value = true;
    isLoadingNoteFromSearch.value = true;
    console.log('[Dashboard] Loading state set in handleNoteSelected:', {
      isLoadingNoteFromSearch: isLoadingNoteFromSearch.value,
      activeNote: activeNote.value?.id
    });
    
    // Force Vue to process this update synchronously before continuing
    await nextTick();
  }
  
  try {
    // Check if note belongs to a different space
    if (note.folder_id !== null) {
      let folder = foldersStore.getFolderById(note.folder_id);
      let noteSpaceId: number | null = null;
      
      // If folder not found in current store, it might be in a different space
      // Fetch it from the API to get its space_id
      if (!folder) {
        try {
          if (authStore.token) {
            const fetchedFolder = await $fetch<Folder>(`/api/folders/${note.folder_id}`, {
              headers: {
                Authorization: `Bearer ${authStore.token}`
              }
            });
            if (fetchedFolder) {
              folder = fetchedFolder;
              noteSpaceId = folder.space_id;
            }
          }
        } catch (error) {
          console.error('[Dashboard] Failed to fetch folder:', error);
          // If folder fetch fails, try to proceed anyway
        }
      } else {
        noteSpaceId = folder.space_id;
      }
      
        // Switch to the note's space if it's different from current space
        if (noteSpaceId && noteSpaceId !== spacesStore.currentSpaceId) {
          // Switch to the note's space
          console.log('[Dashboard] Switching to space', noteSpaceId, 'for note', note.id);
          console.log('[Dashboard] Before space switch - isLoadingNoteFromSearch:', isLoadingNoteFromSearch.value);
          
          // CRITICAL: Ensure loading state is set BEFORE switching space
          // The space watcher will set isSwitchingSpace=true, which would hide activeNote
          // But we need isLoadingNoteFromSearch=true to prevent that
          if (!isLoadingNoteFromSearch.value) {
            console.log('[Dashboard] Loading state was false! Setting it before space switch...');
            isLoadingNoteFromSearch.value = true;
            noteJustSelectedFromSearch.value = true;
          }
          
          // IMPORTANT: Don't trigger space switching animation when loading from search
          // Set loading state BEFORE switching space to prevent isSwitchingSpace from hiding the note
          // The space watcher will set isSwitchingSpace, but we'll prevent it from hiding activeNote
          
          spacesStore.setCurrentSpace(noteSpaceId);
          console.log('[Dashboard] After space switch - isLoadingNoteFromSearch:', isLoadingNoteFromSearch.value, 'isSwitchingSpace:', isSwitchingSpace.value);
          
          // The space watcher will automatically fetch folders (silently) when currentSpaceId changes
          // Wait for folders to be loaded (the watcher handles this)
          await foldersStore.fetchFolders(noteSpaceId, true);
          await sharedNotesStore.fetchSharedNotes();
        }
    }
    
    // Now open the note (it will be in the correct space)
    // IMPORTANT: openTab sets activeTabId immediately, but we need to wait for the note to be fully loaded
    console.log('[Dashboard] Opening tab for note:', note.id);
    await notesStore.openTab(note.id);
    console.log('[Dashboard] Tab opened, activeTabId:', notesStore.activeTabId, 'activeNote:', activeNote.value?.id, 'isLoadingNoteFromSearch:', isLoadingNoteFromSearch.value);
    
    // Wait for the note to actually be in the notes array AND be set as activeNote
    // This ensures the note is fetched from the server before we clear loading state
    let attempts = 0;
    const maxAttempts = 40; // Wait up to 2 seconds (40 * 50ms) for server response
    const targetNoteId = String(note.id);
    
    console.log('[Dashboard] Waiting for note to be loaded, targetNoteId:', targetNoteId);
    while (attempts < maxAttempts) {
      // Check if note is in the store and is the active note
      const noteInStore = notesStore.notes.find(n => String(n.id) === targetNoteId);
      const isActiveNote = activeNote.value && String(activeNote.value.id) === targetNoteId;
      
      if (attempts % 5 === 0 || noteInStore || isActiveNote) { // Log every 5 attempts or when found
        console.log('[Dashboard] Waiting for note:', {
          attempt: attempts,
          noteInStore: !!noteInStore,
          isActiveNote,
          activeNoteId: activeNote.value?.id,
          activeTabId: notesStore.activeTabId,
          isLoadingNoteFromSearch: isLoadingNoteFromSearch.value,
          shouldShowEmptyState: shouldShowEmptyState.value
        });
      }
      
      // If note is in store AND is active, we're good
      if (noteInStore && isActiveNote) {
        console.log('[Dashboard] Note is loaded and active!');
        // Give it one more render cycle to ensure UI updates
        await nextTick();
        await new Promise(resolve => setTimeout(resolve, 150));
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
    
    // After waiting, check if editor is mounted before clearing loading state
    // Keep loading state true until editor is confirmed visible
    console.log('[Dashboard] Checking for editor, isLoadingNoteFromSearch:', isLoadingNoteFromSearch.value);
    if (isLoadingNoteFromSearch.value) {
      // Wait a bit more and check for editor
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if editor is in DOM - keep checking until found
      let checkAttempts = 0;
      const maxCheckAttempts = 30; // Wait up to 3 seconds for editor
      console.log('[Dashboard] Looking for editor in DOM...');
      while (checkAttempts < maxCheckAttempts && isLoadingNoteFromSearch.value) {
        const editor = document.querySelector('[data-note-editor]');
        if (checkAttempts % 5 === 0) { // Log every 5 attempts
          console.log('[Dashboard] Checking for editor:', {
            attempt: checkAttempts,
            editorFound: !!editor,
            isLoadingNoteFromSearch: isLoadingNoteFromSearch.value,
            activeNote: activeNote.value?.id
          });
        }
        if (editor) {
          // Editor found, clear loading after a moment to ensure it's rendered
          console.log('[Dashboard] Editor found! Clearing loading state...');
          await new Promise(resolve => setTimeout(resolve, 300));
          isLoadingNoteFromSearch.value = false;
          noteJustSelectedFromSearch.value = false;
          console.log('[Dashboard] Loading state cleared');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        checkAttempts++;
      }
      
      // If we've waited long enough and editor still not found, clear anyway
      if (isLoadingNoteFromSearch.value && checkAttempts >= maxCheckAttempts) {
        console.log('[Dashboard] Editor not found after max attempts, clearing loading state anyway');
        isLoadingNoteFromSearch.value = false;
        noteJustSelectedFromSearch.value = false;
      }
    }
  } catch (error) {
    // On error, clear loading state
    isLoadingNoteFromSearch.value = false;
    noteJustSelectedFromSearch.value = false;
    throw error;
  }
}

// Watch for search modal closing and ensure loading state is set if note was just selected
watch(showSearchModal, (isOpen, wasOpen) => {
  console.log('[Dashboard] showSearchModal watcher:', {
    wasOpen,
    isOpen,
    noteJustSelectedFromSearch: noteJustSelectedFromSearch.value,
    isLoadingNoteFromSearch: isLoadingNoteFromSearch.value,
    activeNote: activeNote.value?.id,
    timestamp: Date.now()
  });
  
  // When modal closes and a note was just selected, ensure loading state is set
  if (wasOpen && !isOpen && noteJustSelectedFromSearch.value && process.client) {
    console.log('[Dashboard] Modal closed, checking loading state...');
    // Double-check loading state is set (in case it wasn't set yet)
    if (!isLoadingNoteFromSearch.value) {
      console.log('[Dashboard] Loading state was false! Setting it now...');
      isLoadingNoteFromSearch.value = true;
    } else {
      console.log('[Dashboard] Loading state already set');
    }
  }
});

async function handleOpenNote(noteId: string) {
  await notesStore.openTab(noteId);
  isMobileSidebarOpen.value = false;
}

async function handleFolderNoteClick(noteId: string) {
  await handleOpenNote(noteId);
}

// Note editing functions
async function saveNote(silent = false) {
  if (!activeNote.value) return;
  
  // LOCK DOWN: Never auto-save shared/collaborative notes content/title
  // Only allow metadata updates (tags, folder) and explicit user saves
  const isCollaborative = activeNote.value.is_shared || activeNote.value.share_permission;
  
  // Block auto-saves (silent) for shared notes - Y.Doc handles content sync
  if (isCollaborative && silent) {
    // Check if this is just a metadata change (tags/folder) that we should allow
    const titleChanged = editForm.title !== activeNote.value.title;
    const contentChanged = editForm.content !== activeNote.value.content;
    const tagsChanged = JSON.stringify(editForm.tags || []) !== JSON.stringify(activeNote.value.tags || []);
    const folderChanged = editForm.folder_id !== activeNote.value.folder_id;
    
    // Only allow metadata changes (tags/folder) for shared notes, not content/title
    if (titleChanged || contentChanged) {
      console.log('[Dashboard] BLOCKED: Attempted to auto-save shared note content/title - Y.Doc handles this');
      return;
    }
    
    // Allow metadata changes (tags/folder) even if silent
    if (tagsChanged || folderChanged) {
      console.log('[Dashboard] Allowing metadata update for shared note (tags/folder)');
    }
  }
  
  // Also block if this is a programmatic update (e.g., from switching tabs/spaces)
  if (isProgrammaticUpdate.value && silent) {
    console.log('[Dashboard] BLOCKED: Attempted to save during programmatic update');
    return;
  }
  
  if (!editForm.title?.trim()) {
    if (!silent) {
      toast.add({
        title: 'Validation Error',
        description: 'Title is required',
        color: 'error'
      });
    }
    return;
  }

  isSaving.value = true;

  try {
    // For shared notes, only save metadata (tags, folder) - content is managed by Y.Doc
    // Use the note's current content from the database to avoid overwriting Y.Doc changes
    const updateData: UpdateNoteDto = {
      title: editForm.title,
      // For shared notes with silent saves, use the note's current content (from Y.Doc)
      // This prevents overwriting collaborative edits when saving metadata
      content: (isCollaborative && silent) 
        ? (activeNote.value.content || '') 
        : editForm.content,
      tags: editForm.tags || [],
      folder: editForm.folder || null,
      folder_id: editForm.folder_id || null
    };
    
    await notesStore.updateNote(activeNote.value.id, updateData);
    
    if (!silent) {
      toast.add({
        title: 'Success',
        description: 'Note saved',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Save error:', error);
    if (!silent) {
      toast.add({
        title: 'Error',
        description: 'Failed to save note',
        color: 'error'
      });
    }
  } finally {
    isSaving.value = false;
  }
}

// Toggle lock state
function toggleLock() {
  if (!activeNote.value) return;
  
  isLocked.value = !isLocked.value;
  
  if (process.client) {
    localStorage.setItem(`note-${activeNote.value.id}-locked`, isLocked.value.toString());
  }
  
  if (isLocked.value) {
    toast.add({
      title: 'Note Locked',
      description: 'Read-only mode activated',
      color: 'success'
    });
  } else {
    toast.add({
      title: 'Note Unlocked',
      description: 'You can now edit this note',
      color: 'success'
    });
  }
}

// Tags management
const tagInput = ref('');

// Computed for collaborative check (for template access)
const isCollaborative = computed(() => {
  return activeNote.value ? (activeNote.value.is_shared || activeNote.value.share_permission) : false;
});

function addTag() {
  const trimmedTag = tagInput.value.trim();
  if (!trimmedTag) return;
  
  if (!editForm.tags || editForm.tags === null) {
    editForm.tags = [];
  }
  
  if (editForm.tags.includes(trimmedTag)) {
    tagInput.value = '';
    return;
  }
  
  editForm.tags = [...editForm.tags, trimmedTag];
  tagInput.value = '';
  saveNote(true);
}

function removeTag(tag: string) {
  if (editForm.tags && editForm.tags.length > 0) {
    editForm.tags = editForm.tags.filter(t => t !== tag);
    saveNote(true);
  }
}

// Folder selection for note
function selectFolderForNote(folderId: number | null) {
  editForm.folder_id = folderId;
  editForm.folder = folderId ? foldersStore.getFolderById(folderId)?.name || null : null;
}

// Computed for selected folder name - ensure it updates when folder changes
const selectedFolderName = computed(() => {
  // Get folder_id from editForm or activeNote as fallback
  const folderId = editForm.folder_id ?? activeNote.value?.folder_id ?? null;
  
  if (!folderId) return null;
  
  const folder = foldersStore.getFolderById(folderId);
  if (!folder) return null;
  
  // Build full path
  const path: string[] = [];
  let current = folder;
  while (current) {
    path.unshift(current.name);
    if (current.parent_id === null) break;
    const parent = foldersStore.getFolderById(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  
  return path.join(' › ');
});

// Polish note with AI
// Check publish status for active note
async function checkPublishStatus() {
  if (!activeNote.value) return;
  
  try {
    const status = await $fetch<{ is_published: boolean; share_url?: string }>(`/api/notes/${activeNote.value.id}/publish-status`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    publishStatus.value = status;
  } catch (error) {
    console.error('Error checking publish status:', error);
    publishStatus.value = { is_published: false };
  }
}

// Load attachments for a note
async function loadAttachments(noteId: string) {
  try {
    isLoadingAttachments.value = true;
    if (!authStore.token) {
      console.log('[Dashboard] No auth token for loading attachments');
      return;
    }
    
    console.log('[Dashboard] Loading attachments for note:', noteId);
    const atts = await $fetch<Array<import('~/models').Attachment>>(
      `/api/notes/${noteId}/attachments`,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    );
    
    console.log('[Dashboard] Loaded attachments:', atts.length, atts);
    attachments.value = atts;
  } catch (error: any) {
    console.error('[Dashboard] Failed to load attachments:', error);
    attachments.value = [];
  } finally {
    isLoadingAttachments.value = false;
  }
}

// Handle attachment upload
function handleAttachmentUploaded(attachment: import('~/models').Attachment) {
  attachments.value = [attachment, ...attachments.value];
}

// Handle attachment deletion
function handleAttachmentDeleted(attachmentId: number) {
  attachments.value = attachments.value.filter((a) => a.id !== attachmentId);
}

// Delete attachment
async function deleteAttachment(attachmentId: number) {
  if (!activeNote.value) return;
  
  try {
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.add({
        title: 'Error',
        description: 'Not authenticated',
        color: 'error',
      });
      return;
    }
    
    await $fetch(`/api/notes/${activeNote.value.id}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    
    handleAttachmentDeleted(attachmentId);
    toast.add({
      title: 'Success',
      description: 'File deleted successfully',
      color: 'success',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete file',
      color: 'error',
    });
  }
}

// Trigger file upload from header button
function triggerFileUpload() {
  fileUploadInputRef.value?.click();
}

// Handle file selection from header button
async function handleFileUpload(event: Event) {
  if (!activeNote.value) return;
  
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files || files.length === 0) return;
  
  const authStore = useAuthStore();
  if (!authStore.token) {
    toast.add({
      title: 'Error',
      description: 'Not authenticated',
      color: 'error',
    });
    return;
  }
  
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      const attachment = await $fetch<import('~/models').Attachment>(
        `/api/notes/${activeNote.value.id}/attachments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: formData,
        }
      );
      
      handleAttachmentUploaded(attachment);
      toast.add({
        title: 'File Uploaded',
        description: `${file.name} uploaded successfully`,
        color: 'success',
      });
    }
    
    // Reload attachments list to get fresh presigned URLs
    await loadAttachments(activeNote.value.id);
    
    // Reset input
    if (fileUploadInputRef.value) {
      fileUploadInputRef.value.value = '';
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    toast.add({
      title: 'Upload Failed',
      description: error.data?.message || 'Failed to upload file',
      color: 'error',
    });
  }
}

// Handle publish button click
async function handlePublishButtonClick() {
  if (!activeNote.value) return;
  
  // If status not loaded yet, check it first
  if (publishStatus.value === null) {
    await checkPublishStatus();
  }
  
  // If published, show modal with link
  if (publishStatus.value?.is_published) {
    showPublishModal.value = true;
  } else {
    // If not published, publish it
    await publishNote();
  }
}

// Publish note
async function publishNote() {
  if (!activeNote.value || isPublishing.value) return;
  
  try {
    // Check if parent folder or space is published
    if (activeNote.value.folder_id) {
      const folderStatus = await $fetch<{ is_published: boolean; parent_space_published?: boolean }>(`/api/folders/${activeNote.value.folder_id}/publish-status`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      });

      if (folderStatus.is_published || folderStatus.parent_space_published) {
        const parentType = folderStatus.parent_space_published ? 'space' : 'folder';
        const confirmed = confirm(`This note is in a published ${parentType}. Publishing the ${parentType} already makes this note public. Do you still want to publish this note separately?`);
        if (!confirmed) return;
      }
    }
    
    isPublishing.value = true;
    if (!authStore.token) {
      toast.add({ title: 'Error', description: 'Not authenticated', color: 'error' });
      return;
    }
    
    const response = await $fetch<{ share_id: string; share_url: string }>(`/api/notes/${activeNote.value.id}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    publishStatus.value = { is_published: true, share_url: response.share_url };
    showPublishModal.value = true;
    toast.add({
      title: 'Note Published',
      description: 'Your note is now publicly accessible',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Error publishing note:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to publish note',
      color: 'error'
    });
  } finally {
    isPublishing.value = false;
  }
}

// Unpublish note
async function unpublishNote() {
  if (!activeNote.value || isPublishing.value) return;
  
  try {
    isPublishing.value = true;
    if (!authStore.token) {
      toast.add({ title: 'Error', description: 'Not authenticated', color: 'error' });
      return;
    }
    
    await $fetch(`/api/notes/${activeNote.value.id}/unpublish`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    publishStatus.value = { is_published: false };
    showPublishModal.value = false;
    toast.add({
      title: 'Note Unpublished',
      description: 'Your note is no longer publicly accessible',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Error unpublishing note:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to unpublish note',
      color: 'error'
    });
  } finally {
    isPublishing.value = false;
  }
}

// Copy share URL
function copyShareUrl() {
  if (!publishStatus.value?.share_url) return;
  
  if (process.client && navigator.clipboard) {
    navigator.clipboard.writeText(publishStatus.value.share_url);
    toast.add({
      title: 'Link Copied',
      description: 'Share link copied to clipboard',
      color: 'success'
    });
  }
}

// Copy folder share URL
function copyFolderShareUrl() {
  if (!currentFolderPublishStatus.value?.share_url) return;
  
  if (process.client && navigator.clipboard) {
    navigator.clipboard.writeText(currentFolderPublishStatus.value.share_url);
    toast.add({
      title: 'Link Copied',
      description: 'Folder share link copied to clipboard',
      color: 'success'
    });
  }
}

async function polishNote() {
  if (!activeNote.value) return;
  if (!editForm.title?.trim() && !editForm.content?.trim()) {
    toast.add({
      title: 'Nothing to Polish',
      description: 'Add some content to your note first',
      color: 'warning'
    });
    return;
  }

  isPolishing.value = true;

  try {
    const response = await $fetch<{ title: string; content: string }>('/api/notes/polish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        title: editForm.title || 'Untitled Note',
        content: editForm.content || ''
      }
    });

    editForm.title = response.title;
    editForm.content = response.content;

    // Track analytics
    try {
      await $fetch('/api/analytics/track', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: {
          event_type: 'note_polished',
          event_data: { note_id: activeNote.value.id },
          note_id: activeNote.value.id,
        },
      });
    } catch (e) {
      // Ignore analytics errors
    }

    toast.add({
      title: 'Note Polished! ✨',
      description: 'Your note has been cleaned and organized',
      color: 'success'
    });

    await saveNote(true);
  } catch (error: any) {
    console.error('Polish error:', error);
    toast.add({
      title: 'Polish Failed',
      description: error.data?.message || 'Failed to polish note with AI',
      color: 'error'
    });
  } finally {
    isPolishing.value = false;
  }
}

// Helper function to extract plain text from HTML
const getPlainText = (html: string | null | undefined): string => {
  if (!html) return '';
  // Create a temporary div to parse HTML and extract text
  if (process.client) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
  // Fallback for SSR: basic HTML tag removal
  return html.replace(/<[^>]*>/g, '').trim();
};

// Character and word count (use activeNote.content for collaborative notes)
const wordCount = computed(() => {
  // For collaborative notes, read from activeNote.content (Y.Doc synced)
  const content = (activeNote.value?.is_shared || activeNote.value?.share_permission) 
    ? activeNote.value?.content 
    : editForm.content;
  
  const plainText = getPlainText(content);
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(word => word.length > 0).length;
});

const charCount = computed(() => {
  // For collaborative notes, read from activeNote.content (Y.Doc synced)
  const content = (activeNote.value?.is_shared || activeNote.value?.share_permission) 
    ? activeNote.value?.content 
    : editForm.content;
  
  const plainText = getPlainText(content);
  return plainText.length;
});

// Position folder dropdown
watch(showFolderDropdown, (show) => {
  if (show) {
    nextTick(() => {
      const button = folderButtonRef.value;
      if (button) {
        const rect = button.getBoundingClientRect();
        folderDropdownPos.value = {
          top: rect.bottom + 4,
          left: rect.left
        };
      }
    });
  }
});

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (!showFolderDropdown.value) return;
    
    const target = event.target as HTMLElement;
    if (folderButtonRef.value?.contains(target)) return;
    
    const dropdown = document.querySelector('[data-folder-dropdown]');
    if (dropdown?.contains(target)) return;
    
    showFolderDropdown.value = false;
  };
  
  document.addEventListener('click', handleClickOutside);
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    if (autoSaveTimeout.value) {
      clearTimeout(autoSaveTimeout.value);
    }
  });
});
</script>

<template>
  <div>
    <!-- Loading screen while auth is initializing, during SSR, or data is loading -->
    <!-- Exclude folder reordering from loading check - reordering should be instant -->
    <div v-if="!isMounted || !authStore.currentUser || !authStore.initialized || loading || !hasInitialized || (foldersStore.loading && !foldersStore.isReordering) || spacesStore.loading" class="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div class="text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary-600 mb-4" />
        <p class="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>

    <!-- Main dashboard with Notion-like layout -->
    <div v-else :key="`dashboard-${authStore.currentUser?.id}-${sessionKey}`" class="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
      <!-- Mobile Action Bar (only on mobile) - Quick actions - AT TOP LEVEL -->
      <div class="md:hidden flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <!-- Left: Space Navigation (when no note active) OR Back Button + Note Title (when note active) -->
        <div v-if="!activeNote" class="flex-1 min-w-0 flex items-center gap-2">
          <!-- When folder is selected: Show back button + folder name -->
          <template v-if="selectedFolderId !== null">
            <!-- Back Button -->
            <button
              @click="selectAllNotes"
              class="p-1.5 rounded-lg active:bg-gray-100 dark:active:bg-gray-700 text-gray-600 dark:text-gray-400 flex-shrink-0"
            >
              <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
            </button>
            
            <!-- Folder Name -->
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <UIcon name="i-heroicons-folder" class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ foldersStore.getFolderById(selectedFolderId)?.name || 'Folder' }}
              </span>
            </div>
          </template>
          
          <!-- When no folder selected: Show space selector -->
          <template v-else>
            <button
              ref="spaceButtonRef"
              @click="handleOpenSpacesSheet"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg active:bg-gray-100 dark:active:bg-gray-700 transition-colors flex-shrink-0"
            >
              <UIcon 
                :name="(spacesStore.currentSpace?.icon && spacesStore.currentSpace.icon.trim() !== '') ? `i-lucide-${spacesStore.currentSpace.icon}` : 'i-heroicons-building-office-2'" 
                class="w-4 h-4 text-gray-600 dark:text-gray-400" 
              />
              <span class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
                {{ spacesStore.currentSpace?.name || 'Select Space' }}
              </span>
              <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 text-gray-400 dark:text-gray-500" />
            </button>
          </template>
        </div>
        
        <div v-else class="flex-1 min-w-0 flex items-center gap-2">
          <!-- Back Button -->
          <button
            @click="notesStore.activeTabId = null"
            class="p-1.5 rounded-lg active:bg-gray-100 dark:active:bg-gray-700 text-gray-600 dark:text-gray-400 flex-shrink-0"
          >
            <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
          </button>
          <!-- Note Title -->
          <h2 class="text-base font-semibold text-gray-900 dark:text-white truncate flex-1">{{ activeNote.title || 'Untitled Note' }}</h2>
        </div>
        
        <!-- Right: Action Buttons Group -->
        <div class="flex items-center gap-1 flex-shrink-0">
          <!-- Settings Button (when no note active) -->
          <button
            v-if="!activeNote"
            class="p-2 rounded-lg transition-colors active:bg-gray-100 dark:active:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Settings"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5" />
          </button>
          
          <!-- Search Button - Always visible -->
          <button
            @click="showSearchModal = true"
            class="p-2 rounded-lg transition-colors active:bg-gray-100 dark:active:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Search"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
          </button>
          
          <!-- Action Buttons - Only show when note is active -->
          <div v-if="activeNote" class="flex items-center gap-1">
            <!-- Lock/Unlock Button -->
            <button
              v-if="!activeNote.is_shared && !activeNote.share_permission"
              @click="toggleLock"
              :title="isLocked ? 'Unlock Note' : 'Lock Note'"
              class="p-2 rounded-lg transition-colors active:bg-gray-100 dark:active:bg-gray-700"
              :class="isLocked ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'"
            >
              <UIcon :name="isLocked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'" class="w-5 h-5" />
            </button>
            
            <!-- Polish with AI -->
            <button
              v-if="!isLocked && !activeNote.is_shared && !activeNote.share_permission"
              @click="polishNote"
              :disabled="isPolishing"
              class="p-2 rounded-lg transition-colors active:bg-purple-50 dark:active:bg-purple-900/20 disabled:opacity-50"
              :class="isPolishing ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500 dark:text-purple-400'"
              title="Polish with AI"
            >
              <UIcon 
                name="i-heroicons-sparkles" 
                :class="isPolishing ? 'animate-pulse opacity-70' : ''" 
                class="w-5 h-5 transition-opacity" 
              />
            </button>
            
            <!-- Publish/Unpublish Note Button -->
            <button
              v-if="activeNote.user_id === authStore.currentUser?.id && !activeNote.is_shared && !activeNote.share_permission"
              @click="handlePublishButtonClick"
              :disabled="isPublishing"
              class="p-2 rounded-lg transition-colors"
              :class="publishStatus?.is_published 
                ? 'active:bg-primary-50 dark:active:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                : 'active:bg-gray-100 dark:active:bg-gray-700 text-gray-500 dark:text-gray-400'"
              :title="publishStatus?.is_published ? 'View/Copy Share Link' : 'Publish Note'"
            >
              <UIcon 
                :name="publishStatus?.is_published ? 'i-heroicons-globe-alt' : 'i-heroicons-link'"
                :class="isPublishing ? 'animate-spin' : ''"
                class="w-5 h-5" 
              />
            </button>
            
            <!-- File Upload Button -->
            <button
              v-if="!isLocked && (activeNote.user_id === authStore.currentUser?.id || activeNote.share_permission === 'editor')"
              @click="triggerFileUpload"
              class="p-2 rounded-lg transition-colors active:bg-gray-100 dark:active:bg-gray-700 text-gray-500 dark:text-gray-400 active:text-primary-600 dark:active:text-primary-400"
              title="Upload File"
            >
              <UIcon name="i-heroicons-paper-clip" class="w-5 h-5" />
            </button>
            
            <!-- Delete Button (Mobile) -->
            <button
              v-if="activeNote.user_id === authStore.currentUser?.id && !activeNote.is_shared && !activeNote.share_permission"
              @click="handleDeleteNoteMobile(activeNote)"
              :disabled="isDeleting"
              class="p-2 rounded-lg transition-colors active:bg-red-50 dark:active:bg-red-900/20 text-red-600 dark:text-red-400 disabled:opacity-50 md:hidden"
              title="Delete Note"
            >
              <UIcon 
                name="i-heroicons-trash" 
                :class="isDeleting ? 'animate-pulse' : ''"
                class="w-5 h-5" 
              />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Desktop/Mobile Content Container -->
      <div class="flex flex-1 overflow-hidden">
      <!-- Left Sidebar (Desktop Only) -->
      <aside 
        class="hidden md:flex md:flex-col bg-white dark:bg-gray-800 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
        :class="isDesktopSidebarVisible ? 'w-64 lg:w-72 border-r border-gray-200 dark:border-gray-700' : 'w-0 border-r-0'"
      >
        <!-- Sidebar Content Wrapper (smooth opacity transition) -->
        <div 
          class="flex flex-col h-full transition-opacity duration-300 ease-in-out min-w-0"
          :class="isDesktopSidebarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
        >
          <!-- Sidebar Header -->
          <div class="flex items-center justify-between h-14 px-3 flex-shrink-0">
            <div class="flex items-center gap-1 min-w-0">
              <img src="/swan-unfold.png" alt="Unfold" class="w-16 h-16 flex-shrink-0" />
              <h1 class="text-lg font-extrabold text-gray-900 dark:text-white tracking-wide truncate">Unfold</h1>
            </div>
            <!-- Hide Sidebar Button (Notability-style) -->
            <button
              v-if="isDesktopSidebarVisible"
              @click="isDesktopSidebarVisible = false"
              class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-600 transition-all duration-200 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 group flex-shrink-0"
              title="Hide sidebar"
              aria-label="Hide sidebar"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            </button>
          </div>

          <!-- Sidebar Content -->
          <div class="flex-1 overflow-y-auto p-3 min-w-0">
          <!-- Space Selector -->
          <SpaceSelector />
          
          <!-- New Note Button with Submenu - Commented Out -->
          <template v-if="false">
          <div class="mb-4 mt-4">
            <button
              data-note-creation-button
              @click="toggleNoteCreationMenu"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left"
              :class="{ 'bg-primary-50 dark:bg-primary-900/20': showNoteCreationMenu }"
            >
              <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                <UIcon name="i-heroicons-plus" class="w-4 h-4 text-white" />
              </div>
              <span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">New Note</span>
              <UIcon 
                name="i-heroicons-chevron-down" 
                class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
                :class="{ 'rotate-180': showNoteCreationMenu }"
              />
            </button>

            <!-- Note Creation Submenu -->
            <Transition name="slide-down">
              <div
                v-if="showNoteCreationMenu"
                data-note-creation-menu
                class="mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div class="py-1.5">
                  <!-- New Note -->
                  <button
                    @click="handleCreateNote"
                    :disabled="isCreating"
                    class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <UIcon name="i-heroicons-document-plus" class="w-4 h-4 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white text-sm">New Note</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Create a blank note</div>
                    </div>
                  </button>

                  <!-- New List -->
                  <button
                    @click="handleListNote"
                    :disabled="isCreating"
                    class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <UIcon name="i-heroicons-list-bullet" class="w-4 h-4 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white text-sm">New List</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">With checkbox ready</div>
                    </div>
                  </button>

                  <!-- Daily Note -->
                  <button
                    @click="handleDailyNote"
                    :disabled="isCreating"
                    class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white text-sm">Daily Note</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Daily journal template</div>
                    </div>
                  </button>

                  <!-- From Template -->
                  <button
                    @click="handleTemplateNote"
                    class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 transition-colors"
                  >
                    <div class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white text-sm">From Template</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Use a pre-made template</div>
                    </div>
                  </button>

                  <!-- AI Generate Note -->
                  <button
                    @click="handleAiGenerate"
                    class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-3 transition-colors"
                  >
                    <div class="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white text-sm">AI Generate</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Create with AI</div>
                    </div>
                  </button>

                  <!-- Import Recipe -->
                  <button
                    @click="handleRecipeImport"
                    class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3 transition-colors"
                  >
                    <div class="w-8 h-8 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                      <UIcon name="i-heroicons-cake" class="w-4 h-4 text-white" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-gray-900 dark:text-white text-sm">Import Recipe</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">From URL</div>
                    </div>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
          </template>
          
          <!-- Quick Notes Section - Commented Out -->
          <!--
          <template v-if="false">
            <div class="mb-4">
              <div class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                <UIcon name="i-heroicons-bolt" class="w-5 h-5" />
                <span class="flex-1 text-left">Quick Notes</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                  {{ notesWithoutFolder.length }}
                </span>
              </div>
              
              <div v-if="notesWithoutFolder.length > 0" class="mt-1 space-y-0.5">
                <div
                  v-for="note in notesWithoutFolder"
                  :key="`note-${note.id}`"
                  class="group/note flex items-center gap-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 px-3 py-2"
                  :class="notesStore.activeTabId === note.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
                >
                  <div @click="handleOpenNote(note.id)" class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <UIcon 
                      name="i-heroicons-document-text" 
                      class="w-4 h-4 flex-shrink-0"
                      :class="notesStore.activeTabId === note.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'"
                    />
                    <span 
                      class="flex-1 text-sm truncate"
                      :class="notesStore.activeTabId === note.id ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300'"
                      :title="note.title"
                    >
                      {{ note.title }}
                    </span>
                  </div>
                  
                  <button
                    @click.stop="handleDeleteNote(note)"
                    class="flex-shrink-0 p-1.5 rounded-md opacity-0 group-hover/note:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
                    title="Delete note"
                  >
                    <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          </template>
          -->

          <!-- Folders Section -->
          <div class="mt-4">
            <div class="flex items-center justify-between px-3 mb-2">
              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Folders
              </h3>
              <button
                @click="openCreateFolderModal"
                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="New Folder"
              >
                <UIcon name="i-heroicons-plus" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div v-if="foldersStore.folders.length === 0" class="px-3 py-6 text-center">
              <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No folders yet</p>
              <button
                @click="openCreateFolderModal"
                class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Create your first folder
              </button>
            </div>

            <!-- Folder Tree with Notes - Wrapped in overflow container to clip animation at header -->
            <div v-else class="overflow-hidden" style="min-height: 0;">
              <div ref="foldersContainerRef" class="space-y-0.5 transition-all duration-300" id="root-folders-container">
                <FolderTreeItem
                  v-for="folder in foldersStore.folders"
                  :key="folder.id"
                  :folder="folder"
                  :selected-id="selectedFolderId"
                  :is-expanded="foldersStore.expandedFolderIds.has(folder.id)"
                  :publish-status="folderPublishStatuses.get(folder.id)"
                  @select="selectFolder"
                  @toggle="(id) => foldersStore.toggleFolder(id)"
                  @create-note="handleCreateNoteInFolder"
                  @create-quick-note="handleQuickNoteInFolder"
                  @create-list-note="handleListNoteInFolder"
                  @create-template-note="handleTemplateNoteInFolder"
                  @create-ai-note="handleAiGenerateInFolder"
                  @import-recipe="handleRecipeImportInFolder"
                  @rename="handleRenameFolder"
                  @delete="handleDeleteFolder"
                  @publish="handlePublishFolder"
                  @unpublish="handleUnpublishFolder"
                  @copy-link="handleCopyFolderLink"
                  @check-publish-status="checkFolderPublishStatus"
                  @move-up="handleMoveUp"
                  @move-down="handleMoveDown"
                  @reorder-folder="handleFolderReorder"
                  @open-note="handleFolderNoteClick"
                  @delete-note="(noteId) => handleDeleteNote(notesStore.notes.find(n => n.id === noteId)!)"
                />
              </div>
            </div>
          </div>

        </div>

        <!-- Sidebar Footer -->
        <div class="p-3 border-t border-gray-200 dark:border-gray-700">
          <div class="relative">
            <button 
              type="button"
              data-user-menu-button
              @click="showUserMenu = !showUserMenu"
              class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {{ userInitial }}
              </div>
              <div class="flex-1 text-left min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ authStore.currentUser?.name || 'User' }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ authStore.currentUser?.email }}
                </p>
              </div>
              <UIcon name="i-heroicons-ellipsis-horizontal" class="w-5 h-5 text-gray-400" />
            </button>

            <!-- User Menu Dropdown -->
            <Transition name="fade">
              <div
                v-if="showUserMenu"
                data-user-menu-dropdown
                class="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2"
              >
                <NuxtLink
                  to="/settings"
                  @click="showUserMenu = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 block"
                >
                  <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5" />
                  <span>Settings</span>
                </NuxtLink>
                <button
                  type="button"
                  @click="authStore.logout()"
                  class="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                >
                  <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </Transition>
          </div>
          
          <!-- Made with Love & Support -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-32"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 max-h-32"
            leave-to-class="opacity-0 max-h-0"
          >
            <div v-if="showMadeWithLove" class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 relative">
              <button
                @click="dismissMadeWithLove"
                class="absolute top-2 right-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Dismiss"
              >
                <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
              </button>
              <div class="flex flex-col items-center gap-1.5">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Made with ❤️ by Elliott
                </p>
                <BuyMeACoffee variant="subtle" size="sm" />
              </div>
            </div>
          </Transition>
        </div>
        </div>
      </aside>

      <!-- Floating Show Sidebar Button (when sidebar is hidden, Notability-style) -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-x-4"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 -translate-x-4"
      >
        <button
          v-if="!isDesktopSidebarVisible"
          @click="isDesktopSidebarVisible = true"
          class="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 p-2.5 bg-white dark:bg-gray-800 border-r border-y border-gray-200 dark:border-gray-700 rounded-r-xl shadow-xl hover:shadow-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 group backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200" />
        </button>
      </Transition>

      <!-- Mobile Bottom Sheets (replaces hamburger menu) -->
      <!-- Mobile Dropdowns -->
      <!-- Spaces Dropdown -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-1"
        >
          <div
            v-if="showMobileSpacesSheet"
            class="fixed z-50 md:hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto"
            :style="{
              top: `${spacesDropdownPos.top}px`,
              left: `${spacesDropdownPos.left}px`,
              width: `${spacesDropdownPos.width}px`
            }"
            @click.stop
          >
            <div class="p-2">
              <div class="space-y-1">
                <button
                  v-for="space in spacesStore.spaces"
                  :key="space.id"
                  @click="handleSelectSpace(space.id)"
                  :class="[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 active:scale-[0.98]',
                    spacesStore.currentSpaceId === space.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-500 dark:border-primary-400'
                      : 'bg-transparent border border-transparent active:bg-gray-100 dark:active:bg-gray-700'
                  ]"
                >
                  <!-- Space Icon -->
                  <div 
                    :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      spacesStore.currentSpaceId === space.id
                        ? 'bg-primary-500 dark:bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    ]"
                  >
                    <UIcon 
                      :name="(space.icon && space.icon.trim() !== '') ? `i-lucide-${space.icon}` : 'i-heroicons-building-office-2'" 
                      class="w-4 h-4" 
                    />
                  </div>
                  
                  <!-- Space Name -->
                  <div class="flex-1 text-left min-w-0">
                    <div 
                      :class="[
                        'text-base font-semibold truncate',
                        spacesStore.currentSpaceId === space.id
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-gray-900 dark:text-white'
                      ]"
                    >
                      {{ space.name }}
                    </div>
                  </div>
                  
                  <!-- Active Indicator -->
                  <div v-if="spacesStore.currentSpaceId === space.id" class="flex-shrink-0">
                    <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </Transition>
        <!-- Backdrop -->
        <div
          v-if="showMobileSpacesSheet"
          class="fixed inset-0 z-40 md:hidden bg-black/20"
          @click="showMobileSpacesSheet = false"
        />
      </Teleport>

      <!-- Folders Dropdown -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-1"
        >
          <div
            v-if="showMobileFoldersSheet"
            class="fixed z-50 md:hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto"
            :style="{
              top: `${foldersDropdownPos.top}px`,
              left: `${foldersDropdownPos.left}px`,
              width: `${foldersDropdownPos.width}px`
            }"
            @click.stop
          >
            <div class="p-2 pb-3">
              <!-- Breadcrumb Navigation -->
              <!-- Header with Create Button -->
              <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Folders</h3>
                <button @click="openCreateFolderModal(); showMobileFoldersSheet = false" class="p-1.5 rounded-lg active:bg-gray-100 dark:active:bg-gray-700 text-gray-600 dark:text-gray-400" title="New Folder">
                  <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                </button>
              </div>
              
              <div v-if="displayedFolders.length === 0" class="text-center py-8">
                <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  No folders yet
                </p>
                <button @click="openCreateFolderModal(); showMobileFoldersSheet = false" class="text-sm text-primary-600 dark:text-primary-400 font-medium">Create folder</button>
              </div>
              <div v-else class="space-y-1">
                <div
                  v-for="folder in displayedFolders"
                  :key="folder.id"
                  class="flex items-center gap-1.5 group pr-1"
                >
                  <button
                    @click="handleFolderClick(folder)"
                    :class="[
                      'flex-1 flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 active:scale-[0.98] min-w-0',
                      selectedFolderId === folder.id
                        ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-500 dark:border-primary-400'
                        : 'bg-transparent border border-transparent active:bg-gray-100 dark:active:bg-gray-700'
                    ]"
                  >
                    <!-- Folder Icon -->
                    <div 
                      :class="[
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        selectedFolderId === folder.id
                          ? 'bg-primary-500 dark:bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      ]"
                    >
                      <UIcon name="i-heroicons-folder" class="w-4 h-4" />
                    </div>
                    
                    <!-- Folder Name -->
                    <div class="flex-1 text-left min-w-0">
                      <div 
                        :class="[
                          'text-base font-semibold truncate',
                          selectedFolderId === folder.id
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-gray-900 dark:text-white'
                        ]"
                      >
                        {{ folder.name }}
                      </div>
                    </div>
                    
                    <!-- Subfolder Indicator or Active Indicator -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <UIcon 
                        v-if="selectedFolderId === folder.id" 
                        name="i-heroicons-check-circle" 
                        class="w-5 h-5 text-primary-600 dark:text-primary-400" 
                      />
                    </div>
                  </button>
                  
                  <!-- Folder Menu Button -->
                  <button
                    @click.stop="handleOpenFolderMenu(folder.id, $event)"
                    class="p-2.5 rounded-lg transition-colors active:bg-gray-100 dark:active:bg-gray-700 text-gray-500 dark:text-gray-400 active:text-gray-700 dark:active:text-gray-200 flex-shrink-0 -mr-1"
                    aria-label="Folder menu"
                  >
                    <UIcon name="i-heroicons-ellipsis-vertical" class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
        <!-- Backdrop -->
        <div
          v-if="showMobileFoldersSheet"
          class="fixed inset-0 z-40 md:hidden bg-black/20"
          @click="handleCloseFolderMenu(); showMobileFoldersSheet = false"
        />
      </Teleport>
      
      <!-- Folder Menu Dropdown -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-1"
        >
          <div
            v-if="folderMenuOpen !== null"
            class="fixed z-50 md:hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl"
            :style="{
              top: `${folderMenuPos.top}px`,
              left: `${folderMenuPos.left}px`,
              width: `${folderMenuPos.width}px`
            }"
            @click.stop
          >
            <div class="p-2">
              <button
                @click="handleCreateNoteInFolder(folderMenuOpen!); handleCloseFolderMenu(); showMobileFoldersSheet = false"
                :disabled="isCreating"
                class="w-full text-left px-4 py-3 rounded-lg active:bg-primary-50 dark:active:bg-primary-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <UIcon name="i-heroicons-document-plus" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span class="text-sm font-medium text-gray-900 dark:text-white">Create Note</span>
              </button>
            </div>
          </div>
        </Transition>
        <!-- Backdrop for folder menu -->
        <div
          v-if="folderMenuOpen !== null"
          class="fixed inset-0 z-40 md:hidden bg-black/20"
          @click="(e) => {
            const target = e.target as HTMLElement;
            // Don't close if clicking on a button
            if (target.tagName === 'BUTTON' || target.closest('button')) {
              return;
            }
            handleCloseFolderMenu();
          }"
        />
      </Teleport>


        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
        <!-- Tab Bar with Actions -->
        <div class="hidden md:flex flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between w-full">
            <!-- Tabs -->
            <div class="flex-1 overflow-x-auto">
              <TabBar />
            </div>
            
            <!-- Actions (only show when note is active) -->
            <div v-if="activeNote" class="flex items-center gap-2 px-4 border-l border-gray-200 dark:border-gray-700">
              <!-- Lock/Unlock Button -->
              <!-- Lock/Unlock Toggle (disabled for shared notes to allow collaboration) -->
              <button
                v-if="!activeNote.is_shared && !activeNote.share_permission"
                @click="toggleLock"
                :title="isLocked ? 'Unlock Note' : 'Lock Note'"
                class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="isLocked ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'"
              >
                <UIcon :name="isLocked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'" class="w-4 h-4" />
              </button>
              
              <!-- Polish with AI (disabled for shared notes to prevent conflicts) -->
              <button
                v-if="!isLocked && !activeNote.is_shared && !activeNote.share_permission"
                @click="polishNote"
                :disabled="isPolishing"
                class="p-2 rounded-lg transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                :class="isPolishing ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500 dark:text-purple-400'"
                title="Polish with AI"
              >
                <UIcon 
                  name="i-heroicons-sparkles" 
                  :class="isPolishing ? 'animate-pulse opacity-70' : ''" 
                  class="w-4 h-4 transition-opacity" 
                />
              </button>
              
              <!-- Publish/Unpublish Note Button -->
              <button
                v-if="activeNote.user_id === authStore.currentUser?.id && !activeNote.is_shared && !activeNote.share_permission"
                @click="handlePublishButtonClick"
                :disabled="isPublishing"
                class="p-2 rounded-lg transition-colors"
                :class="publishStatus?.is_published 
                  ? 'hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'"
                :title="publishStatus?.is_published ? 'View/Copy Share Link' : 'Publish Note'"
              >
                <UIcon 
                  :name="publishStatus?.is_published ? 'i-heroicons-globe-alt' : 'i-heroicons-link'"
                  :class="isPublishing ? 'animate-spin' : ''"
                  class="w-4 h-4" 
                />
              </button>
              
              <!-- File Upload Button (show for owners or editors with permission) -->
              <button
                v-if="!isLocked && (activeNote.user_id === authStore.currentUser?.id || activeNote.share_permission === 'editor')"
                @click="triggerFileUpload"
                class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                title="Upload File"
              >
                <UIcon name="i-heroicons-paper-clip" class="w-4 h-4" />
              </button>
              
              <!-- Keyboard Shortcuts Info -->
              <!-- <button
                @click="showShortcutsModal = true"
                class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                title="Keyboard Shortcuts"
              >
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
              </button> -->
            </div>
            
            <!-- Search Button (always visible) -->
            <div class="flex items-center gap-2 px-4 border-l border-gray-200 dark:border-gray-700">
              <button
                @click="showSearchModal = true"
                class="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                title="Search Notes (Ctrl+P)"
              >
                <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
              </button>
            </div>
            
            <!-- Save Status -->
            <ClientOnly>
              <div class="flex items-center gap-1 pl-4 pr-2 border-l border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-1.5 text-xs flex-shrink-0 relative" style="width: 95px; min-width: 95px;">
                  <!-- Invisible placeholder to reserve space for longest text "Saving..." -->
                  <div class="invisible flex items-center gap-1.5" aria-hidden="true">
                    <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
                    <span class="hidden lg:inline whitespace-nowrap">Saving...</span>
                  </div>
                  <!-- Visible content -->
                  <div class="absolute flex items-center gap-1.5">
                    <div 
                      v-if="isSaving"
                      class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"
                    >
                      <UIcon 
                        name="i-heroicons-arrow-path"
                        class="w-4 h-4 animate-spin flex-shrink-0"
                      />
                      <span class="hidden lg:inline whitespace-nowrap">Saving...</span>
                    </div>
                    <div 
                      v-else
                      class="flex items-center gap-1.5 text-green-600 dark:text-green-400"
                    >
                      <UIcon 
                        name="i-heroicons-check-circle"
                        class="w-4 h-4 flex-shrink-0"
                      />
                      <span class="hidden lg:inline whitespace-nowrap">Saved</span>
                    </div>
                  </div>
                </div>
              </div>
            </ClientOnly>
          </div>
        </div>

        <!-- Note Editor Area - Fully Scrollable -->
        <div class="flex-1 overflow-y-auto md:pb-0 pb-16 relative" :class="activeNote ? (isLocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900') : 'bg-gray-50 dark:bg-gray-900'">
          <!-- Loading indicator when loading note from search (mobile only) - Show first to prevent flash -->
          <!-- CRITICAL: Show loading indicator when isLoadingNoteFromSearch is true, regardless of activeNote state -->
          <!-- Use v-show for instant visibility (element always in DOM, just toggles display) -->
          <div v-show="isLoadingNoteFromSearch || noteJustSelectedFromSearch" class="md:hidden flex items-center justify-center min-h-full absolute inset-0 bg-gray-50 dark:bg-gray-900 z-50">
            <div class="flex flex-col items-center gap-3">
              <UIcon 
                name="i-heroicons-arrow-path" 
                class="w-8 h-8 text-primary-500 dark:text-primary-400 animate-spin" 
              />
              <p class="text-sm text-gray-500 dark:text-gray-400">Loading note...</p>
            </div>
          </div>
          
          <!-- Mobile Notes List (when no note active) - Use computed to prevent flash -->
          <!-- CRITICAL: Use computed property to ensure empty state never shows when loading -->
          <!-- Use v-show with negative condition for instant hiding -->
          <template v-if="shouldShowEmptyState && !isLoadingNoteFromSearch && !noteJustSelectedFromSearch">
            <div class="md:hidden min-h-full p-4">
              <div class="max-w-2xl mx-auto">
                <!-- Folder List View (when no folder selected) -->
                <div v-if="selectedFolderId === null">
                  <div v-if="displayedFolders.length === 0" class="text-center py-12">
                    <UIcon name="i-heroicons-folder-open" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p class="text-base text-gray-500 dark:text-gray-400 mb-4">
                      No folders yet
                    </p>
                    <button 
                      @click="openCreateFolderModal" 
                      class="text-base text-primary-600 dark:text-primary-400 font-medium"
                    >
                      Create folder
                    </button>
                  </div>
                  
                  <div v-else class="space-y-2">
                    <button
                      v-for="folder in displayedFolders"
                      :key="folder.id"
                      @click="selectFolder(folder.id)"
                      class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] bg-white dark:bg-gray-800 border-2 border-transparent active:bg-gray-100 dark:active:bg-gray-700 shadow-sm"
                    >
                      <!-- Folder Icon -->
                      <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <UIcon name="i-heroicons-folder" class="w-5 h-5" />
                      </div>
                      
                      <!-- Folder Name -->
                      <div class="flex-1 text-left min-w-0">
                        <div class="text-base font-semibold text-gray-900 dark:text-white truncate">
                          {{ folder.name }}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {{ getFolderNoteCount(folder.id) }} {{ getFolderNoteCount(folder.id) === 1 ? 'note' : 'notes' }}
                        </div>
                      </div>
                      
                      <!-- Chevron -->
                      <div class="flex-shrink-0">
                        <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      </div>
                    </button>
                  </div>
                </div>
                
                <!-- Notes in Folder View (when folder selected) -->
                <div v-else>
                  <div v-if="displayNotes.length === 0" class="text-center py-12">
                    <UIcon name="i-heroicons-document-text" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p class="text-base text-gray-500 dark:text-gray-400 mb-4">
                      No notes in this folder
                    </p>
                    <button 
                      @click="handleCreateNoteInFolder(selectedFolderId)" 
                      class="text-base text-primary-600 dark:text-primary-400 font-medium"
                      :disabled="isCreating"
                    >
                      Create your first note
                    </button>
                  </div>
                  
                  <div v-else class="space-y-2">
                    <button
                      v-for="note in displayNotes"
                      :key="note.id"
                      @click="handleOpenNote(String(note.id))"
                      :class="[
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.98]',
                        notesStore.activeTabId === note.id
                          ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500 dark:border-primary-400'
                          : 'bg-white dark:bg-gray-800 border-2 border-transparent active:bg-gray-100 dark:active:bg-gray-700 shadow-sm'
                      ]"
                    >
                      <!-- Note Icon -->
                      <div 
                        :class="[
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          notesStore.activeTabId === note.id
                            ? 'bg-primary-500 dark:bg-primary-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        ]"
                      >
                        <UIcon name="i-heroicons-document-text" class="w-5 h-5" />
                      </div>
                      
                      <!-- Note Title -->
                      <div class="flex-1 text-left min-w-0">
                        <div 
                          :class="[
                            'text-base font-semibold truncate',
                            notesStore.activeTabId === note.id
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-gray-900 dark:text-white'
                          ]"
                        >
                          {{ note.title || 'Untitled Note' }}
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {{ formatDate(note.updated_at) }}
                        </div>
                      </div>
                      
                      <!-- Active Indicator -->
                      <div v-if="notesStore.activeTabId === note.id" class="flex-shrink-0">
                        <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- No tabs open state (desktop only) -->
            <Transition name="fade-out" mode="out-in">
              <div v-if="selectedFolderId === null" key="no-note" class="hidden md:flex min-h-full items-center justify-center">
                <div class="text-center">
                  <UIcon name="i-heroicons-folder" class="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select a folder</h3>
                  <p class="text-gray-500 dark:text-gray-400 mb-6">Choose a folder from the sidebar to view its notes</p>
                </div>
              </div>
            </Transition>
          </template>

          <!-- Note Editor - Everything Scrolls Together -->
          <div v-else-if="activeNote" :key="`note-${activeNote?.id || 'empty'}-space-${spacesStore.currentSpaceId}`" class="min-h-full">
            <!-- Header Section - Full Width -->
            <div class="border-b border-gray-200 dark:border-gray-700 shadow-sm bg-gradient-to-b from-transparent to-gray-50/50 dark:to-gray-800/50">
              <div class="max-w-5xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 md:px-6 pt-6 pb-4">
                <!-- Title -->
                <h1
                  v-if="isLocked"
                  class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3"
                >
                  {{ editForm.title || 'Untitled Note' }}
                </h1>
                <div v-else class="w-full mb-3">
                  <input
                    v-model="editForm.title"
                    type="text"
                    :disabled="activeNote?.is_shared || !!activeNote?.share_permission"
                    class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Untitled Note"
                  />
                  <p v-if="activeNote?.is_shared || activeNote?.share_permission" class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <UIcon name="i-heroicons-lock-closed" class="w-3 h-3" />
                    Title is locked for shared notes to avoid confusion while collaborating
                  </p>
                </div>
            
            <!-- Stats Row -->
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap mb-3">
              <span v-if="isLocked" class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5" />
                Read-Only
              </span>
              <ClientOnly>
                <span v-if="activeNote" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
                  {{ formatDate(activeNote.updated_at) }}
                </span>
              </ClientOnly>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
                {{ wordCount }} words
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-chart-bar" class="w-3.5 h-3.5" />
                {{ charCount }} chars
              </span>
            </div>

            <!-- Metadata: Folder + Tags -->
            <div v-if="!isLocked && activeNote && !activeNote.share_permission" class="flex items-center gap-4 text-sm flex-wrap">
              <!-- Folder -->
              <!-- <div class="flex items-center gap-2 relative">
                <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5 text-gray-400" />
                <button
                  ref="folderButtonRef"
                  type="button"
                  @click="showFolderDropdown = !showFolderDropdown"
                  class="bg-transparent text-left text-gray-600 dark:text-gray-400 text-xs w-40 hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1.5"
                >
                  <span class="truncate">{{ selectedFolderName || 'No folder' }}</span>
                  <UIcon name="i-heroicons-chevron-down" class="w-2.5 h-2.5 flex-shrink-0" />
                </button>
                
                <Teleport to="body">
                  <div
                    v-if="showFolderDropdown"
                    data-folder-dropdown
                    @click.stop
                    class="fixed z-[9999] w-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-2 max-h-96 overflow-y-auto"
                    :style="{ top: `${folderDropdownPos.top}px`, left: `${folderDropdownPos.left}px` }"
                  >
                    <button
                      type="button"
                      @click="selectFolderForNote(null); showFolderDropdown = false"
                      class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      :class="(editForm.folder_id ?? null) === null ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''"
                    >
                      <UIcon name="i-heroicons-document-text" class="w-4 h-4 inline mr-2 text-gray-500" />
                      No folder
                    </button>
                    <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <FolderSelectorItem
                      v-for="folder in foldersStore.folders"
                      :key="folder.id"
                      :folder="folder"
                      :selected-id="editForm.folder_id ?? null"
                      @select="(id) => { selectFolderForNote(id); showFolderDropdown = false; }"
                    />
                  </div>
                </Teleport>
              </div> -->

              <!-- Tags -->
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <div class="flex items-center gap-1 flex-wrap flex-1">
                  <UBadge
                    v-for="tag in editForm.tags"
                    :key="tag"
                    color="primary"
                    variant="soft"
                    size="xs"
                    class="cursor-pointer hover:bg-primary-200 dark:hover:bg-primary-800"
                    @click="removeTag(tag)"
                  >
                    {{ tag }}
                    <UIcon name="i-heroicons-x-mark" class="w-2.5 h-2.5 ml-1" />
                  </UBadge>
                  <input
                    v-model="tagInput"
                    type="text"
                    class="bg-transparent border-none outline-none text-gray-600 dark:text-gray-400 placeholder-gray-400 text-xs w-20 focus:outline-none focus:ring-0"
                    placeholder="Add tag..."
                    @keyup.enter="addTag"
                    @blur="addTag"
                  />
                </div>
              </div>
            </div>
            
            <!-- Read-only metadata (when locked OR when user is not owner) -->
            <div v-else-if="activeNote && (isLocked || activeNote.share_permission) && (selectedFolderName || editForm.tags?.length)" class="flex items-center gap-3 text-xs flex-wrap">
              <!-- <div v-if="selectedFolderName || !editForm.folder_id" class="flex items-center gap-2">
                <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5 text-gray-400" />
                <span class="text-gray-600 dark:text-gray-400">{{ selectedFolderName || 'No folder' }}</span>
              </div> -->
              <div v-if="editForm.tags && editForm.tags.length > 0" class="flex items-center gap-2 flex-wrap">
                <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 text-gray-400" />
                <UBadge
                  v-for="tag in editForm.tags"
                  :key="tag"
                  color="primary"
                  variant="soft"
                  size="xs"
                >
                  {{ tag }}
                </UBadge>
              </div>
            </div>
              </div>
            </div>

            <!-- Editor Section - Editable Content -->
            <div class="max-w-5xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 md:px-6 py-6 pb-16">
              <!-- Attachments Links at Top -->
              <div v-if="attachments.length > 0" class="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div v-if="isLoadingAttachments" class="text-center py-2">
                  <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mx-auto text-gray-400" />
                </div>
                <div v-else class="flex flex-wrap items-center gap-3">
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <UIcon name="i-heroicons-paper-clip" class="w-3.5 h-3.5" />
                    Attachments:
                  </span>
                  <div
                    v-for="attachment in attachments"
                    :key="attachment.id"
                    class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <a
                      :href="attachment.presigned_url || `/api/notes/${activeNote.id}/attachments/${attachment.id}`"
                      target="_blank"
                      download
                      class="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1.5"
                      :title="`Download ${attachment.file_name}`"
                    >
                      <UIcon name="i-heroicons-arrow-down-tray" class="w-3.5 h-3.5" />
                      <span>{{ attachment.file_name }}</span>
                    </a>
                    <button
                      v-if="activeNote && !isLocked && (activeNote.user_id === authStore.currentUser?.id || activeNote.share_permission === 'editor')"
                      @click="deleteAttachment(attachment.id)"
                      class="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      :title="`Delete ${attachment.file_name}`"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Hidden file input for header button -->
              <input
                ref="fileUploadInputRef"
                type="file"
                multiple
                class="hidden"
                @change="handleFileUpload"
              />
              
              <!-- Use UnifiedEditor for all notes (collaborative or regular) -->
              <ClientOnly>
                <UnifiedEditor
                  v-if="activeNote && (activeNote.is_shared || activeNote.share_permission)"
                  ref="collaborativeEditorRef"
                  data-note-editor
                  :key="`collab-${activeNote.id}-${authStore.currentUser?.id || 'anon'}`"
                  :is-collaborative="true"
                  :note-id="activeNote.id"
                  :editable="!isLocked && (activeNote.share_permission === 'editor' || activeNote.user_id === authStore.currentUser?.id)"
                  :user-name="authStore.currentUser?.name || authStore.currentUser?.email || 'Anonymous'"
                  :user-color="generateUserColor(authStore.currentUser?.id)"
                  :initial-content="activeNote.content || editForm.content || ''"
                  placeholder="Start writing... Right-click for options or press ? for keyboard shortcuts"
                  @update:content="(content) => { if (activeNote) activeNote.content = content }"
                />
                <UnifiedEditor
                  v-else-if="activeNote"
                  ref="tiptapEditorRef"
                  :key="`regular-${activeNote.id}`"
                  data-note-editor
                  v-model="editForm.content"
                  :is-collaborative="false"
                  :note-id="activeNote.id"
                  :editable="!isLocked"
                  :show-toolbar="false"
                  placeholder="Start writing... Right-click for options or press ? for keyboard shortcuts"
                />
              </ClientOnly>
            </div>
          </div>
        </div>

        <!-- Floating Action Button with Menu - Commented Out -->
        <!--
        <template v-if="false">
          <div class="fixed bottom-8 right-8 z-50">
            <Transition name="fab-menu">
              <div
                v-if="showFabMenu"
                data-fab-menu
                class="absolute bottom-20 right-0 w-56 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div class="py-2">
                  <button
                    @click="handleCreateNote"
                    :disabled="isCreating"
                    class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-sm">
                      <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 dark:text-white">New Note</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Create a blank note</div>
                    </div>
                  </button>

                  <button
                    @click="handleListNote"
                    :disabled="isCreating"
                    class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                      <UIcon name="i-heroicons-list-bullet" class="w-5 h-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 dark:text-white">New List</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">With checkbox ready</div>
                    </div>
                  </button>

                  <button
                    @click="handleTemplateNote"
                    class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 transition-colors"
                  >
                    <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                      <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 dark:text-white">From Template</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Use a pre-made template</div>
                    </div>
                  </button>

                  <button
                    @click="handleAiGenerate"
                    class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-3 transition-colors"
                  >
                    <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                      <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 dark:text-white">AI Generate</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">Create with AI</div>
                    </div>
                  </button>

                  <button
                    @click="handleRecipeImport"
                    class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3 transition-colors"
                  >
                    <div class="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                      <UIcon name="i-heroicons-cake" class="w-5 h-5 text-white" />
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold text-gray-900 dark:text-white">Import Recipe</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">From URL</div>
                    </div>
                  </button>
                </div>
              </div>
            </Transition>

            <button
              data-fab-button
              @click="toggleFabMenu"
              :disabled="isCreating"
              class="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              :class="{ 'rotate-45': showFabMenu, 'scale-95': isCreating }"
            >
              <UIcon 
                :name="isCreating ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'" 
                class="w-8 h-8 transition-transform"
                :class="{ 'animate-spin': isCreating }"
              />
            </button>
          </div>
        </template>
        -->
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="cancelDelete" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Delete Note?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              Are you sure you want to delete <span class="font-semibold text-gray-900 dark:text-white">"{{ noteToDelete?.title }}"</span>? This action cannot be undone.
            </p>
            <!-- Shared Note Warning -->
            <div v-if="noteShareCount > 0" class="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div class="flex items-start gap-2">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Shared Note Warning
                  </p>
                  <p class="text-xs text-amber-800 dark:text-amber-200">
                    This note is shared with <span class="font-semibold">{{ noteShareCount }} {{ noteShareCount === 1 ? 'user' : 'users' }}</span>. Deleting it will remove access for all shared users.
                  </p>
                </div>
              </div>
            </div>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="cancelDelete" :disabled="isDeleting">Cancel</UButton>
              <UButton color="error" block @click="confirmDelete" :loading="isDeleting" :disabled="isDeleting">Delete</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Mobile Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showMobileDeleteModal"
          class="fixed inset-0 z-50 md:hidden flex items-start justify-center pt-16 px-4"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            @click="cancelDeleteMobile"
          />
          
          <!-- Modal Content -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-4 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 -translate-y-4 scale-95"
          >
            <div
              v-if="showMobileDeleteModal"
              class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700"
              @click.stop
            >
              
              <div class="px-6 py-6">
                <!-- Icon -->
                <div class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <UIcon name="i-heroicons-trash" class="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                
                <!-- Title -->
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
                  Delete Note?
                </h3>
                
                <!-- Message -->
                <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                  Are you sure you want to delete 
                  <span class="font-semibold text-gray-900 dark:text-white">
                    "{{ noteToDeleteMobile?.title || 'Untitled Note' }}"
                  </span>? 
                  This action cannot be undone.
                </p>
                
                <!-- Action Buttons -->
                <div class="flex flex-col gap-3">
                  <button
                    @click="confirmDeleteMobile"
                    :disabled="isDeleting"
                    class="w-full px-4 py-3.5 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <UIcon 
                      v-if="isDeleting"
                      name="i-heroicons-arrow-path" 
                      class="w-5 h-5 animate-spin" 
                    />
                    <span>{{ isDeleting ? 'Deleting...' : 'Delete' }}</span>
                  </button>
                  
                  <button
                    @click="cancelDeleteMobile"
                    :disabled="isDeleting"
                    class="w-full px-4 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Create Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateFolderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showCreateFolderModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <UIcon name="i-heroicons-folder-plus" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Create New Folder</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Organize your notes by creating folders</p>
            <input v-model="newFolderName" type="text" placeholder="Folder name" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6" @keyup.enter="createFolder" autofocus />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showCreateFolderModal = false" :disabled="isFolderActionLoading">Cancel</UButton>
              <UButton color="primary" block @click="createFolder" :loading="isFolderActionLoading" :disabled="isFolderActionLoading || !newFolderName.trim()">Create</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Rename Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRenameFolderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showRenameFolderModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <UIcon name="i-heroicons-pencil" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Rename Folder</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Renaming <span class="font-semibold text-gray-900 dark:text-white">"{{ folderToManage !== null ? foldersStore.getFolderById(folderToManage)?.name : '' }}"</span></p>
            <input v-model="renameFolderName" type="text" placeholder="New folder name" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6" @keyup.enter="renameFolder" autofocus />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showRenameFolderModal = false" :disabled="isFolderActionLoading">Cancel</UButton>
              <UButton color="primary" block @click="renameFolder" :loading="isFolderActionLoading" :disabled="isFolderActionLoading || !renameFolderName.trim()">Rename</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteFolderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showDeleteFolderModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Delete Folder?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Are you sure you want to delete <span class="font-semibold text-gray-900 dark:text-white">"{{ folderToManage !== null ? foldersStore.getFolderById(folderToManage)?.name : '' }}"</span>? All notes in this folder and its subfolders will be permanently deleted. This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showDeleteFolderModal = false" :disabled="isFolderActionLoading">Cancel</UButton>
              <UButton color="error" block @click="deleteFolder" :loading="isFolderActionLoading" :disabled="isFolderActionLoading">Delete</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- AI Generate Note Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAiGenerateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showAiGenerateModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-full">
              <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Generate Note with AI</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Describe what you want the AI to write about, and it will generate a well-formatted note for you.</p>
            <textarea v-model="aiPrompt" placeholder="E.g., 'Write a summary of the benefits of meditation' or 'Create a study guide for JavaScript promises'" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-6 resize-none" rows="5" @keydown.meta.enter="generateAiNote" @keydown.ctrl.enter="generateAiNote" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center">
              Powered by Google Gemini 2.5 Flash • Press <kbd class="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">⌘</kbd> <kbd class="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to generate
            </p>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showAiGenerateModal = false" :disabled="isGeneratingAi">Cancel</UButton>
              <UButton color="primary" block @click="generateAiNote" :loading="isGeneratingAi" :disabled="isGeneratingAi || !aiPrompt.trim()" icon="i-heroicons-sparkles">Generate</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Recipe Import Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRecipeImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showRecipeImportModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/30 rounded-full">
              <UIcon name="i-heroicons-cake" class="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Import Recipe from URL</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Enter the URL of a recipe page, and we'll extract the ingredients and instructions for you.</p>
            <input 
              v-model="recipeUrl" 
              type="url" 
              placeholder="https://example.com/recipe" 
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent mb-6" 
              @keyup.enter="importRecipe" 
              autofocus 
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center">
              Powered by AI • We'll try to extract recipe data automatically
            </p>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showRecipeImportModal = false" :disabled="isImportingRecipe">Cancel</UButton>
              <UButton color="primary" block @click="importRecipe" :loading="isImportingRecipe" :disabled="isImportingRecipe || !recipeUrl.trim()" icon="i-heroicons-cake">Import</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Template Selection Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showTemplateModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] border border-gray-200 dark:border-gray-700 flex flex-col">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Choose a Template</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Select a pre-made template to get started quickly</p>
              </div>
              <button @click="showTemplateModal = false" class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  v-for="template in noteTemplates"
                  :key="template.id"
                  @click="createNoteFromTemplate(template)"
                  :disabled="isCreating"
                  class="group relative bg-gradient-to-br p-[2px] rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="template.color"
                >
                  <div class="bg-white dark:bg-gray-800 rounded-xl p-5 h-full flex flex-col">
                    <div class="flex items-start gap-4 mb-3">
                      <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-110 transition-transform" :class="template.color">
                        <UIcon :name="template.icon" class="w-6 h-6 text-white" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ template.title }}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ template.description }}</p>
                      </div>
                    </div>
                    <div class="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Click to create</span>
                        <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UIcon name="i-heroicons-information-circle" class="w-5 h-5" />
                  <span>{{ noteTemplates.length }} templates available</span>
                </div>
                <UButton color="neutral" variant="soft" @click="showTemplateModal = false">Cancel</UButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Keyboard Shortcuts Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showShortcutsModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showShortcutsModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] border border-gray-200 dark:border-gray-700 flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <UIcon name="i-heroicons-command-line" class="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Master your workflow</p>
                </div>
              </div>
              <button @click="showShortcutsModal = false" class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
              </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6">
              <div class="space-y-6">
                <!-- Text Formatting -->
                <div>
                  <h4 class="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 uppercase tracking-wide">Text Formatting</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Bold</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ B</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Italic</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ I</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Underline</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ U</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Strike through</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⇧ X</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Inline code</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ E</kbd>
                    </div>
                  </div>
                </div>

                <!-- Headings -->
                <div>
                  <h4 class="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 uppercase tracking-wide">Headings</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Heading 1 - 6</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⌥ 1-6</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Paragraph</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⌥ 0</kbd>
                    </div>
                  </div>
                </div>

                <!-- Links & Media -->
                <div>
                  <h4 class="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 uppercase tracking-wide">Links & Media</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Add link</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ K</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Code block</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⌥ C</kbd>
                    </div>
                  </div>
                </div>

                <!-- Lists -->
                <div>
                  <h4 class="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 uppercase tracking-wide">Lists</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Bullet list</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⇧ 8</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Numbered list</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⇧ 7</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Task list</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⇧ 9</kbd>
                    </div>
                  </div>
                </div>

                <!-- Editing -->
                <div>
                  <h4 class="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-3 uppercase tracking-wide">Editing</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Undo</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ Z</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span class="text-sm text-gray-700 dark:text-gray-300">Redo</span>
                      <kbd class="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono border border-gray-300 dark:border-gray-600">⌘ ⇧ Z</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  💡 <strong>Tip:</strong> Right-click in the editor for quick actions
                </p>
                <UButton color="primary" variant="soft" @click="showShortcutsModal = false">Got it</UButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Search Modal -->
    <SearchModal 
      :is-open="showSearchModal"
      @update:is-open="showSearchModal = $event"
      @loading-start="handleLoadingStart"
      @selected="(note, isLoading) => handleNoteSelected(note, isLoading)"
    />

    <!-- Publish Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPublishModal && publishStatus?.is_published"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showPublishModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Note Published
              </h3>
              <button
                @click="showPublishModal = false"
                class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your note is now publicly accessible. Anyone with the link can view it.
            </p>

            <!-- Share URL -->
            <div class="mb-4">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Share Link
              </label>
              <div class="flex gap-2">
                <input
                  :value="publishStatus.share_url"
                  readonly
                  class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                />
                <UButton
                  icon="i-heroicons-clipboard-document"
                  color="primary"
                  @click="copyShareUrl"
                >
                  Copy
                </UButton>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showPublishModal = false"
              >
                Close
              </UButton>
              <UButton
                color="error"
                variant="soft"
                block
                @click="unpublishNote"
              >
                Unpublish
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Folder Publish Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showFolderPublishModal && currentFolderPublishStatus"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showFolderPublishModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Folder Published
              </h3>
              <button
                @click="showFolderPublishModal = false"
                class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your folder "<strong>{{ currentFolderPublishStatus.folderName }}</strong>" and all its contents are now publicly accessible. Anyone with the link can view them.
            </p>

            <!-- Share URL -->
            <div class="mb-4">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Share Link
              </label>
              <div class="flex gap-2">
                <input
                  :value="currentFolderPublishStatus.share_url"
                  readonly
                  class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                />
                <UButton
                  icon="i-heroicons-clipboard-document"
                  color="primary"
                  @click="copyFolderShareUrl"
                >
                  Copy
                </UButton>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showFolderPublishModal = false"
              >
                Close
              </UButton>
              <UButton
                color="error"
                variant="soft"
                block
                @click="handleUnpublishFolder(currentFolderPublishStatus.folderId)"
              >
                Unpublish
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Unpublish Folder Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showUnpublishFolderModal && folderToUnpublish"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showUnpublishFolderModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Unpublish Folder
              </h3>
              <button
                @click="showUnpublishFolderModal = false"
                class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <!-- Warning Icon -->
            <div class="flex items-center gap-3 mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <p class="text-sm text-orange-800 dark:text-orange-200">
                This will make <strong>"{{ folderToUnpublish.folderName }}"</strong> and all its contents (notes and subfolders) no longer publicly accessible.
              </p>
            </div>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Anyone with the share link will no longer be able to view this folder or its contents. This action cannot be undone.
            </p>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showUnpublishFolderModal = false"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                variant="solid"
                block
                @click="confirmUnpublishFolder"
              >
                Unpublish Folder
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
      </div>
    </div>
</template>

<style scoped>
/* Polish AI Button */
.polish-ai-button-small {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
  box-shadow: 0 2px 8px 0 rgba(102, 126, 234, 0.3);
}

.polish-ai-button-small:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #6a3f92 50%, #e082ea 100%);
  background-size: 200% 200%;
  box-shadow: 0 3px 12px 0 rgba(102, 126, 234, 0.5);
}

.polish-ai-button-small:active:not(:disabled) {
  transform: scale(0.95);
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: all 0.3s ease;
}

.modal-enter-from > div:first-child,
.modal-leave-to > div:first-child {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

/* Search expand animation */
.search-expand-enter-active,
.search-expand-leave-active {
  transition: all 0.3s ease;
}

.search-expand-enter-from {
  opacity: 0;
  transform: translateX(20px);
  width: 0;
}

.search-expand-leave-to {
  opacity: 0;
  transform: translateX(20px);
  width: 0;
}

/* Bottom Sheet animation - Slide up from bottom */
.sheet-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-enter-active .absolute.bottom-0 {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.sheet-leave-active .absolute.bottom-0 {
  transition: transform 0.25s cubic-bezier(0.55, 0.055, 0.675, 0.19);
}

.sheet-enter-from .absolute.bottom-0 {
  transform: translateY(100%);
}

.sheet-leave-to .absolute.bottom-0 {
  transform: translateY(100%);
}

.sheet-enter-from .absolute.inset-0.bg-black\/50 {
  opacity: 0;
}

.sheet-leave-to .absolute.inset-0.bg-black\/50 {
  opacity: 0;
}

/* Mobile-specific: Remove hover states, use active/tap states only */
@media (max-width: 767px) {
  /* Disable all hover effects on mobile */
  * {
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
  }
  
  /* Remove hover states on mobile - use active states instead */
  /* Hover states are disabled via md: prefix in classes */
  
  /* Ensure active states work properly */
  button:active,
  a:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
  
  /* Make buttons more tactile */
  button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
}

.drawer-enter-from .absolute.inset-0.bg-black\/50 {
  opacity: 0;
}

.drawer-leave-to .absolute.inset-0.bg-black\/50 {
  opacity: 0;
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-active .absolute.inset-0.bg-black\/50 {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Fade animation */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

/* FAB menu animation */
.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

.fab-menu-enter-to,
.fab-menu-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* Slide down animation for note creation menu */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 600px;
}

/* Expand transition for shared notes - Notion-style smooth animation */
.shared-notes-container {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
}

.shared-notes-content {
  min-height: 0;
  overflow: hidden;
}

.expand-shared-enter-active {
  transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  /* Matches folder animation timing */
}

.expand-shared-leave-active {
  transition: grid-template-rows 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* Faster leave for snappy feel */
}

.expand-shared-enter-from {
  grid-template-rows: 0fr;
  opacity: 0;
}

.expand-shared-enter-to {
  grid-template-rows: 1fr;
  opacity: 1;
}

.expand-shared-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}

.expand-shared-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* Space switching animations - fade out tabs */
.fade-out-enter-active {
  transition: opacity 0.3s ease-in;
}

.fade-out-enter-from {
  opacity: 0;
}

.fade-out-leave-active {
  transition: opacity 0.25s ease-out;
}

.fade-out-leave-to {
  opacity: 0;
}
</style>


