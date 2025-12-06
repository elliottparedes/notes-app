<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onActivated, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useNotesStore } from '~/stores/notes';
import { useFoldersStore } from '~/stores/folders';
import { useSpacesStore } from '~/stores/spaces';
import { useSharedNotesStore } from '~/stores/sharedNotes';
import { useToast } from '~/composables/useToast';
import type { Note, CreateNoteDto, CreateFolderDto, Space } from '~/models';
import { v4 as uuidv4 } from 'uuid';
import Sortable from 'sortablejs';
// UnifiedEditor is auto-imported by Nuxt, but we can import explicit type if needed
// MobileBottomNav is auto-imported

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();
const sharedNotesStore = useSharedNotesStore();
const toast = useToast();

// Initial loading state
const isMounted = ref(false);
const hasInitialized = ref(false); // Track if data has been loaded
const isLoadingNoteFromSearch = ref(false);
const noteJustSelectedFromSearch = ref(false);
const searchQueryForHighlight = ref<string | null>(null);

// Selection State
const selectedFolderId = ref<number | null>(null);
const previousFolderId = ref<number | null>(null); // Track previous folder for animation direction
const expandedSpaceIds = ref<Set<number>>(new Set());
const noteToDelete = ref<string | null>(null); // Track which note is in delete confirmation mode

// Modal states
const showMobileSpacesSheet = ref(false);
const showMobileFoldersSheet = ref(false);
const showCreateFolderModal = ref(false); // Restored modal state
const showSearchModal = ref(false);

// Inline Space Renaming
const editingSpaceId = ref<number | null>(null);
const editingSpaceName = ref('');
const spaceRenameInputRef = ref<HTMLInputElement | null>(null);

// Space Context Menu
const showSpaceContextMenu = ref<number | null>(null);
const spaceContextMenuRefs = ref(new Map<number, HTMLElement | null>());
const spaceMenuPositions = ref(new Map<number, { top: number; left: number; bottom: number }>());
const spaceMenuOpensUpward = ref(new Map<number, boolean>());

// Helper to check if we're on mobile (client-side only)
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 768;
});

// Space Delete Confirmation
const showDeleteSpaceModal = ref(false);
const deletingSpaceId = ref<number | null>(null);
const isDeletingSpace = ref(false);

function startSpaceRename(space: Space) {
  editingSpaceId.value = space.id;
  editingSpaceName.value = space.name;
  nextTick(() => {
    spaceRenameInputRef.value?.focus();
  });
}

async function saveSpaceRename() {
  if (editingSpaceId.value === null) return;
  
  const newName = editingSpaceName.value.trim();
  if (newName) {
    try {
      await spacesStore.updateSpace(editingSpaceId.value, { name: newName });
    } catch (error) {
      console.error('Failed to rename space:', error);
      toast.error('Failed to rename notebook');
    }
  }
  
  editingSpaceId.value = null;
  editingSpaceName.value = '';
}

function cancelSpaceRename() {
  editingSpaceId.value = null;
  editingSpaceName.value = '';
}

function toggleSpaceContextMenu(event: MouseEvent, spaceId: number) {
  event.stopPropagation();
  event.preventDefault();
  
  if (!process.client) return;
  
  const menuWidth = 192;
  const viewportWidth = window.innerWidth;
  
  // Get button position from event target
  const target = event.currentTarget as HTMLElement;
  if (!target) {
    console.error('No target element found');
    return;
  }
  
  const rect = target.getBoundingClientRect();
  console.log('Button rect:', rect);
  
  // Position directly to the right of the button
  let left = rect.right + 4;
  
  // If menu would overflow on the right, position it to the left instead
  if (left + menuWidth > viewportWidth - 8) {
    left = rect.left - menuWidth - 4;
    if (left < 8) {
      left = 8;
    }
  }
  
  // Align top of menu with top of button
  const top = rect.top;
  
  console.log('Setting menu position:', { top, left, spaceId });
  
  // Create new Map to ensure reactivity
  const newPositions = new Map(spaceMenuPositions.value);
  newPositions.set(spaceId, { top, left, bottom: 0 });
  spaceMenuPositions.value = newPositions;
  
  const newOpensUpward = new Map(spaceMenuOpensUpward.value);
  newOpensUpward.set(spaceId, false);
  spaceMenuOpensUpward.value = newOpensUpward;
  
  // Toggle menu visibility after position is set
  if (showSpaceContextMenu.value === spaceId) {
    showSpaceContextMenu.value = null;
  } else {
    showSpaceContextMenu.value = spaceId;
  }
}

function handleDeleteSpace(spaceId: number) {
  // Check if this is the last space
  if (spacesStore.spaces.length <= 1) {
    toast.error('Cannot delete the last remaining space');
    showSpaceContextMenu.value = null;
    return;
  }
  
  deletingSpaceId.value = spaceId;
  showDeleteSpaceModal.value = true;
  showSpaceContextMenu.value = null;
}

async function confirmDeleteSpace() {
  if (deletingSpaceId.value === null) return;
  
  isDeletingSpace.value = true;
  
  try {
    await spacesStore.deleteSpace(deletingSpaceId.value);
    toast.success('Space deleted successfully');
    showDeleteSpaceModal.value = false;
    deletingSpaceId.value = null;
    
    // Refetch folders if we deleted the current space
    if (spacesStore.currentSpaceId) {
      await foldersStore.fetchFolders(undefined, true);
    }
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

// Drag and Drop State
const folderListRefs = ref(new Map<number, HTMLElement>());
const spacesListRef = ref<HTMLElement | null>(null);
const sortableInstances = ref<Sortable[]>([]);
const noteListRef = ref<HTMLElement | null>(null);
const noteSortableInstance = ref<Sortable | null>(null);
const isDraggingSpace = ref(false);

const setFolderListRef = (el: any, spaceId: number) => {
  if (el) {
    folderListRefs.value.set(spaceId, el as HTMLElement);
  } else {
    folderListRefs.value.delete(spaceId);
  }
};

const setSpaceContextMenuRef = (el: any, spaceId: number) => {
  if (el) {
    spaceContextMenuRefs.value.set(spaceId, el as HTMLElement);
  } else {
    spaceContextMenuRefs.value.delete(spaceId);
  }
};

function getSpaceMenuStyle(spaceId: number) {
  const position = spaceMenuPositions.value.get(spaceId);
  const opensUpward = spaceMenuOpensUpward.value.get(spaceId);
  
  if (!position) {
    return { top: '0px', left: '0px', bottom: 'auto' };
  }
  
  return {
    top: opensUpward ? 'auto' : `${position.top}px`,
    bottom: opensUpward ? `${position.bottom}px` : 'auto',
    left: `${position.left}px`
  };
}

function initNoteSortable() {
  if (noteSortableInstance.value) {
    noteSortableInstance.value.destroy();
    noteSortableInstance.value = null;
  }

  if (noteListRef.value && selectedFolderId.value) {
    noteSortableInstance.value = new Sortable(noteListRef.value, {
      group: 'notes',
      animation: 200, // Smooth animation
      ghostClass: 'bg-primary-50', // Class for the drag placeholder
      draggable: '.note-item',
      delay: 150, // Delay before drag starts (prevents accidental drags on click)
      delayOnTouchOnly: false, // Apply delay to both touch and mouse
      distance: 10, // Require 10px movement before drag starts (prevents accidental drags)
      onEnd: (evt) => {
        const { newIndex, oldIndex, item } = evt;
        const noteId = item.dataset.noteId;
        
        if (noteId && newIndex !== undefined && oldIndex !== newIndex) {
           // Provide instant feedback handled by Sortable's animation
           notesStore.reorderNote(noteId, selectedFolderId.value, newIndex);
        }
      }
    });
  }
}

function initSortables() {
  // Cleanup old instances
  sortableInstances.value.forEach(instance => instance.destroy());
  sortableInstances.value = [];

  // Initialize Space Sortable
  if (spacesListRef.value) {
    const instance = new Sortable(spacesListRef.value, {
      group: 'spaces',
      animation: 150,
      draggable: '.space-item',
      handle: '.space-button', // Drag by the button itself
      delay: 150, // Delay before drag starts (prevents accidental drags on click)
      delayOnTouchOnly: false, // Apply delay to both touch and mouse
      distance: 10, // Require 10px movement before drag starts (prevents accidental drags)
      onStart: () => {
        isDraggingSpace.value = true;
      },
      onEnd: (evt) => {
        isDraggingSpace.value = false;
        const { newIndex, oldIndex, item } = evt;
        const spaceId = Number(item.dataset.spaceId);
        
        if (spaceId && newIndex !== undefined && oldIndex !== newIndex) {
          spacesStore.reorderSpace(spaceId, newIndex);
        }
      }
    });
    sortableInstances.value.push(instance);
  }

  folderListRefs.value.forEach((el, spaceId) => {
    const instance = new Sortable(el, {
      group: 'folders',
      animation: 150,
      draggable: '.folder-item',
      delay: 150, // Delay before drag starts (prevents accidental drags on click)
      delayOnTouchOnly: false, // Apply delay to both touch and mouse
      distance: 10, // Require 10px movement before drag starts (prevents accidental drags)
      onEnd: (evt) => {
        // Reorder in same list
        if (evt.to === evt.from) {
           const itemEl = evt.item;
           const folderId = Number(itemEl.dataset.folderId);
           const newIndex = evt.newIndex;
           
           if (folderId && newIndex !== undefined && evt.oldIndex !== newIndex) {
               foldersStore.reorderFolder(folderId, newIndex);
           }
        }
      },
      onAdd: (evt) => {
        // Moved to another list
        const itemEl = evt.item;
        const folderId = Number(itemEl.dataset.folderId);
        const targetSpaceId = spaceId; // Closure captures spaceId
        const newIndex = evt.newIndex;
        
        // Remove the element Sortable added to prevent duplication with Vue's rendering
        // Vue will re-render the item in the new list once the store updates
        itemEl.remove();

        if (folderId && newIndex !== undefined) {
            // Move and then reorder
            foldersStore.moveFolder(folderId, targetSpaceId)
                .then(() => foldersStore.reorderFolder(folderId, newIndex))
                .catch(() => {
                  toast.error('Failed to move section');
                  // Ideally revert UI here, but a full refresh might be needed if optimistic update failed
                });
        }
      }
    });
    sortableInstances.value.push(instance);
  });
}

// Re-init sortables when spaces change or folders load
watch(() => [spacesStore.spaces.length, hasInitialized.value], () => {
  if (hasInitialized.value) {
    nextTick(() => {
      initSortables();
      initNoteSortable();
    });
  }
});

// Watch for folder selection change to init note sortable
watch(() => selectedFolderId.value, () => {
  nextTick(() => initNoteSortable());
});

// Watch for notes loading to finish
// Clear search query when switching to a different note (unless we just selected it from search)
watch(() => notesStore.activeTabId, (newNoteId, oldNoteId) => {
  // Clear search query when switching notes, but only if we're not in the middle of selecting from search
  if (newNoteId !== oldNoteId && !isLoadingNoteFromSearch.value && !noteJustSelectedFromSearch.value) {
    searchQueryForHighlight.value = null;
  }
});

watch(() => notesStore.loading, (loading) => {
  if (!loading) {
    nextTick(() => initNoteSortable());
  }
});

// Expand space on drag over
function handleSpaceDragOver(spaceId: number) {
  // Don't expand if reordering spaces
  if (isDraggingSpace.value) return;
  
  if (!expandedSpaceIds.value.has(spaceId)) {
    expandedSpaceIds.value.add(spaceId);
  }
}

// Folder Creation State
const newFolderName = ref('');
const isCreatingFolder = ref(false);
const targetSpaceIdForFolderCreation = ref<number | undefined>(undefined);

// Data loading
async function loadData() {
  if (hasInitialized.value) return;
  
  try {
    await Promise.all([
      spacesStore.fetchSpaces(),
      // Fetch ALL folders for the sidebar tree
      foldersStore.fetchFolders(null), 
      notesStore.fetchNotes(),
      sharedNotesStore.fetchSharedNotes()
    ]);
    hasInitialized.value = true;
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.error('Failed to load data');
  }
}

// Helper to get folders for a specific space
function getSpaceFolders(spaceId: number) {
  return foldersStore.folders.filter(f => f.space_id === spaceId);
}

// Helper to get note count for folder (for mobile view)
function getFolderNoteCount(folderId: number) {
  return notesStore.notes.filter(n => n.folder_id === folderId && !n.share_permission).length;
}

// ... (Keep existing helpers like formatDate, truncateNoteTitle if needed)
function formatDate(date: string | Date): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(date: string | Date): string {
  if (!date) return '';
  
  let d = new Date(date);
  
  // If input is a string, we need to be careful about how it's parsed.
  // If it's a UTC string from DB but missing 'Z', append it.
  if (typeof date === 'string') {
    // Check if it looks like "YYYY-MM-DD HH:MM:SS" (MySQL default)
    if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      d = new Date(date.replace(' ', 'T') + 'Z');
    } 
    // Check if it looks like "YYYY-MM-DDTHH:MM:SS" but missing Z/offset
    else if (date.indexOf('T') !== -1 && !date.endsWith('Z') && !date.includes('+') && !date.match(/-\d{2}:\d{2}$/)) {
      d = new Date(date + 'Z');
    }
  }

  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Decode HTML entities properly
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  // Create a temporary element to decode HTML entities
  if (process.client) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  } else {
    // Fallback for SSR - decode common entities
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x60;/g, '`')
      .replace(/&#x3D;/g, '=');
  }
}

// Get note preview HTML - just decode entities, keep HTML formatting
function getNotePreview(content: string): string {
  if (!content) return '';
  // Just decode HTML entities, keep all HTML tags for proper formatting
  return decodeHtmlEntities(content);
}

function formatHeaderDate(date: string | Date): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// ... (Keep layout state)
const isDesktopSidebarVisible = ref(true);
const sidebarWidth = ref(260);
const noteListWidth = ref(280); // New middle column width
const isResizing = ref(false);
const isResizingNoteList = ref(false);

// Fullscreen state
const isFullscreen = ref(false);

// Space Modal State
const showSpaceModal = ref(false);
const editingSpace = ref<Space | null>(null);

// Initialize expanded state with current space if available
watch(() => spacesStore.currentSpaceId, (newId) => {
  if (newId !== null && !expandedSpaceIds.value.has(newId)) {
    expandedSpaceIds.value.add(newId);
  }
}, { immediate: true });

function openCreateSpaceModal() {
  editingSpace.value = null;
  showSpaceModal.value = true;
}

// Computed for displayNotes (filtered by selectedFolderId)
const displayNotes = computed(() => {
  if (selectedFolderId.value !== null) {
    const notesInFolder = notesStore.notes.filter(note => 
      note.folder_id === selectedFolderId.value && !note.share_permission
    );

    // Get order for this folder
    const folderKey = `folder_${selectedFolderId.value}`;
    const order = notesStore.noteOrder[folderKey];

    if (order && order.length > 0) {
      // Sort based on order array
      return notesInFolder.sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        
        // If both are in order list, sort by index
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        
        // If one is not in order list, put it at the end (preserve position)
        if (indexA === -1 && indexB !== -1) return 1;
        if (indexA !== -1 && indexB === -1) return -1;
        
        // If neither is in order list, sort by created_at (preserve creation order)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    // If no order exists, sort by created_at to maintain stable order
    return notesInFolder.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else {
    return [];
  }
});

const activeNote = computed(() => notesStore.activeNote);

// Note that belongs to displayed folders (for mobile list)
const displayedFolders = computed(() => {
  if (!spacesStore.currentSpaceId) return [];
  return getSpaceFolders(spacesStore.currentSpaceId);
});

const shouldShowEmptyState = computed(() => !activeNote.value);

// Actions
async function handleSelectSpace(spaceId: number) {
  // Toggle expansion logic
  if (expandedSpaceIds.value.has(spaceId)) {
    expandedSpaceIds.value.delete(spaceId);
  } else {
    expandedSpaceIds.value.add(spaceId);
    // Also set as current space for context, but don't collapse others
    spacesStore.setCurrentSpace(spaceId);
  }
}

function handleSelectFolder(folderId: number) {
  // Track previous folder before switching
  previousFolderId.value = selectedFolderId.value;
  selectedFolderId.value = folderId;
  // Optionally select first note?
}

function handleFolderClick(folder: any) {
  handleSelectFolder(folder.id);
  showMobileFoldersSheet.value = false;
}

async function handleOpenNote(noteId: string) {
  // Reset delete confirmation when opening a note
  if (noteToDelete.value !== null) {
    noteToDelete.value = null;
  }
  await notesStore.openTab(noteId); // This opens the tab and sets activeNote
}

// Handle note selection from search modal
async function handleSearchNoteSelected(note: Note, searchQuery?: string) {
  isLoadingNoteFromSearch.value = true;
  noteJustSelectedFromSearch.value = true;
  
  // Store the search query for highlighting
  searchQueryForHighlight.value = searchQuery || null;
  
  try {
    // Get the folder for this note
    if (note.folder_id) {
      const folder = foldersStore.getFolderById(note.folder_id);
      
      if (folder) {
        const spaceId = folder.space_id;
        
        // Expand the space (notebook) if not already expanded
        if (!expandedSpaceIds.value.has(spaceId)) {
          expandedSpaceIds.value.add(spaceId);
        }
        
        // Set as current space
        spacesStore.setCurrentSpace(spaceId);
        
        // Ensure folders are loaded for this space
        await foldersStore.fetchFolders(spaceId, true);
        
        // Select the folder (section)
        selectedFolderId.value = folder.id;
        
        // Wait a bit for UI to update
        await nextTick();
        
        // Open the note
        await handleOpenNote(note.id);
      } else {
        // Folder not found, try to fetch it
        await foldersStore.fetchFolders(null, true);
        const folder = foldersStore.getFolderById(note.folder_id);
        if (folder) {
          const spaceId = folder.space_id;
          if (!expandedSpaceIds.value.has(spaceId)) {
            expandedSpaceIds.value.add(spaceId);
          }
          spacesStore.setCurrentSpace(spaceId);
          selectedFolderId.value = folder.id;
          await nextTick();
          await handleOpenNote(note.id);
        } else {
          // Fallback: just open the note
          await handleOpenNote(note.id);
        }
      }
    } else {
      // Note has no folder, just open it
      await handleOpenNote(note.id);
    }
  } catch (error) {
    console.error('Failed to navigate to note from search:', error);
    toast.error('Failed to open note');
  } finally {
    isLoadingNoteFromSearch.value = false;
    // Reset flag after a short delay to allow UI updates
    setTimeout(() => {
      noteJustSelectedFromSearch.value = false;
      // Clear search query after scrolling has happened (give it time to scroll)
      setTimeout(() => {
        searchQueryForHighlight.value = null;
      }, 2000); // Clear after 2 seconds to allow scrolling to complete
    }, 500);
  }
}

// Delete note handlers
function handleDeleteClick(noteId: string, event: MouseEvent) {
  event.stopPropagation(); // Prevent note selection
  if (noteToDelete.value === noteId) {
    // Already in confirmation mode, delete the note
    handleConfirmDelete(noteId);
  } else {
    // Switch to confirmation mode
    noteToDelete.value = noteId;
  }
}

async function handleConfirmDelete(noteId: string) {
  try {
    await notesStore.deleteNote(noteId);
    toast.success('Note deleted');
    noteToDelete.value = null;
    
    // If the deleted note was active, close it
    if (activeNote.value?.id === noteId) {
      // The store already handles this, but we can ensure it's closed
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

// ... (Keep creation actions: handleCreateNote, etc.)
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

function openCreateFolderModal(spaceId?: number) {
  newFolderName.value = '';
  targetSpaceIdForFolderCreation.value = spaceId;
  showCreateFolderModal.value = true;
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim() || isCreatingFolder.value) return;
  
  isCreatingFolder.value = true;
  try {
    await foldersStore.createFolder({
      name: newFolderName.value.trim(),
      space_id: targetSpaceIdForFolderCreation.value || spacesStore.currentSpaceId || undefined
    });
    showCreateFolderModal.value = false;
    toast.success('Folder created');
  } catch (error) {
    toast.error('Failed to create folder');
  } finally {
    isCreatingFolder.value = false;
  }
}

// Auto-save title
let titleSaveTimeout: NodeJS.Timeout | null = null;
function handleTitleChange() {
  if (!activeNote.value) return;
  
  if (titleSaveTimeout) clearTimeout(titleSaveTimeout);
  
  titleSaveTimeout = setTimeout(async () => {
    if (!activeNote.value) return;
    try {
      await notesStore.updateNote(activeNote.value.id, {
        title: activeNote.value.title
      });
    } catch (error) {
      console.error('Failed to save title:', error);
    }
  }, 1000);
}

// Auto-save content
let contentSaveTimeout: NodeJS.Timeout | null = null;
function handleContentChange(newContent: string) {
  if (!activeNote.value) return;
  
  // Update local state immediately
  activeNote.value.content = newContent;
  
  if (contentSaveTimeout) clearTimeout(contentSaveTimeout);
  
  contentSaveTimeout = setTimeout(async () => {
    if (!activeNote.value) return;
    try {
      await notesStore.updateNote(activeNote.value.id, {
        content: activeNote.value.content
      });
    } catch (error) {
      console.error('Failed to save content:', error);
      toast.error('Failed to save changes');
    }
  }, 2000); // Auto-save after 2 seconds
}

// Polish note with AI
const isPolishing = ref(false);
async function polishNote() {
  if (!activeNote.value) return;
  
  if (!activeNote.value.title?.trim() && !activeNote.value.content?.trim()) {
    toast.error('Add some content to your note first');
    return;
  }

  isPolishing.value = true;

  try {
    const authStore = useAuthStore();
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
        title: activeNote.value.title || 'Untitled Note',
        content: activeNote.value.content || ''
      }
    });

    // Update the note with the polished content
    if (activeNote.value) {
      activeNote.value.title = response.title;
      activeNote.value.content = response.content;
      
      // Save the changes
      await notesStore.updateNote(activeNote.value.id, {
        title: response.title,
        content: response.content
      });
    }

    toast.success('Note polished! ✨');
  } catch (error: any) {
    console.error('Polish error:', error);
    toast.error(error.data?.message || 'Failed to polish note with AI');
  } finally {
    isPolishing.value = false;
  }
}

// Logout handler
async function handleLogout() {
  try {
    await authStore.logout();
  } catch (error) {
    console.error('Error logging out:', error);
    toast.error('Failed to log out');
  }
}

// ... (Keep other necessary handlers)

// Folder menu (for mobile)
const folderMenuOpen = ref<number | null>(null);
const folderMenuPos = ref({ top: 0, left: 0, width: 0 });

function handleOpenFolderMenu(folderId: number, event: MouseEvent) {
  folderMenuOpen.value = folderId;
  // Calculate position (simplified)
  folderMenuPos.value = { top: event.clientY, left: event.clientX, width: 200 };
}

function handleCloseFolderMenu() {
  folderMenuOpen.value = null;
}

// Helper to restore selected folder and active note on refresh
const restoreState = () => {
  if (!isMounted.value) return;
  
  // Try to find the active note
  const activeNoteId = notesStore.activeTabId;
  if (activeNoteId) {
    const note = notesStore.notes.find(n => n.id === activeNoteId);
    if (note && note.folder_id) {
      // Restore selected folder
      selectedFolderId.value = note.folder_id;
      
      // Expand the space containing this folder
      const folder = foldersStore.getFolderById(note.folder_id);
      if (folder && folder.space_id) {
        expandedSpaceIds.value.add(folder.space_id);
        spacesStore.setCurrentSpace(folder.space_id);
      }
    }
  }
}

// Close space context menu when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (showSpaceContextMenu.value === null) return;
    
    const target = event.target as HTMLElement;
    
    // Don't close if clicking the button itself
    const buttonRefs = Array.from(spaceContextMenuRefs.value.values()).filter(Boolean);
    if (buttonRefs.some(ref => ref && ref.contains(target))) {
      return;
    }
    
    // Don't close if clicking inside the menu
    const menu = target.closest('[data-space-context-menu]');
    if (menu) {
      return;
    }
    
    // Don't close if clicking on a button
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    
    // Close if clicking anywhere else
    showSpaceContextMenu.value = null;
  };
  
  watch(() => showSpaceContextMenu.value, (shouldListen) => {
    if (shouldListen) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
});

// Keyboard shortcut handler for search
function handleGlobalKeydown(event: KeyboardEvent) {
  // Ctrl+P or Cmd+P to open search
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault();
    showSearchModal.value = true;
  }
}

onMounted(async () => {
  isMounted.value = true;
  await loadData();
  await notesStore.loadTabsFromStorage(); // Ensure tabs are loaded
  
  // Restore state after data is loaded
  restoreState();
  
  // Load note order as well
  await notesStore.loadNoteOrder();
  nextTick(() => {
    initSortables();
    initNoteSortable();
  });
  
  // Add keyboard shortcut listener
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  if (titleSaveTimeout) clearTimeout(titleSaveTimeout);
  if (contentSaveTimeout) clearTimeout(contentSaveTimeout);
  window.removeEventListener('keydown', handleGlobalKeydown);
});

// Focus mode (hide sidebars for distraction-free editing)
function toggleFocusMode() {
  isFullscreen.value = !isFullscreen.value;
  
  // Hide/show sidebars based on focus mode
  if (isFullscreen.value) {
    isDesktopSidebarVisible.value = false;
  } else {
    isDesktopSidebarVisible.value = true;
  }
}

// Resize handlers
function handleSidebarResizeStart(e: MouseEvent) {
  e.preventDefault();
  isResizing.value = true;
  
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;
  
  function handleMouseMove(e: MouseEvent) {
    const diff = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(500, startWidth + diff));
    sidebarWidth.value = newWidth;
  }
  
  function handleMouseUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function handleNoteListResizeStart(e: MouseEvent) {
  e.preventDefault();
  isResizingNoteList.value = true;
  
  const startX = e.clientX;
  const startWidth = noteListWidth.value;
  
  function handleMouseMove(e: MouseEvent) {
    const diff = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(500, startWidth + diff));
    noteListWidth.value = newWidth;
  }
  
  function handleMouseUp() {
    isResizingNoteList.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

</script>

<template>
  <div class="flex h-screen w-full bg-white dark:bg-gray-900 overflow-hidden">
    
    <!-- Column 1: Notebooks & Sections (Sidebar) -->
    <aside 
      v-if="isDesktopSidebarVisible && !isFullscreen"
      class="hidden md:flex flex-col bg-gray-50/80 dark:bg-gray-900/80 border-r border-gray-200/60 dark:border-gray-800/60 flex-shrink-0 relative overflow-x-hidden"
      :style="{ width: `${sidebarWidth}px` }"
    >
      <!-- Resize Handle -->
      <div
        @mousedown="handleSidebarResizeStart"
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 z-10"
      />

      <!-- Header -->
      <div class="h-14 flex items-center justify-between px-4 border-b border-gray-200/50 dark:border-gray-800/50">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-lg">Notebooks</span>
          <button 
            @click="showSearchModal = true"
            class="p-1 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 transition-colors"
            title="Search Notes"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
          </button>
        </div>
        <button 
          @click="openCreateSpaceModal"
          class="p-1 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 transition-colors"
          title="New Notebook"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
        </button>
      </div>

      <!-- Notebooks List -->
      <div ref="spacesListRef" class="notebooks-scroll flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-3">
        <div 
          v-for="space in spacesStore.spaces" 
          :key="space.id" 
          class="space-y-1 space-item"
          :data-space-id="space.id"
        >
            <!-- Notebook Header -->
          <div v-if="editingSpaceId === space.id" class="flex-1 px-2 py-1.5">
            <input
              ref="spaceRenameInputRef"
              v-model="editingSpaceName"
              type="text"
              class="w-full px-2 py-0.5 text-sm font-medium bg-white dark:bg-gray-800 border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              @blur="saveSpaceRename"
              @keydown.enter="saveSpaceRename"
              @keydown.esc="cancelSpaceRename"
              @click.stop
            />
          </div>
          <div 
            v-else
            class="space-item-header group/space relative flex items-center gap-1 rounded-xl transition-all duration-200 md:hover:bg-gray-50/80 md:dark:hover:bg-gray-800/50 active:bg-gray-100/80 dark:active:bg-gray-700/50 overflow-hidden min-w-0"
            :class="{ 'bg-gray-200/50 dark:bg-gray-800/50': expandedSpaceIds.has(space.id) }"
          >
            <button 
              @click="handleSelectSpace(space.id)"
              @dblclick="startSpaceRename(space)"
              @dragenter="handleSpaceDragOver(space.id)"
              class="space-button flex-1 flex items-center gap-1 px-1 py-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors text-left min-w-0"
            >
              <UIcon 
                :name="expandedSpaceIds.has(space.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
                class="w-4 h-4 text-gray-400 flex-shrink-0"
              />
              <UIcon 
                :name="space.icon ? `i-lucide-${space.icon}` : 'i-heroicons-book-open'" 
                class="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" 
              />
              <span class="font-medium text-sm truncate flex-1">{{ space.name }}</span>
            </button>
            
            <!-- Context Menu Button -->
            <button
              :ref="(el) => setSpaceContextMenuRef(el, space.id)"
              type="button"
              @click.stop="toggleSpaceContextMenu($event, space.id)"
              @mousedown.stop
              class="no-drag flex-shrink-0 p-1.5 rounded-lg opacity-100 md:opacity-0 md:group-hover/space:opacity-100 md:hover:bg-gray-200/80 md:dark:hover:bg-gray-700/80 active:bg-gray-200/80 dark:active:bg-gray-700/80 transition-all duration-200"
              :class="showSpaceContextMenu === space.id ? 'bg-gray-200/80 dark:bg-gray-700/80' : ''"
            >
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
                <circle cx="8" cy="2" r="1.5"/>
                <circle cx="8" cy="8" r="1.5"/>
                <circle cx="8" cy="14" r="1.5"/>
              </svg>
            </button>
          </div>
          
          <!-- Space Context Menu -->
          <ClientOnly>
            <Teleport to="body">
              <Transition
                enter-active-class="transition-all duration-150 ease"
                enter-from-class="opacity-0 scale-0.95 translate-y-(-4px)"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition-all duration-150 ease"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-0.95 translate-y-(-4px)"
              >
                <div
                  v-if="showSpaceContextMenu === space.id"
                  data-space-context-menu
                  @click.stop
                  class="fixed w-48 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-2xl py-1.5 z-[9999]"
                  :style="getSpaceMenuStyle(space.id)"
                >
                  <button
                    type="button"
                    @click="handleDeleteSpace(space.id)"
                    class="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 md:hover:bg-red-50 md:dark:hover:bg-red-900/20 active:bg-red-50 dark:active:bg-red-900/20 flex items-center gap-3"
                  >
                    <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                    <span>Delete</span>
                  </button>
                </div>
              </Transition>
              <!-- Backdrop for mobile -->
              <div
                v-if="showSpaceContextMenu === space.id && isMobileView"
                class="fixed inset-0 z-[9998] md:hidden"
                @click="showSpaceContextMenu = null"
              />
            </Teleport>
          </ClientOnly>

          <!-- Sections (Folders) - Only visible if space is active -->
          <div v-show="expandedSpaceIds.has(space.id)">
            <div 
              class="pl-6 space-y-0.5 min-h-[5px]"
              :ref="(el) => setFolderListRef(el, space.id)"
            >
              <FolderTreeItem
                v-for="folder in getSpaceFolders(space.id)"
                :key="folder.id"
                :folder="folder"
                :selected-id="selectedFolderId"
                @select="handleSelectFolder"
                @create-note="handleCreateNoteInFolder"
                @delete="(id) => foldersStore.deleteFolder(id)"
                @rename="(id) => console.log('Rename folder', id)"
              />
            </div>
            
            <!-- New Section Button -->
            <div class="pl-6 mt-1">
              <div class="relative flex items-center gap-2 rounded-xl transition-all duration-200 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 cursor-pointer group" @click="openCreateFolderModal(space.id)">
                <div class="w-4" /> <!-- Spacer to align with sections -->
                <div class="flex-1 flex items-center gap-2.5 py-2.5 pr-2 text-sm text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                  <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                  <span class="font-medium">New Section</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- User Footer -->
      <div class="p-4 border-t border-gray-200/50 dark:border-gray-800/50">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
            {{ authStore.currentUser?.name?.[0] || 'U' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ authStore.currentUser?.name }}</div>
          </div>
          <div class="flex items-center gap-1">
            <NuxtLink
              to="/settings"
              class="p-1.5 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Settings"
            >
              <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5" />
            </NuxtLink>
            <button
              @click="handleLogout"
              class="p-1.5 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Sign Out"
            >
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Column 2: Note List (Middle) -->
    <aside 
      v-if="!isFullscreen"
      class="hidden md:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200/60 dark:border-gray-800/60 flex-shrink-0 relative"
      :style="{ width: `${noteListWidth}px` }"
    >
      <!-- Resize Handle -->
      <div
        @mousedown="handleNoteListResizeStart"
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 z-10"
      />

      <!-- Header -->
      <div class="h-14 flex items-center justify-between px-4 border-b border-gray-200/50 dark:border-gray-800/50">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="font-semibold text-lg truncate">
            {{ selectedFolderId ? foldersStore.getFolderById(selectedFolderId)?.name : 'Select Section' }}
          </span>
          <UIcon 
            v-if="notesStore.isSyncing" 
            name="i-heroicons-arrow-path" 
            class="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" 
            title="Syncing..."
          />
        </div>
        <button 
          v-if="selectedFolderId"
          @click="handleCreateNoteInFolder(selectedFolderId)"
          class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-600 flex-shrink-0"
          title="New Page"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
        </button>
      </div>

      <!-- Note List -->
      <div class="notes-scroll flex-1 overflow-y-auto">
        <!-- Initial Loading State only -->
        <div v-if="notesStore.loading && displayNotes.length === 0" class="p-8 text-center text-gray-500">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto animate-spin mb-2" />
          Loading pages...
        </div>
        <div v-else-if="!selectedFolderId" class="p-8 text-center text-gray-500">
          Select a section to view pages
        </div>
        <div v-else-if="displayNotes.length === 0" class="p-8 text-center text-gray-500">
          No pages in this section
        </div>
        <div
          v-else
          class="divide-y divide-gray-100 dark:divide-gray-800"
          ref="noteListRef"
        >
          <div 
            v-for="(note, index) in displayNotes" 
            :key="note.id"
            :data-note-id="note.id"
            :style="{ '--index': index, '--total-count': displayNotes.length }"
            @click="handleOpenNote(note.id)"
            class="note-item group p-3 cursor-pointer transition-colors relative"
            :class="{ 
              'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500': activeNote?.id === note.id,
              'hover:bg-gray-50 dark:hover:bg-gray-800': activeNote?.id !== note.id
            }"
          >
            <div class="font-medium text-sm mb-1 truncate select-none pr-8">{{ note.title || 'Untitled Page' }}</div>
            <div v-if="note.content" class="text-xs text-gray-500 select-none note-preview" v-html="getNotePreview(note.content)"></div>
            <!-- Delete Button -->
            <button
              @click.stop="handleDeleteClick(note.id, $event)"
              class="absolute top-3 right-3 p-1 rounded-md transition-colors"
              :class="noteToDelete === note.id 
                ? 'opacity-100 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
                : 'opacity-30 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
              :title="noteToDelete === note.id ? 'Click to confirm delete' : 'Delete note'"
            >
              <UIcon 
                :name="noteToDelete === note.id ? 'i-heroicons-trash' : 'i-heroicons-x-mark'" 
                class="w-4 h-4" 
              />
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Column 3: Editor (Main) -->
    <main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative">
      <div v-if="!activeNote" class="flex-1 flex items-center justify-center text-gray-400">
        <div class="text-center">
          <UIcon name="i-heroicons-pencil-square" class="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select a page to start editing</p>
        </div>
      </div>
      
      <template v-else>
        <!-- Editor Title Area -->
        <div class="px-8 pt-6 pb-2 relative">
          <!-- Focus Mode Button -->
          <button
            @click="toggleFocusMode"
            class="absolute top-6 right-8 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors z-10"
            :title="isFullscreen ? 'Show Sidebars' : 'Hide Sidebars'"
          >
            <UIcon 
              :name="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'" 
              class="w-5 h-5" 
            />
          </button>
          
          <input
            v-model="activeNote.title"
            class="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-600 py-3 leading-normal pr-12"
            placeholder="Page Title"
            @input="handleTitleChange"
          />
          <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <ClientOnly>
              <div class="flex items-center gap-2">
                <template v-if="activeNote">
                  <!-- Saved indicator -->
                  <div v-if="notesStore.loading" class="flex items-center gap-1.5 text-gray-400">
                    <UIcon name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </div>
                  <div v-else class="flex items-center gap-1.5 text-green-600 dark:text-green-400 transition-all duration-300">
                    <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </div>
                  <span class="text-gray-300 dark:text-gray-600 mx-1">|</span>
                  <span>{{ formatHeaderDate(activeNote.updated_at) }}</span>
                </template>
              </div>
            </ClientOnly>
          </div>
        </div>

        <!-- Unified Editor -->
        <div class="flex-1 overflow-hidden relative">
          <UnifiedEditor
            :key="activeNote.id"
            :model-value="activeNote.content"
            @update:model-value="handleContentChange"
            :note-id="activeNote.id"
            :editable="true"
            :initial-content="activeNote.content"
            :is-polishing="isPolishing"
            :search-query="searchQueryForHighlight"
            @request-polish="polishNote"
          />
        </div>
      </template>
    </main>

    <!-- Keep Mobile Navigation (MobileBottomNav) -->
    <MobileBottomNav 
      @open-spaces="showMobileSpacesSheet = true"
      @open-folders="showMobileFoldersSheet = true"
      @open-create="openCreateFolderModal" 
    />
    
    <!-- Create Folder Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div 
            v-if="showCreateFolderModal" 
            class="fixed inset-0 z-50 overflow-y-auto"
            @click.self="showCreateFolderModal = false"
          >
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            
            <!-- Modal -->
            <div class="flex min-h-full items-center justify-center p-4">
              <Transition
                enter-active-class="transition-all duration-200"
                enter-from-class="opacity-0 scale-95 translate-y-4"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition-all duration-200"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 translate-y-4"
              >
                <div 
                  class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
                  @click.stop
                >
                  <h3 class="text-lg font-semibold mb-4">Create New Section</h3>
                  <UInput
                    v-model="newFolderName"
                    placeholder="Section Name"
                    class="mb-4"
                    size="xl"
                    :ui="{ padding: { xl: 'px-4 py-3' } }"
                    autofocus
                    @keyup.enter="handleCreateFolder"
                  />
                  <div class="grid grid-cols-2 gap-3 pt-4">
                    <UButton
                      color="neutral"
                      variant="soft"
                      block
                      size="md"
                      @click="showCreateFolderModal = false"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      color="primary"
                      block
                      size="md"
                      :loading="isCreatingFolder"
                      @click="handleCreateFolder"
                    >
                      Create
                    </UButton>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Space Modal -->
    <SpaceModal
      v-model:isOpen="showSpaceModal"
      :space="editingSpace"
      @created="spacesStore.fetchSpaces"
      @updated="spacesStore.fetchSpaces"
    />

    <!-- Search Modal -->
    <SearchModal 
      v-model="showSearchModal" 
      @selected="(note, isLoading, query) => handleSearchNoteSelected(note, query)"
      @loading-start="isLoadingNoteFromSearch = true"
    />

    <!-- Delete Space Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div 
            v-if="showDeleteSpaceModal" 
            class="fixed inset-0 z-[60] overflow-y-auto"
            @click.self="cancelDeleteSpace"
          >
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/60 transition-opacity"></div>
            
            <!-- Modal -->
            <div class="flex min-h-full items-center justify-center p-4">
              <Transition
                enter-active-class="transition-all duration-200"
                enter-from-class="opacity-0 scale-95 translate-y-4"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition-all duration-200"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 translate-y-4"
              >
                <div 
                  v-if="showDeleteSpaceModal"
                  class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-red-200 dark:border-red-900"
                  @click.stop
                >
                  <!-- Header -->
                  <div class="flex items-center gap-3 mb-4">
                    <div class="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div class="flex-1">
                      <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                        Delete Space
                      </h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        This action cannot be undone
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="cancelDeleteSpace"
                      class="flex-shrink-0 text-gray-400 md:hover:text-gray-500 md:dark:hover:text-gray-300 active:text-gray-500 dark:active:text-gray-300 transition-colors"
                      :disabled="isDeletingSpace"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                    </button>
                  </div>
                  
                  <!-- Warning Content -->
                  <div class="mb-6">
                    <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                      <p class="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                        ⚠️ Warning: Permanent Data Loss
                      </p>
                      <ul class="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                        <li>All <strong>folders</strong> in this space will be permanently deleted</li>
                        <li>All <strong>notes</strong> in those folders will be permanently deleted</li>
                        <li>Any shared notes from this space will be removed</li>
                        <li>This action cannot be undone</li>
                      </ul>
                    </div>
                    
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                      Are you absolutely sure you want to delete <strong class="text-gray-900 dark:text-white">"{{ spacesStore.spaces.find(s => s.id === deletingSpaceId)?.name }}"</strong>?
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-3">
                    <UButton
                      color="neutral"
                      variant="soft"
                      block
                      @click="cancelDeleteSpace"
                      :disabled="isDeletingSpace"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      color="error"
                      block
                      @click="confirmDeleteSpace"
                      :loading="isDeletingSpace"
                      :disabled="isDeletingSpace"
                    >
                      <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-2" />
                      Delete Forever
                    </UButton>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

  </div>
</template>

<style scoped>
.note-preview {
  max-height: calc(1.2em * 5.5); /* Slightly more than 5 lines to avoid cutting mid-line */
  line-height: 1.2em;
  overflow: hidden;
  word-break: break-word;
  display: block;
  position: relative;
  mask-image: linear-gradient(to bottom, black calc(100% - 1.2em), transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 1.2em), transparent 100%);
}

.note-preview :deep(p) {
  margin: 0.2em 0;
  display: block;
}

.note-preview :deep(br) {
  display: block;
  content: "";
  margin-top: 0.2em;
}

/* Elegant thin scrollbars for notebooks and notes lists */
.notebooks-scroll::-webkit-scrollbar,
.notes-scroll::-webkit-scrollbar {
  width: 2px;
  height: 2px;
}

.notebooks-scroll::-webkit-scrollbar-track,
.notes-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.notebooks-scroll::-webkit-scrollbar-thumb,
.notes-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.notebooks-scroll::-webkit-scrollbar-thumb:hover,
.notes-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.22);
  width: 3px;
}

.notebooks-scroll::-webkit-scrollbar-thumb:active,
.notes-scroll::-webkit-scrollbar-thumb:active {
  background: rgba(0, 0, 0, 0.3);
}

/* Dark mode scrollbars */
.dark .notebooks-scroll::-webkit-scrollbar-thumb,
.dark .notes-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
}

.dark .notebooks-scroll::-webkit-scrollbar-thumb:hover,
.dark .notes-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.22);
}

.dark .notebooks-scroll::-webkit-scrollbar-thumb:active,
.dark .notes-scroll::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.3);
}

/* Firefox scrollbar styling */
.notebooks-scroll,
.notes-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
}

.dark .notebooks-scroll,
.dark .notes-scroll {
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}
</style>


