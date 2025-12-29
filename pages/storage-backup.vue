<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onActivated, nextTick, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useNotesStore } from '~/stores/notes';
import { useFoldersStore } from '~/stores/folders';
import { useSpacesStore } from '~/stores/spaces';
import { useSharedNotesStore } from '~/stores/sharedNotes';
import { useToast } from '~/composables/useToast';
import { useNoteNavigation } from '~/composables/useNoteNavigation';
import type { Note, Space } from '~/models';
import Sortable from 'sortablejs';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();
const sharedNotesStore = useSharedNotesStore();
const toast = useToast();
const { navigateToNote } = useNoteNavigation();

// Initial loading state
const isMounted = ref(false);
const hasInitialized = ref(false); // Track if data has been loaded
const isLoadingNoteFromSearch = ref(false);
const noteJustSelectedFromSearch = ref(false);
const searchQueryForHighlight = ref<string | null>(null);

// Selection State
const selectedFolderId = ref<number | null>(null);
const previousFolderId = ref<number | null>(null); // Track previous folder for animation direction
const noteToDelete = ref<string | null>(null); // Track which note is in delete confirmation mode

// Modal states
const showMobileSpacesSheet = ref(false);
const showMobileFoldersSheet = ref(false);
const showCreateFolderModal = ref(false); // Restored modal state
const showSearchModal = ref(false);

// View state - 'notebooks' or 'storage'
const currentView = ref<'notebooks' | 'storage'>('notebooks');
const showViewDropdown = ref(false);

// Check for view query parameter on mount
watch(() => route.query.view, (view) => {
  if (view === 'notebooks') {
    router.replace('/notes');
  } else {
    currentView.value = 'storage';
  }
}, { immediate: true });

// Provide view switching function for FileStorage component
function switchToNotebooks() {
  router.push('/dashboard');
}

function switchToStorage() {
  // Already on storage
}

provide('switchView', { switchToNotebooks, switchToStorage });

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
  return window.innerWidth < 1024;
});

// Space Delete Confirmation
const showDeleteSpaceModal = ref(false);
const deletingSpaceId = ref<number | null>(null);
const isDeletingSpace = ref(false);

function startSpaceRename(space: Notebook) {
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

function toggleSpaceContextMenu(event: MouseEvent, notebookId: number) {
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
  
  console.log('Setting menu position:', { top, left, notebookId });
  
  // Create new Map to ensure reactivity
  const newPositions = new Map(spaceMenuPositions.value);
  newPositions.set(notebookId, { top, left, bottom: 0 });
  spaceMenuPositions.value = newPositions;
  
  const newOpensUpward = new Map(spaceMenuOpensUpward.value);
  newOpensUpward.set(notebookId, false);
  spaceMenuOpensUpward.value = newOpensUpward;
  
  // Toggle menu visibility after position is set
  if (showSpaceContextMenu.value === notebookId) {
    showSpaceContextMenu.value = null;
  } else {
    showSpaceContextMenu.value = notebookId;
  }
}

function handleDeleteSpace(notebookId: number) {
  // Check if this is the last space
  if (spacesStore.spaces.length <= 1) {
    toast.error('Cannot delete the last remaining space');
    showSpaceContextMenu.value = null;
    return;
  }
  
  deletingSpaceId.value = notebookId;
  showDeleteSpaceModal.value = true;
  showSpaceContextMenu.value = null;
}

async function confirmDeleteSpace() {
  if (deletingSpaceId.value === null) return;
  
  isDeletingSpace.value = true;
  
  try {
    const notebookIdToDelete = deletingSpaceId.value;

    // Get all folders in the space to be deleted
    const foldersInSpace = foldersStore.folders.filter(f => f.notebook_id === notebookIdToDelete);
    const sectionIdsInSpace = foldersInSpace.map(f => f.id);

    // Get all notes that are in these folders or directly in the space (if root notes are allowed)
    const notesInSpace = notesStore.notes.filter(n => 
      (n.section_id && sectionIdsInSpace.includes(n.section_id)) || 
      (n.notebook_id === notebookIdToDelete && !n.section_id) // Assuming notes can directly belong to a space
    );

    // Check if the active note is in this space and clear it
    const isActiveNoteInSpace = activeNote.value && notesInSpace.some(n => n.id === activeNote.value?.id);
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
      foldersStore.fetchFolders(null), // Fetch all folders to ensure UI is consistent
      notesStore.fetchNotes() // Refresh all notes
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

// Drag and Drop State
const folderListRefs = ref(new Map<number, HTMLElement>());
const spacesListRef = ref<HTMLElement | null>(null);
const sortableInstances = ref<Sortable[]>([]);
const noteListRef = ref<HTMLElement | null>(null);
const noteSortableInstance = ref<Sortable | null>(null);
const isDraggingSpace = ref(false);

// Scroll detection for notebooks
const canScrollDown = ref(false);
let resizeObserver: ResizeObserver | null = null;

function checkScrollPosition() {
  if (!spacesListRef.value) {
    canScrollDown.value = false;
    return;
  }
  
  const element = spacesListRef.value;
  const isScrollable = element.scrollHeight > element.clientHeight;
  const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 1; // 1px threshold
  
  canScrollDown.value = isScrollable && !isAtBottom;
}

function handleNotebooksScroll() {
  checkScrollPosition();
}

function setupScrollDetection() {
  if (!spacesListRef.value || !process.client) return;
  
  // Add scroll listener
  spacesListRef.value.addEventListener('scroll', handleNotebooksScroll);
  
  // Set up ResizeObserver to check when container size changes
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      checkScrollPosition();
    });
    resizeObserver.observe(spacesListRef.value);
  }
  
  // Initial check
  checkScrollPosition();
}

function cleanupScrollDetection() {
  if (spacesListRef.value) {
    spacesListRef.value.removeEventListener('scroll', handleNotebooksScroll);
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

// Mobile bottom sheet state (Spaces / Folder notes)
const sheetTranslateY = ref(0);
const isDraggingSheet = ref(false);
let sheetDragStartY = 0;
const sheetView = ref<'spaces' | 'folder'>('spaces');

const sheetFolderTitle = computed(() => {
  if (!sheetFolderId.value) return 'Section';
  return foldersStore.getFolderById(sheetFolderId.value)?.name || 'Section';
});

function resetSheetPosition() {
  sheetTranslateY.value = 0;
}

function handleSheetDragMove(clientY: number) {
  if (!isDraggingSheet.value) return;
  const delta = clientY - sheetDragStartY;
  sheetTranslateY.value = delta > 0 ? delta : 0;
}

function closeMobileSpacesSheet() {
  showMobileSpacesSheet.value = false;
  sheetView.value = 'spaces';
  sheetTranslateY.value = 0;
  // On mobile, closing the sheet should bring you back to Home (no folder selected)
  selectedFolderId.value = null;
}

function finishSheetDrag() {
  if (!isDraggingSheet.value) return;
  const shouldClose = sheetTranslateY.value > 80;
  isDraggingSheet.value = false;

  if (shouldClose) {
    closeMobileSpacesSheet();
  } else {
    // Snap back up
    sheetTranslateY.value = 0;
  }
}

function handleSheetHandleTouchStart(event: TouchEvent) {
  if (!isMobileView.value) return;
  if (event.touches.length !== 1) return;
  isDraggingSheet.value = true;
  sheetDragStartY = event.touches[0].clientY;
}

function handleSheetHandleTouchMove(event: TouchEvent) {
  if (!isDraggingSheet.value) return;
  if (event.touches.length !== 1) return;
  handleSheetDragMove(event.touches[0].clientY);
}

function handleSheetHandleTouchEnd() {
  finishSheetDrag();
}

function handleSheetHandleMouseDown(event: MouseEvent) {
  if (!isMobileView.value) return;
  isDraggingSheet.value = true;
  sheetDragStartY = event.clientY;

  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingSheet.value) return;
    handleSheetDragMove(e.clientY);
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    finishSheetDrag();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function openFolderInSheet(folder: any) {
  sheetFolderId.value = folder.id;
  sheetView.value = 'folder';
}

// Open Spaces sheet automatically when coming from other pages with ?openSpaces=1
watch(
  () => route.query.openSpaces,
  (open) => {
    if (open && isMobileView.value) {
      showMobileSpacesSheet.value = true;
      sheetView.value = 'spaces';
      // Clean up query param so it doesn't re-trigger
      const newQuery = { ...route.query } as Record<string, any>;
      delete newQuery.openSpaces;
      router.replace({ path: route.path, query: newQuery });
    }
  },
  { immediate: true }
);

// Animate sheet on open (slide up) on mobile and ensure Home behind
watch(showMobileSpacesSheet, (open) => {
  if (open && isMobileView.value) {
    // Make sure the main view behind is Home (no folder selected, no note open)
    if (activeNote.value) {
      notesStore.closeTab(activeNote.value.id);
    }
    selectedFolderId.value = null;

    // Start slightly below, then slide up
    sheetTranslateY.value = 120;
    nextTick(() => {
      requestAnimationFrame(() => {
        sheetTranslateY.value = 0;
      });
    });
  } else if (!open) {
    // Reset when closed
    sheetTranslateY.value = 0;
    sheetView.value = 'spaces';
    sheetFolderId.value = null;
  }
});

const setFolderListRef = (el: any, notebookId: number) => {
  if (el) {
    folderListRefs.value.set(notebookId, el as HTMLElement);
  } else {
    folderListRefs.value.delete(notebookId);
  }
};

const setSpaceContextMenuRef = (el: any, notebookId: number) => {
  if (el) {
    spaceContextMenuRefs.value.set(notebookId, el as HTMLElement);
  } else {
    spaceContextMenuRefs.value.delete(notebookId);
  }
};

function getSpaceMenuStyle(notebookId: number) {
  const position = spaceMenuPositions.value.get(notebookId);
  const opensUpward = spaceMenuOpensUpward.value.get(notebookId);
  
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
      delay: 75, // Delay before drag starts (prevents accidental drags on click)
      delayOnTouchOnly: false, // Apply delay to both touch and mouse
      distance: 10, // Require 10px movement before drag starts (prevents accidental drags)
      onEnd: (evt) => {
        const { newIndex, oldIndex, item } = evt;
        const pageId = item.dataset.pageId;
        
        if (pageId && newIndex !== undefined && oldIndex !== newIndex) {
           // Provide instant feedback handled by Sortable's animation
           notesStore.reorderNote(pageId, selectedFolderId.value, newIndex);
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
      delay: 75, // Delay before drag starts (prevents accidental drags on click)
      delayOnTouchOnly: false, // Apply delay to both touch and mouse
      distance: 10, // Require 10px movement before drag starts (prevents accidental drags)
      onStart: () => {
        isDraggingSpace.value = true;
      },
      onEnd: (evt) => {
        isDraggingSpace.value = false;
        const { newIndex, oldIndex, item } = evt;
        const notebookId = Number(item.dataset.notebookId);
        
        if (notebookId && newIndex !== undefined && oldIndex !== newIndex) {
          spacesStore.reorderSpace(notebookId, newIndex);
        }
      }
    });
    sortableInstances.value.push(instance);
  }

  folderListRefs.value.forEach((el, notebookId) => {
    const instance = new Sortable(el, {
      group: 'folders',
      animation: 150,
      draggable: '.folder-item',
      delay: 75, // Delay before drag starts (prevents accidental drags on click)
      delayOnTouchOnly: false, // Apply delay to both touch and mouse
      distance: 10, // Require 10px movement before drag starts (prevents accidental drags)
      onEnd: (evt) => {
        // Reorder in same list
        if (evt.to === evt.from) {
           const itemEl = evt.item;
           const sectionId = Number(itemEl.dataset.sectionId);
           const newIndex = evt.newIndex;
           
           if (sectionId && newIndex !== undefined && evt.oldIndex !== newIndex) {
               foldersStore.reorderFolder(sectionId, newIndex);
           }
        }
      },
      onAdd: (evt) => {
        // Moved to another list
        const itemEl = evt.item;
        const sectionId = Number(itemEl.dataset.sectionId);
        const targetSpaceId = notebookId; // Closure captures notebookId
        const newIndex = evt.newIndex;
        
        // Remove the element Sortable added to prevent duplication with Vue's rendering
        // Vue will re-render the item in the new list once the store updates
        itemEl.remove();

        if (sectionId && newIndex !== undefined) {
            // Move and then reorder
            foldersStore.moveFolder(sectionId, targetSpaceId)
                .then(() => foldersStore.reorderFolder(sectionId, newIndex))
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
      checkScrollPosition(); // Recheck scroll position when spaces change
    });
  }
});

// Watch for spacesListRef to become available and set up scroll detection
watch(spacesListRef, (newRef, oldRef) => {
  if (oldRef) {
    cleanupScrollDetection();
  }
  if (newRef) {
    setupScrollDetection();
  }
}, { immediate: true });

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
function handleSpaceDragOver(notebookId: number) {
  // Don't expand if reordering spaces
  if (isDraggingSpace.value) return;
  
  if (!spacesStore.expandedSpaceIds.has(notebookId)) {
    spacesStore.expandSpace(notebookId);
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
      foldersStore.fetchFolders(null)
    ]);
    hasInitialized.value = true;
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.error('Failed to load data');
  }
}

// Helper to get folders for a specific space
function getSpaceFolders(notebookId: number) {
  return foldersStore.folders.filter(f => f.notebook_id === notebookId);
}

// Helper to get note count for folder (for mobile view)
function getFolderNoteCount(sectionId: number) {
  return notesStore.notes.filter(n => n.section_id === sectionId && !n.share_permission).length;
}

// Helper to get ordered notes for a folder (shared between main view + sheet)
function getOrderedNotesForFolder(sectionId: number | null) {
  if (!sectionId) return [];

  const notesInFolder = notesStore.notes.filter(note => 
    note.section_id === sectionId && !note.share_permission
  );

  const folderKey = `folder_${sectionId}`;
  const order = notesStore.noteOrder[folderKey];

  if (order && order.length > 0) {
    return notesInFolder.sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      if (indexA === -1 && indexB !== -1) return 1;
      if (indexA !== -1 && indexB === -1) return -1;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  return notesInFolder.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// Helper to get note location (space + folder) for mobile home view
interface NoteLocation {
  spaceName?: string;
  folderName?: string;
}

function getNoteLocation(note: Page): NoteLocation {
  if (!note.section_id) {
    return {};
  }

  const folder = foldersStore.getFolderById(note.section_id);
  if (!folder) {
    return {};
  }

  const space = spacesStore.spaces.find((s) => s.id === folder.notebook_id) || null;
  return {
    spaceName: space?.name,
    folderName: folder.name
  };
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
  if (newId !== null && !spacesStore.expandedSpaceIds.has(newId)) {
    spacesStore.expandSpace(newId);
  }
}, { immediate: true });

function openCreateSpaceModal() {
  editingSpace.value = null;
  showSpaceModal.value = true;
}

// Computed for displayNotes (filtered by selectedFolderId)
const displayNotes = computed(() => getOrderedNotesForFolder(selectedFolderId.value));
// Folder notes used inside the mobile sheet
const sheetFolderId = ref<number | null>(null);
const sheetDisplayNotes = computed(() => getOrderedNotesForFolder(sheetFolderId.value));

const activeNote = computed(() => notesStore.activeNote);

// Mobile Home view: cross-space recent notes
const regularNotesSortedByUpdated = computed(() => {
  return notesStore.notes
    .filter((note) => !note.share_permission)
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
});

const continueWritingNotes = computed(() => regularNotesSortedByUpdated.value.slice(0, 5));
const recentActivityNotes = computed(() => regularNotesSortedByUpdated.value.slice(5, 20));

// Note that belongs to displayed folders (for mobile list)
const displayedFolders = computed(() => {
  if (!spacesStore.currentSpaceId) return [];
  return getSpaceFolders(spacesStore.currentSpaceId);
});

const shouldShowEmptyState = computed(() => !activeNote.value);

// Actions
async function handleSelectSpace(notebookId: number) {
  spacesStore.toggleSpace(notebookId);
  if (spacesStore.expandedSpaceIds.has(notebookId)) {
    spacesStore.setCurrentSpace(notebookId);
  }
}

async function handleDeleteFolder(sectionId: number) {
  try {
    // If the deleted folder is the currently selected one, deselect it
    if (selectedFolderId.value === sectionId) {
      selectedFolderId.value = null;
    }

    // If the active note is in this folder, clear it
    if (activeNote.value && activeNote.value.section_id === sectionId) {
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

async function handleSelectFolder(sectionId: number) {
  // Track previous folder before switching
  previousFolderId.value = selectedFolderId.value;
  selectedFolderId.value = sectionId;
  
  // Automatically open the first note in the folder
  await nextTick(); // Wait for displayNotes to update
  const notes = getOrderedNotesForFolder(sectionId);
  if (notes.length > 0) {
    await handleOpenNote(notes[0].id);
  }
}

function handleFolderClick(folder: any) {
  handleSelectFolder(folder.id);
  showMobileFoldersSheet.value = false;
}

async function handleOpenNote(pageId: string) {
  // Reset delete confirmation when opening a note
  if (noteToDelete.value !== null) {
    noteToDelete.value = null;
  }
  await notesStore.openTab(pageId); // This opens the tab and sets activeNote
}

// Mobile: primary FAB action from bottom nav
async function handleMobileCreate() {
  try {
    // Prefer creating in the currently selected folder
    if (selectedFolderId.value !== null) {
      await handleCreateNoteInFolder(selectedFolderId.value);
      return;
    }

    // Fallback: use first folder of current space, or any folder
    const fallbackFolder =
      (spacesStore.currentSpaceId
        ? foldersStore.folders.find((f) => f.notebook_id === spacesStore.currentSpaceId)
        : null) || foldersStore.folders[0];

    if (fallbackFolder) {
      await handleCreateNoteInFolder(fallbackFolder.id);
    } else {
      toast.error('Create a notebook and section first to add a note');
      showMobileSpacesSheet.value = true;
    }
  } catch (error) {
    console.error('Failed to create note from mobile FAB:', error);
    toast.error('Failed to create note');
  }
}

// Handle note selection from search modal
async function handleSearchNoteSelected(note: Page | { id: string }, searchQuery?: string) {
  isLoadingNoteFromSearch.value = true;
  noteJustSelectedFromSearch.value = true;
  
  // Store the search query for highlighting
  searchQueryForHighlight.value = searchQuery || null;
  
  try {
    await navigateToNote(note, spacesStore.expandedSpaceIds, (sectionId) => {
      selectedFolderId.value = sectionId;
    });
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
function handleDeleteClick(pageId: string, event: MouseEvent) {
  event.stopPropagation(); // Prevent note selection
  if (noteToDelete.value === pageId) {
    // Already in confirmation mode, delete the note
    handleConfirmDelete(pageId);
  } else {
    // Switch to confirmation mode
    noteToDelete.value = pageId;
  }
}

async function handleConfirmDelete(pageId: string) {
  try {
    await notesStore.deleteNote(pageId);
    toast.success('Note deleted');
    noteToDelete.value = null;
    
    // If the deleted note was active, close it
    if (activeNote.value?.id === pageId) {
      // The store already handles this, but we can ensure it's closed
      notesStore.closeTab(pageId);
    }
  } catch (error) {
    console.error('Failed to delete note:', error);
    toast.error('Failed to delete note');
    noteToDelete.value = null;
  }
}

// Mobile: close the currently open note and return to folder list or Home
function handleCloseActiveNote() {
  if (!activeNote.value) return;
  notesStore.closeTab(activeNote.value.id);
}

// Mobile: back from folder notes list to Home
function handleBackToHomeFromFolder() {
  selectedFolderId.value = null;
}

function handleDeleteCancel() {
  noteToDelete.value = null;
}

// ... (Keep creation actions: handleCreateNote, etc.)
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

function openCreateFolderModal(notebookId?: number) {
  newFolderName.value = '';
  targetSpaceIdForFolderCreation.value = notebookId;
  showCreateFolderModal.value = true;
  showSpaceContextMenu.value = null;
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

    const response = await $fetch<{ title: string; content: string }>('/api/pages/polish', {
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

// Ask AI to modify note
const isAskingAI = ref(false);
async function downloadPDF() {
  if (!activeNote.value) return;
  
  try {
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.error('Not authenticated');
      return;
    }

    toast.info('Generating PDF...');

    // Fetch PDF from server
    const response = await $fetch(`/api/pages/${activeNote.value.id}/download-pdf`, {
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
    link.download = `${activeNote.value.title || 'note'}.pdf`;
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

async function askAINote(prompt: string) {
  if (!activeNote.value) return;
  
  if (!prompt || !prompt.trim()) {
    return;
  }

  isAskingAI.value = true;

  try {
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.error('Not authenticated');
      return;
    }

    const response = await $fetch<{ content: string }>('/api/pages/ask-ai', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        title: activeNote.value.title || 'Untitled Note',
        content: activeNote.value.content || '',
        prompt: prompt
      }
    });

    // Update the note with the AI-modified content
    if (activeNote.value) {
      activeNote.value.content = response.content;
      
      // Save the changes
      await notesStore.updateNote(activeNote.value.id, {
        content: response.content
      });
    }

    toast.success('Note updated! ✨');
  } catch (error: any) {
    console.error('AskAI error:', error);
    toast.error(error.data?.message || 'Failed to process AI request');
  } finally {
    isAskingAI.value = false;
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

function handleOpenFolderMenu(sectionId: number, event: MouseEvent) {
  folderMenuOpen.value = sectionId;
  // Calculate position (simplified)
  folderMenuPos.value = { top: event.clientY, left: event.clientX, width: 200 };
}

function handleCloseFolderMenu() {
  folderMenuOpen.value = null;
}

// Folder context menu (sidebar sections)
const openFolderContextMenuId = ref<number | null>(null);

// Ensure only one of space or folder context menus is open at a time
watch(showSpaceContextMenu, (notebookId) => {
  if (notebookId !== null) {
    openFolderContextMenuId.value = null;
  }
});

watch(openFolderContextMenuId, (sectionId) => {
  if (sectionId !== null) {
    showSpaceContextMenu.value = null;
  }
});

// Helper to restore selected folder and active note on refresh
const restoreState = () => {
  if (!isMounted.value) return;
  
  // Try to find the active note
  const activeNoteId = notesStore.activeTabId;
  if (activeNoteId) {
    const note = notesStore.notes.find(n => n.id === activeNoteId);
    if (note && note.section_id) {
      // Restore selected folder
      selectedFolderId.value = note.section_id;
      
      // Expand the space containing this folder
      const folder = foldersStore.getFolderById(note.section_id);
      if (folder && folder.notebook_id) {
        spacesStore.expandSpace(folder.notebook_id);
        spacesStore.setCurrentSpace(folder.notebook_id);
      }
    }
  }
}

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-view-dropdown]')) {
      showViewDropdown.value = false;
    }
  };
  
  watch(() => showViewDropdown.value, (isOpen) => {
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });
  
  const handleSpaceClickOutside = (event: MouseEvent) => {
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
        document.addEventListener('click', handleSpaceClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleSpaceClickOutside);
    }
  });
  
  onUnmounted(() => {
    document.removeEventListener('click', handleSpaceClickOutside);
  });
});

// Close folder context menu when clicking outside
onMounted(() => {
  const handleFolderClickOutside = (event: MouseEvent) => {
    if (openFolderContextMenuId.value === null) return;

    const target = event.target as HTMLElement;

    // Don't close if clicking the folder menu button
    if (target.closest('[data-context-menu-button]')) {
      return;
    }

    // Don't close if clicking inside the folder context menu
    if (target.closest('[data-context-menu]')) {
      return;
    }

    // Close for any other click
    openFolderContextMenuId.value = null;
  };

  watch(() => openFolderContextMenuId.value, (sectionId) => {
    if (sectionId !== null) {
      setTimeout(() => {
        document.addEventListener('click', handleFolderClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleFolderClickOutside);
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleFolderClickOutside);
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

// Watch for screen size changes and redirect accordingly
watch(isMobileView, (isMobile) => {
  if (isMobile && process.client && route.path === '/dashboard') {
    // Screen became mobile, redirect to mobile home
    router.replace('/mobile/home');
  }
}, { immediate: false });

onMounted(async () => {
  isMounted.value = true;
  
  // Redirect mobile users to the new mobile home page
  if (isMobileView.value && route.path === '/dashboard') {
    router.replace('/mobile/home');
    return;
  }
  
  await loadData();
  await notesStore.loadTabsFromStorage(); // Ensure tabs are loaded
  
  // Restore state after data is loaded
  restoreState();
  
  // Load note order as well
  await notesStore.loadNoteOrder();
  nextTick(() => {
    initSortables();
    initNoteSortable();
    setupScrollDetection();
  });
  
  // Add keyboard shortcut listener
  window.addEventListener('keydown', handleGlobalKeydown);

  // Listen for window resize to handle responsive routing
  const handleResize = () => {
    if (window.innerWidth < 1024 && route.path === '/storage') {
      // Screen became mobile, redirect
      router.replace('/mobile/storage');
    }
  };

  window.addEventListener('resize', handleResize);
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});

onUnmounted(() => {
  if (titleSaveTimeout) clearTimeout(titleSaveTimeout);
  if (contentSaveTimeout) clearTimeout(contentSaveTimeout);
  window.removeEventListener('keydown', handleGlobalKeydown);
  cleanupScrollDetection();
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
    


    <!-- Storage View (Full Width) -->
    <main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative">
      <FileStorage />
    </main>

    <!-- Mobile bottom navigation removed; Home now links to Settings directly -->

    <!-- Mobile: Notebooks & Sections sheet -->
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
            v-if="showMobileSpacesSheet && isMobileView"
            class="fixed inset-0 z-40 md:hidden"
          >
            <div
              class="absolute inset-0 bg-black/40 backdrop-blur-sm"
              @click="closeMobileSpacesSheet()"
            />
            <div
              class="absolute inset-x-0 bottom-0 pt-3 pb-4 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden"
              :class="{ 'transition-transform duration-200': !isDraggingSheet }"
              :style="{ transform: `translateY(${sheetTranslateY}px)` }"
            >
              <!-- Drag handle + header: expanded drag area -->
              <div
                class="pb-2"
                @touchstart.stop.prevent="handleSheetHandleTouchStart"
                @touchmove.stop.prevent="handleSheetHandleTouchMove"
                @touchend.stop="handleSheetHandleTouchEnd"
                @mousedown.stop.prevent="handleSheetHandleMouseDown"
              >
                <div class="mx-auto h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700 mb-3" />
                <!-- Spaces header -->
                <div
                  v-if="sheetView === 'spaces'"
                  class="px-4 flex items-center justify-between"
                >
                  <div>
                    <p class="text-xs uppercase tracking-wide text-gray-400">Spaces</p>
                    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-50">Notebooks & sections</h2>
                  </div>
                  <button
                    type="button"
                    class="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-200 active:scale-95 transition"
                    @click.stop="openCreateSpaceModal"
                  >
                    <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                  </button>
                </div>

                <!-- Folder notes header -->
                <div
                  v-else
                  class="px-4 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    class="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-200 active:scale-95 transition flex-shrink-0"
                    @click.stop="sheetView = 'spaces'"
                  >
                    <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
                  </button>
                  <div class="flex-1 min-w-0 text-center">
                    <p class="text-[11px] uppercase tracking-wide text-gray-400">Section</p>
                    <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {{ sheetFolderTitle }}
                    </h2>
                  </div>
                  <button
                    v-if="selectedFolderId"
                    type="button"
                    class="p-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 active:scale-95 transition flex-shrink-0"
                    @click.stop="handleCreateNoteInFolder(selectedFolderId as number)"
                  >
                    <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Transition name="sheet-view" mode="out-in">
                <!-- Spaces list view -->
                <div
                  v-if="sheetView === 'spaces'"
                  class="px-4 pb-1 overflow-y-auto max-h-[70vh] min-h-[40vh] space-y-3"
                >
                  <div
                    v-for="space in spacesStore.spaces"
                    :key="space.id"
                    class="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-gray-50/70 dark:bg-gray-800/60 px-3 py-2.5"
                  >
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                      <button
                        type="button"
                        class="flex items-center gap-2 min-w-0 flex-1 text-left"
                        @click="spacesStore.setCurrentSpace(space.id)"
                      >
                        <UIcon 
                          :name="space.icon ? `i-lucide-${space.icon}` : 'i-heroicons-book-open'"
                          class="w-4 h-4 text-gray-600 dark:text-gray-300 flex-shrink-0"
                        />
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                          {{ space.name }}
                        </span>
                      </button>
                      <button
                        type="button"
                        class="p-1.5 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-900/20 active:scale-95 transition"
                        @click.stop="openCreateFolderModal(space.id)"
                      >
                        <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div class="space-y-1.5">
                      <button
                        v-for="folder in getSpaceFolders(space.id)"
                        :key="folder.id"
                        type="button"
                        class="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 bg-white/70 dark:bg-gray-900/50 active:bg-gray-100 dark:active:bg-gray-800 transition text-left"
                        @click="openFolderInSheet(folder)"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <UIcon name="i-heroicons-folder" class="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span class="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                            {{ folder.name }}
                          </span>
                        </div>
                        <span class="text-[11px] text-gray-400 whitespace-nowrap ml-2">
                          {{ getFolderNoteCount(folder.id) }} {{ getFolderNoteCount(folder.id) === 1 ? 'note' : 'notes' }}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div v-if="!spacesStore.spaces.length" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No spaces yet. Create your first notebook to get started.
                  </div>
                </div>

                <!-- Folder notes view inside sheet -->
                <div
                  v-else
                  class="px-4 pb-1 overflow-y-auto max-h-[70vh] min-h-[40vh] space-y-2"
                >
                  <div
                    v-if="notesStore.loading && sheetDisplayNotes.length === 0"
                    class="py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 mx-auto mb-2 animate-spin" />
                    Loading notes...
                  </div>

                  <div
                    v-else-if="sheetDisplayNotes.length === 0"
                    class="py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    <p class="mb-3 text-sm">No notes in this section yet.</p>
                    <UButton
                      v-if="sheetFolderId"
                      color="primary"
                      size="md"
                      @click="handleCreateNoteInFolder(sheetFolderId as number)"
                    >
                      New note
                    </UButton>
                  </div>

                  <div v-else class="space-y-1">
                    <button
                      v-for="note in sheetDisplayNotes"
                      :key="note.id"
                      type="button"
                      class="w-full text-left rounded-xl px-3 py-2 bg-white dark:bg-gray-900/80 active:scale-[0.99] transition flex flex-col gap-0.5"
                      @click="handleOpenNote(note.id); closeMobileSpacesSheet()"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-medium text-gray-900 dark:text-gray-50 truncate">
                          {{ note.title || 'Untitled note' }}
                        </p>
                        <span class="text-[10px] text-gray-400 whitespace-nowrap">
                          {{ formatTime(note.updated_at) }}
                        </span>
                      </div>
                      <p class="text-[10px] text-gray-400">
                        Last updated {{ formatDate(note.updated_at) }}
                      </p>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
    
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
                  class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                  @click.stop
                >
                  <h3 class="text-base font-semibold mb-3 text-gray-900 dark:text-white">Create New Section</h3>
                  <input
                    v-model="newFolderName"
                    type="text"
                    placeholder="Section Name"
                    class="mb-3 w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    autofocus
                    @keyup.enter="handleCreateFolder"
                  />
                  <div class="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      @click="showCreateFolderModal = false"
                      class="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      @click="handleCreateFolder"
                      :disabled="isCreatingFolder"
                      class="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <UIcon 
                        v-if="isCreatingFolder" 
                        name="i-heroicons-arrow-path" 
                        class="w-4 h-4 animate-spin" 
                      />
                      <span>Create</span>
                    </button>
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
                  class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                  @click.stop
                >
                  <!-- Header -->
                  <div class="flex items-center gap-3 mb-3">
                    <div class="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div class="flex-1">
                      <h3 class="text-base font-bold text-gray-900 dark:text-white">
                        Delete Space
                      </h3>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        This action cannot be undone
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="cancelDeleteSpace"
                      class="flex-shrink-0 text-gray-400 md:hover:text-gray-500 md:dark:hover:text-gray-300 active:text-gray-500 dark:active:text-gray-300 transition-colors"
                      :disabled="isDeletingSpace"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                    </button>
                  </div>
                  
                  <!-- Warning Content -->
                  <div class="mb-4">
                    <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3 mb-3">
                      <p class="text-xs font-medium text-red-800 dark:text-red-300 mb-1.5">
                        ⚠️ Warning: Permanent Data Loss
                      </p>
                      <ul class="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                        <li>All <strong>folders</strong> in this space will be permanently deleted</li>
                        <li>All <strong>notes</strong> in those folders will be permanently deleted</li>
                        <li>Any shared notes from this space will be removed</li>
                        <li>This action cannot be undone</li>
                      </ul>
                    </div>
                    
                    <p class="text-xs text-gray-700 dark:text-gray-300">
                      Are you absolutely sure you want to delete <strong class="text-gray-900 dark:text-white">"{{ spacesStore.spaces.find(s => s.id === deletingSpaceId)?.name }}"</strong>?
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      @click="cancelDeleteSpace"
                      :disabled="isDeletingSpace"
                      class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      @click="confirmDeleteSpace"
                      :disabled="isDeletingSpace"
                      class="flex-1 px-3 py-2 bg-red-600 dark:bg-red-500 text-white text-sm font-normal border border-red-700 dark:border-red-600 hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800 dark:active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <UIcon 
                        v-if="isDeletingSpace" 
                        name="i-heroicons-arrow-path" 
                        class="w-4 h-4 animate-spin" 
                      />
                      <UIcon 
                        v-else
                        name="i-heroicons-trash" 
                        class="w-4 h-4" 
                      />
                      <span>Delete Forever</span>
                    </button>
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
/* Hide scrollbar completely for notebooks */
.notebooks-scroll {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.notebooks-scroll::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* Elegant thin scrollbars for notes lists */
.notes-scroll::-webkit-scrollbar {
  width: 2px;
  height: 2px;
}

.notes-scroll::-webkit-scrollbar-track {
  background: transparent;
}

/* Regular scrollbar for notes list */
.notes-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.notes-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.22);
  width: 3px;
}

.notes-scroll::-webkit-scrollbar-thumb:active {
  background: rgba(0, 0, 0, 0.3);
}

/* Fade transition for scroll indicator */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dark .notes-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
}

.dark .notes-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.22);
}

.dark .notes-scroll::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.3);
}


.notes-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.12) transparent;
}


.dark .notes-scroll {
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

/* Smooth content swap animation inside mobile sheet */
.sheet-view-enter-active,
.sheet-view-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.sheet-view-enter-from,
.sheet-view-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>


