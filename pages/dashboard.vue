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

// Mobile menu state
const isMobileSidebarOpen = ref(false);
const isSearchExpanded = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

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
const collaborativeEditorRef = ref<{ getCurrentContent: () => string } | null>(null);
const showFolderDropdown = ref(false);
const folderDropdownPos = ref({ top: 0, left: 0 });
const folderButtonRef = ref<HTMLButtonElement | null>(null);
const isPolishing = ref(false);

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
const isSharedNotesExpanded = ref(true);

// Load saved state from localStorage on mount
if (process.client) {
  const savedState = localStorage.getItem('sharedNotesExpanded');
  if (savedState !== null) {
    isSharedNotesExpanded.value = savedState === 'true';
  }
}

// Save state to localStorage when it changes
watch(isSharedNotesExpanded, (newValue) => {
  if (process.client) {
    localStorage.setItem('sharedNotesExpanded', String(newValue));
  }
});

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

// Keyboard shortcuts modal
const showShortcutsModal = ref(false);

// Search modal
const showSearchModal = ref(false);

// Keyboard shortcut handler reference
let keyboardShortcutHandler: ((event: KeyboardEvent) => void) | null = null;

// Folder management modals
const showCreateFolderModal = ref(false);
const showRenameFolderModal = ref(false);
const showDeleteFolderModal = ref(false);
const newFolderName = ref('');
const newFolderParentId = ref<number | null>(null);
const renameFolderName = ref('');
const folderToManage = ref<number | null>(null);
const isFolderActionLoading = ref(false);

// Folder drag-and-drop
const foldersContainerRef = ref<HTMLElement | null>(null);
let foldersSortableInstance: any = null;

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

// Share note modal
const showShareModal = ref(false);
const shareUserSearch = ref('');
const userSearchResults = ref<Array<{ id: number; email: string; name: string | null }>>([]);
const sharePermission = ref<'viewer' | 'editor'>('editor');
const selectedUserToShare = ref<{ id: number; email: string; name: string | null } | null>(null);

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
    
      await Promise.all([
      foldersStore.fetchFolders(),
      notesStore.fetchNotes(),
      notesStore.loadNoteOrder(),
      sharedNotesStore.fetchSharedNotes()
    ]);
    hasInitialized.value = true;
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to load data',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

// Watch for space changes and refetch folders, update tabs
watch(() => spacesStore.currentSpaceId, async (newSpaceId, oldSpaceId) => {
  if (hasInitialized.value && newSpaceId !== oldSpaceId && newSpaceId !== null) {
    try {
      await foldersStore.fetchFolders();
      await sharedNotesStore.fetchSharedNotes();
      
      // Update open tabs when switching spaces
      // Close tabs that belong to folders in other spaces, but preserve:
      // - Notes without folders (folder_id === null) - these are global
      // - Shared notes (share_permission) - preserve for collaborative editing
      const currentSpaceFolderIds = new Set(
        foldersStore.folders.map(f => f.id)
      );
      
      const validTabs = notesStore.openTabs.filter(noteId => {
        const note = notesStore.notes.find(n => n.id === noteId);
        if (!note) {
          console.log('[Dashboard] Tab note not found:', noteId);
          return false;
        }
        
        // Keep shared notes for collaborative editing (preserve collaboration sessions)
        if (note.share_permission) {
          console.log('[Dashboard] Keeping shared note tab:', noteId, note.title);
          return true;
        }
        
        // Keep notes without folders (global notes, not tied to any space)
        if (note.folder_id === null) {
          console.log('[Dashboard] Keeping note without folder:', noteId, note.title);
          return true;
        }
        
        // Check if note's folder belongs to current space
        const noteFolder = foldersStore.getFolderById(note.folder_id);
        if (!noteFolder) {
          console.log('[Dashboard] Note folder not found:', noteId, note.folder_id);
          return false;
        }
        
        const folderBelongsToCurrentSpace = currentSpaceFolderIds.has(note.folder_id);
        if (!folderBelongsToCurrentSpace) {
          console.log('[Dashboard] Closing tab - note folder not in current space:', noteId, note.title, 'folder_id:', note.folder_id);
        }
        
        return folderBelongsToCurrentSpace;
      });
      
      // Update tabs if they changed
      if (validTabs.length !== notesStore.openTabs.length || 
          validTabs.some((id, i) => notesStore.openTabs[i] !== id)) {
        console.log('[Dashboard] Filtering tabs for space change:', {
          before: notesStore.openTabs.length,
          after: validTabs.length,
          currentSpaceId: newSpaceId
        });
        
        // Update tabs in store
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
    } catch (error) {
      console.error('Failed to fetch folders for new space:', error);
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
  
  // Initialize folder drag-and-drop after data is loaded
  await nextTick();
  await initializeFoldersSortable();
});

onUnmounted(() => {
  if (foldersSortableInstance) {
    foldersSortableInstance.destroy();
    foldersSortableInstance = null;
  }
  
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
const activeNote = computed(() => {
  const note = notesStore.activeNote;
  // Return note directly - Vue reactivity will track folder_id changes
  // The spread was breaking the reference equality check
  return note;
});

// Notes without folders (for "Quick Notes" section)
// Exclude notes shared WITH the user (they appear in "Shared" section instead)
// Only show notes that don't belong to folders in other spaces
const notesWithoutFolder = computed(() => {
  return notesStore.notes.filter(note => {
    // Only show notes owned by user (not shared with them)
    if (note.share_permission) return false;
    
    // Only show notes without folders
    if (note.folder_id !== null) return false;
    
    // Note is without folder, so it can be shown in any space
    // Quick notes are global (not tied to a specific space)
    return true;
  });
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

// Watch for active note changes and load it
watch(activeNote, (note, oldNote) => {
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
      console.log('[Dashboard] Loading collaborative note, skipping content sync to editForm');
      editForm.title = note.title;
      editForm.tags = note.tags || [];
      editForm.folder = note.folder || '';
      editForm.folder_id = note.folder_id || null;
      // Don't update editForm.content - CollaborativeEditor manages it via Y.Doc
      
      // Initialize previous values for change detection
      prevTitle.value = note.title;
      prevContent.value = editForm.content; // Keep current content value
      prevFolderId.value = note.folder_id || null;
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
          folder: note.folder
        });
        
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
// But ALWAYS save folder_id changes (Y.Doc doesn't handle metadata)
watch([() => editForm.title, () => editForm.content, () => editForm.folder_id], 
  ([newTitle, newContent, newFolderId]) => {
    if (isLocked.value || !activeNote.value) return;
    
    // Detect what changed
    const titleChanged = newTitle !== prevTitle.value;
    const contentChanged = newContent !== prevContent.value;
    const folderChanged = newFolderId !== prevFolderId.value;
    
    // Update previous values (handle undefined)
    prevTitle.value = (newTitle as string) || '';
    prevContent.value = (newContent as string) || '';
    prevFolderId.value = (newFolderId as number | null) ?? null;
    
    // For collaborative notes: skip auto-save for title/content (Y.Doc handles it)
    // BUT always save folder changes (Y.Doc doesn't handle metadata)
    const isCollaborative = activeNote.value.is_shared || activeNote.value.share_permission;
    if (isCollaborative && (titleChanged || contentChanged) && !folderChanged) {
      console.log('[Dashboard] Skipping auto-save for collaborative note title/content');
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
  isMobileSidebarOpen.value = false;
  // Persist selected folder to sessionStorage
  if (process.client) {
    sessionStorage.setItem('selected_folder_id', String(folderId));
  }
}

function selectAllNotes() {
  selectedFolderId.value = null;
  isMobileSidebarOpen.value = false;
  // Clear persisted folder selection
  if (process.client) {
    sessionStorage.removeItem('selected_folder_id');
  }
}

// Folder tree handlers
function handleToggleFolder(folderId: number) {
  foldersStore.toggleFolder(folderId);
}

function handleCreateSubfolder(parentId: number) {
  newFolderParentId.value = parentId;
  openCreateFolderModal();
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

async function handleMoveUp(folderId: number) {
  try {
    const siblings = foldersStore.getSiblings(folderId);
    const currentIndex = siblings.findIndex(f => f.id === folderId);
    if (currentIndex > 0) {
      // Batch all updates together to prevent flickering
      await foldersStore.reorderFolder(folderId, currentIndex - 1);
      
      // Refresh in one go after reorder completes
      await foldersStore.fetchFolders();
      
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
      // Batch all updates together to prevent flickering
      await foldersStore.reorderFolder(folderId, currentIndex + 1);
      
      // Refresh in one go after reorder completes
      await foldersStore.fetchFolders();
      
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
    await foldersStore.reorderFolder(folderId, newIndex);
    
    // Refresh folder tree to update UI
    await foldersStore.fetchFolders();
  } catch (error) {
    console.error('Reorder folder error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to reorder folder',
      color: 'error'
    });
  }
}

// Initialize folder drag-and-drop
async function initializeFoldersSortable() {
  if (!foldersContainerRef.value) {
    return;
  }
  
  if (foldersSortableInstance) {
    foldersSortableInstance.destroy();
    foldersSortableInstance = null;
  }
  
  await nextTick();
  
  if (!foldersContainerRef.value) {
    return;
  }
  
  try {
    const SortableJS = (await import('sortablejs')).default;
    
    // Check if folder items exist
    const folderItems = foldersContainerRef.value.querySelectorAll('.folder-item');
    console.log('[Dashboard] Found folder items:', folderItems.length);
    
    if (folderItems.length === 0) {
      console.warn('[Dashboard] No folder items found, cannot initialize Sortable');
      return;
    }
    
    foldersSortableInstance = SortableJS.create(foldersContainerRef.value, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      draggable: '.folder-item',
      forceFallback: false,
      delay: 0,
      delayOnTouchOnly: true,
      touchStartThreshold: 3,
      filter: '.no-drag',
      preventOnFilter: false,
      group: {
        name: 'folders',
        pull: false, // Don't allow moving folders between different parents
        put: false // Don't allow dropping folders from other parents
      },
      onStart: (evt) => {
        console.log('[Dashboard] Root folder drag started', evt);
      },
      onEnd: async (evt) => {
        const { oldIndex, newIndex, item } = evt;
        
        console.log('[Dashboard] Root folder drag ended', {
          oldIndex,
          newIndex,
          item
        });
        
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
          console.log('[Dashboard] No root folder reorder needed');
          return;
        }
        
        const folderId = item.getAttribute('data-folder-id');
        if (!folderId) {
          console.error('[Dashboard] No folder ID found on dragged item');
          return;
        }
        
        console.log('[Dashboard] Reordering root folder', {
          folderId,
          oldIndex,
          newIndex
        });
        
        try {
          await handleFolderReorder(parseInt(folderId), newIndex);
        } catch (error) {
          console.error('Failed to reorder folder:', error);
        }
      }
    });
    
    console.log('[Dashboard] Root folders Sortable initialized', {
      container: foldersContainerRef.value,
      childCount: foldersContainerRef.value?.children.length,
      folderItems: foldersContainerRef.value?.querySelectorAll('.folder-item').length
    });
  } catch (error) {
    console.error('[Dashboard] Error initializing folders Sortable:', error);
  }
}

// Watch for folder tree changes and reinitialize Sortable
watch(
  () => foldersStore.folderTree.length,
  async () => {
    if (foldersStore.folderTree.length > 0) {
      await nextTick();
      await initializeFoldersSortable();
    }
  },
  { immediate: true }
);

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
      name,
      parent_id: newFolderParentId.value
    });

    toast.add({
      title: 'Success',
      description: `Folder "${name}" created`,
      color: 'success'
    });

    showCreateFolderModal.value = false;
    newFolderParentId.value = null;
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

// Share note functions
function openShareModal() {
  if (!activeNote.value) return;
  showShareModal.value = true;
  shareUserSearch.value = '';
  userSearchResults.value = [];
  selectedUserToShare.value = null;
}

async function searchUsers() {
  if (shareUserSearch.value.length < 2) {
    userSearchResults.value = [];
    return;
  }

  try {
    userSearchResults.value = await sharedNotesStore.searchUsers(shareUserSearch.value);
  } catch (error) {
    console.error('User search error:', error);
  }
}

function selectUserToShare(user: { id: number; email: string; name: string | null }) {
  selectedUserToShare.value = user;
  shareUserSearch.value = user.name || user.email;
  userSearchResults.value = [];
}

async function shareNote() {
  if (!activeNote.value || !selectedUserToShare.value) return;

  try {
    await sharedNotesStore.shareNote(
      activeNote.value.id,
      selectedUserToShare.value.email,
      sharePermission.value
    );

    // Refresh notes to update the is_shared field
    await notesStore.fetchNotes();

    toast.add({
      title: 'Success',
      description: `Note shared with ${selectedUserToShare.value.name || selectedUserToShare.value.email}`,
      color: 'success'
    });

    showShareModal.value = false;
    shareUserSearch.value = '';
    selectedUserToShare.value = null;
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to share note',
      color: 'error'
    });
  }
}

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
        // Get the current content directly from CollaborativeEditor
        let contentToSave = '';
        if (collaborativeEditorRef.value?.getCurrentContent) {
          contentToSave = collaborativeEditorRef.value.getCurrentContent();
          console.log('[Dashboard] Got content from CollaborativeEditor, length:', contentToSave.length);
        } else {
          // Fallback: use content from activeNote (updated by CollaborativeEditor's @update:content)
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

async function handleOpenSharedNote(share: any) {
  await notesStore.openTab(share.note_id);
  isMobileSidebarOpen.value = false;
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
// Handle note selection from search modal
async function handleNoteSelected(note: Note) {
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
      spacesStore.setCurrentSpace(noteSpaceId);
      
      // Wait for folders to be refetched for the new space
      // This ensures the folder structure is loaded before opening the note
      await foldersStore.fetchFolders(noteSpaceId);
      await sharedNotesStore.fetchSharedNotes();
      
      // Wait for next tick to ensure space change has propagated
      await nextTick();
    }
  }
  
  // Now open the note (it will be in the correct space)
  await notesStore.openTab(note.id);
}

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
    const updateData: UpdateNoteDto = {
      title: editForm.title,
      content: editForm.content,
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
    <!-- Loading screen while auth is initializing or during SSR -->
    <div v-if="!isMounted || !authStore.currentUser || !authStore.initialized" class="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>

    <!-- Main dashboard with Notion-like layout -->
    <div v-else :key="`dashboard-${authStore.currentUser?.id}-${sessionKey}`" class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
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
              <img src="/folder.png" alt="Unfold" class="w-16 h-16 flex-shrink-0" />
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

            <div v-if="foldersStore.folderTree.length === 0" class="px-3 py-6 text-center">
              <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No folders yet</p>
              <button
                @click="openCreateFolderModal"
                class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Create your first folder
              </button>
            </div>

            <!-- Folder Tree with Notes -->
            <div v-else ref="foldersContainerRef" class="space-y-0.5" id="root-folders-container">
              <FolderTreeItem
                v-for="folder in foldersStore.folderTree"
                :key="folder.id"
                :folder="folder"
                :selected-id="selectedFolderId"
                :is-expanded="foldersStore.expandedFolderIds.has(folder.id)"
                @select="selectFolder"
                @toggle="handleToggleFolder"
                @create-subfolder="handleCreateSubfolder"
                @create-note="handleCreateNoteInFolder"
                @create-quick-note="handleQuickNoteInFolder"
                @create-list-note="handleListNoteInFolder"
                @create-template-note="handleTemplateNoteInFolder"
                @create-ai-note="handleAiGenerateInFolder"
                @import-recipe="handleRecipeImportInFolder"
                @rename="handleRenameFolder"
                @delete="handleDeleteFolder"
                @move-up="handleMoveUp"
                @move-down="handleMoveDown"
                @reorder-folder="handleFolderReorder"
                @open-note="handleFolderNoteClick"
                @delete-note="(noteId) => handleDeleteNote(notesStore.notes.find(n => n.id === noteId)!)"
              />
            </div>
          </div>

          <!-- Shared Notes Section -->
          <div class="mt-6">
            <button 
              @click="isSharedNotesExpanded = !isSharedNotesExpanded"
              class="w-full flex items-center justify-between px-3 py-1.5 mb-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            >
              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <UIcon 
                  name="i-heroicons-chevron-right" 
                  class="w-3.5 h-3.5 transition-transform duration-200"
                  :class="isSharedNotesExpanded ? 'rotate-90' : ''"
                />
                <UIcon name="i-heroicons-user-group" class="w-3.5 h-3.5" />
                Shared
              </h3>
              <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                {{ sharedNotesStore.groupedSharedNotes.length }}
              </span>
            </button>

            <!-- Shared notes list -->
            <Transition name="expand-shared">
              <div v-if="isSharedNotesExpanded && sharedNotesStore.groupedSharedNotes.length > 0" class="shared-notes-container">
                <div class="shared-notes-content space-y-0.5">
                  <div
                    v-for="share in sharedNotesStore.groupedSharedNotes"
                    :key="`share-${share.note_id}`"
                    @click="handleOpenSharedNote(share)"
                    class="group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    :class="notesStore.activeTabId === share.note_id ? 'bg-purple-100 dark:bg-purple-900/30' : ''"
                  >
                    <UIcon 
                      :name="share.is_owned_by_me ? 'i-heroicons-arrow-up-tray' : 'i-heroicons-arrow-down-tray'" 
                      class="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" 
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {{ share.note_title }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {{ share.is_owned_by_me ? 
                           (share.shareCount > 1 ? `Shared with ${share.shareCount} people` : `Shared with ${share.shared_with_name || share.shared_with_email}`) : 
                           `From ${share.owner_name || share.owner_email}` }}
                      </p>
                    </div>
                    <UBadge 
                      :color="share.permission === 'editor' ? 'primary' : 'neutral'" 
                      size="xs"
                      class="flex-shrink-0"
                    >
                      {{ share.permission }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </Transition>

            <Transition name="expand-shared">
              <div v-if="isSharedNotesExpanded && sharedNotesStore.groupedSharedNotes.length === 0" class="shared-notes-container">
                <div class="shared-notes-content px-3 py-6 text-center">
                  <UIcon name="i-heroicons-user-group" class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p class="text-xs text-gray-500 dark:text-gray-400">No shared notes yet</p>
                </div>
              </div>
            </Transition>
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

      <!-- Mobile Sidebar Drawer -->
      <Teleport to="body">
        <Transition name="drawer">
          <div
            v-if="isMobileSidebarOpen"
            class="fixed inset-0 z-50 md:hidden"
          >
            <!-- Backdrop -->
            <div
              class="absolute inset-0 bg-black/50 backdrop-blur-sm"
              @click="isMobileSidebarOpen = false"
            />
            
            <!-- Drawer -->
            <div class="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <!-- Drawer Header -->
              <div class="flex items-center justify-between px-3 py-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-1">
                  <img src="/folder.png" alt="Unfold" class="w-16 h-16" />
                  <h1 class="text-lg font-extrabold text-gray-900 dark:text-white tracking-wide">Unfold</h1>
                </div>
                <button
                  @click="isMobileSidebarOpen = false"
                  class="p-2 -mr-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                </button>
              </div>

              <!-- Drawer Content (Same as Desktop Sidebar) -->
              <div class="flex-1 overflow-y-auto p-3">
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
                          class="flex-shrink-0 p-1.5 rounded-md opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
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

                  <div v-if="foldersStore.folderTree.length === 0" class="px-3 py-6 text-center">
                    <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No folders yet</p>
                    <button
                      @click="openCreateFolderModal"
                      class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Create your first folder
                    </button>
                  </div>

                  <!-- Folder Tree with Notes -->
                  <div v-else class="space-y-0.5">
                    <FolderTreeItem
                      v-for="folder in foldersStore.folderTree"
                      :key="folder.id"
                      :folder="folder"
                      :selected-id="selectedFolderId"
                      :is-expanded="foldersStore.expandedFolderIds.has(folder.id)"
                      @select="selectFolder"
                      @toggle="handleToggleFolder"
                      @create-subfolder="handleCreateSubfolder"
                @create-note="handleCreateNoteInFolder"
                @create-list-note="handleListNoteInFolder"
                @create-template-note="handleTemplateNoteInFolder"
                @create-ai-note="handleAiGenerateInFolder"
                @import-recipe="handleRecipeImportInFolder"
                @rename="handleRenameFolder"
                @delete="handleDeleteFolder"
                @move-up="handleMoveUp"
                @move-down="handleMoveDown"
                @reorder-folder="handleFolderReorder"
                @open-note="handleFolderNoteClick"
                @delete-note="(noteId) => handleDeleteNote(notesStore.notes.find(n => n.id === noteId)!)"
                    />
                  </div>
                </div>

                <!-- Shared Notes Section (Mobile) -->
                <div class="mt-6">
                  <button 
                    @click="isSharedNotesExpanded = !isSharedNotesExpanded"
                    class="w-full flex items-center justify-between px-3 py-1.5 mb-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <UIcon 
                        name="i-heroicons-chevron-right" 
                        class="w-3.5 h-3.5 transition-transform duration-200"
                        :class="isSharedNotesExpanded ? 'rotate-90' : ''"
                      />
                      <UIcon name="i-heroicons-user-group" class="w-3.5 h-3.5" />
                      Shared
                    </h3>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                      {{ sharedNotesStore.groupedSharedNotes.length }}
                    </span>
                  </button>

                  <!-- Shared notes list -->
                  <Transition name="expand-shared">
                    <div v-if="isSharedNotesExpanded && sharedNotesStore.groupedSharedNotes.length > 0" class="shared-notes-container">
                      <div class="shared-notes-content space-y-0.5">
                        <div
                          v-for="share in sharedNotesStore.groupedSharedNotes"
                          :key="`share-mobile-${share.note_id}`"
                          @click="handleOpenSharedNote(share)"
                          class="group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          :class="notesStore.activeTabId === share.note_id ? 'bg-purple-100 dark:bg-purple-900/30' : ''"
                        >
                          <UIcon 
                            :name="share.is_owned_by_me ? 'i-heroicons-arrow-up-tray' : 'i-heroicons-arrow-down-tray'" 
                            class="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" 
                          />
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {{ share.note_title }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {{ share.is_owned_by_me ? 
                                 (share.shareCount > 1 ? `Shared with ${share.shareCount} people` : `Shared with ${share.shared_with_name || share.shared_with_email}`) : 
                                 `From ${share.owner_name || share.owner_email}` }}
                            </p>
                          </div>
                          <UBadge 
                            :color="share.permission === 'editor' ? 'primary' : 'neutral'" 
                            size="xs"
                            class="flex-shrink-0"
                          >
                            {{ share.permission }}
                          </UBadge>
                        </div>
                      </div>
                    </div>
                  </Transition>

                  <Transition name="expand-shared">
                    <div v-if="isSharedNotesExpanded && sharedNotesStore.groupedSharedNotes.length === 0" class="shared-notes-container">
                      <div class="shared-notes-content px-3 py-6 text-center">
                        <UIcon name="i-heroicons-user-group" class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p class="text-xs text-gray-500 dark:text-gray-400">No shared notes yet</p>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Drawer Footer -->
              <div class="p-3 border-t border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3 p-2 mb-2">
                  <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {{ userInitial }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ authStore.currentUser?.name || 'User' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ authStore.currentUser?.email }}
                    </p>
                  </div>
                </div>
                <div class="space-y-2">
                  <UButton
                    icon="i-heroicons-cog-6-tooth"
                    color="neutral"
                    variant="soft"
                    block
                    @click="navigateTo('/settings'); isMobileSidebarOpen = false"
                  >
                    Settings
                  </UButton>
                  <UButton
                    icon="i-heroicons-arrow-right-on-rectangle"
                    color="error"
                    variant="soft"
                    block
                    @click="authStore.logout()"
                  >
                    Logout
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
        <!-- Mobile Menu Button (Floating on Mobile) -->
        <button
          @click="isMobileSidebarOpen = true"
          class="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Open menu"
        >
          <UIcon name="i-heroicons-bars-3" class="w-6 h-6" />
        </button>

        <!-- Tab Bar with Actions -->
        <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
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
                  :class="isPolishing ? 'animate-spin' : ''" 
                  class="w-4 h-4" 
                />
              </button>
              
              <!-- Share Note Button -->
              <button
                v-if="activeNote.user_id === authStore.currentUser?.id"
                @click="openShareModal"
                class="p-2 rounded-lg transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                title="Share Note"
              >
                <UIcon name="i-heroicons-user-plus" class="w-4 h-4" />
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
              <div class="flex items-center gap-2 px-4 border-l border-gray-200 dark:border-gray-700">
                <div 
                  class="flex items-center gap-1.5 text-xs"
                  :class="{
                    'text-gray-500 dark:text-gray-400': isSaving,
                    'text-green-600 dark:text-green-400': !isSaving
                  }"
                >
                  <UIcon 
                    v-if="isSaving"
                    name="i-heroicons-arrow-path"
                    class="w-4 h-4 animate-spin"
                  />
                  <UIcon 
                    v-else
                    name="i-heroicons-check-circle"
                    class="w-4 h-4"
                  />
                  <span class="hidden lg:inline">
                    {{ isSaving ? 'Saving...' : 'Saved' }}
                  </span>
                </div>
              </div>
            </ClientOnly>
          </div>
        </div>

        <!-- Note Editor Area - Fully Scrollable -->
        <div class="flex-1 overflow-y-auto" :class="activeNote ? (isLocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900') : 'bg-gray-50 dark:bg-gray-900'">
          <!-- No tabs open state -->
          <div v-if="!activeNote" class="min-h-full flex items-center justify-center">
            <div class="text-center">
              <UIcon name="i-heroicons-document-text" class="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">No note selected</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-6">Select a note from the sidebar or create a new one by right-clicking on a folder</p>
              <!-- <UButton 
                @click="handleCreateNote" 
                icon="i-heroicons-plus"
                :loading="isCreating"
                :disabled="isCreating"
              >
                Create Note
              </UButton> -->
            </div>
          </div>

          <!-- Note Editor - Everything Scrolls Together -->
          <div v-else>
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
                    :disabled="activeNote.is_shared || !!activeNote.share_permission"
                    class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Untitled Note"
                  />
                  <p v-if="activeNote.is_shared || activeNote.share_permission" class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
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
            <div v-if="!isLocked && !activeNote.share_permission" class="flex items-center gap-4 text-sm flex-wrap">
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
                      v-for="folder in foldersStore.folderTree"
                      :key="folder.id"
                      :folder="folder"
                      :selected-id="editForm.folder_id ?? null"
                      :depth="0"
                      @select="(id) => { selectFolderForNote(id); showFolderDropdown = false; }"
                    />
                  </div>
                </Teleport>
              </div> -->

              <!-- Tags -->
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <div class="flex items-center gap-1 flex-wrap">
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
            <div v-else-if="(isLocked || activeNote.share_permission) && (selectedFolderName || editForm.tags?.length)" class="flex items-center gap-3 text-xs flex-wrap">
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
              <!-- Use CollaborativeEditor for shared notes -->
              <CollaborativeEditor
                v-if="activeNote.is_shared || activeNote.share_permission"
                ref="collaborativeEditorRef"
                :key="`collab-${activeNote.id}-${authStore.currentUser?.id || 'anon'}`"
                :note-id="activeNote.id"
                :editable="!isLocked && (activeNote.share_permission === 'editor' || activeNote.user_id === authStore.currentUser?.id)"
                :user-name="authStore.currentUser?.name || authStore.currentUser?.email || 'Anonymous'"
                :user-color="generateUserColor(authStore.currentUser?.id)"
                :initial-content="activeNote.content || ''"
                placeholder="Start writing... Right-click for options or press ? for keyboard shortcuts"
                @update:content="(content) => { if (activeNote) activeNote.content = content }"
              />
              
              <!-- Use regular TiptapEditor for non-shared notes -->
              <ClientOnly v-else>
                <TiptapEditor
                  v-model="editForm.content"
                  placeholder="Start writing... Right-click for options or press ? for keyboard shortcuts"
                  :editable="!isLocked"
                  :showToolbar="false"
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

    <!-- Share Note Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showShareModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showShareModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <UIcon name="i-heroicons-user-plus" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Share Note
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Collaborate in real-time with other users
            </p>

            <!-- User search -->
            <div class="mb-4">
              <label class="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">Share with user</label>
              <input
                v-model="shareUserSearch"
                @input="searchUsers"
                type="text"
                placeholder="Search by email or name..."
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <!-- Search results -->
              <div v-if="userSearchResults.length > 0" class="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-y-auto">
                <button
                  v-for="user in userSearchResults"
                  :key="user.id"
                  @click="selectUserToShare(user)"
                  type="button"
                  class="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                >
                  <div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {{ (user.name || user.email).charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-white truncate">{{ user.name || user.email }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ user.email }}</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- Permission selector -->
            <div class="mb-6">
              <label class="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-300">Permission</label>
              <select 
                v-model="sharePermission" 
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="editor">Can Edit</option>
                <option value="viewer">Can View Only</option>
              </select>
            </div>

            <!-- Current shares list -->
            <div v-if="currentNoteShares.length > 0" class="mb-6">
              <h4 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">Currently shared with:</h4>
              <div class="space-y-2">
                <div
                  v-for="share in currentNoteShares"
                  :key="share.id"
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {{ (share.shared_with_name || share.shared_with_email).charAt(0).toUpperCase() }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ share.shared_with_name || share.shared_with_email }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ share.permission }}</p>
                    </div>
                  </div>
                  <button
                    @click="removeShare(share.id)"
                    type="button"
                    class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove share"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <UButton 
                color="neutral" 
                variant="soft" 
                block 
                @click="showShareModal = false"
              >
                Close
              </UButton>
              <UButton 
                color="primary" 
                block 
                @click="shareNote"
                :disabled="!selectedUserToShare"
              >
                Share
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Search Modal -->
    <SearchModal 
      :is-open="showSearchModal"
      @update:is-open="showSearchModal = $event"
      @selected="handleNoteSelected"
    />
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

/* Drawer animation */
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s ease;
}

.drawer-enter-active .absolute.left-0,
.drawer-leave-active .absolute.left-0 {
  transition: transform 0.3s ease;
}

.drawer-enter-from .absolute.left-0,
.drawer-leave-to .absolute.left-0 {
  transform: translateX(-100%);
}

.drawer-enter-from .absolute.inset-0.bg-black\/50,
.drawer-leave-to .absolute.inset-0.bg-black\/50 {
  opacity: 0;
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
</style>


