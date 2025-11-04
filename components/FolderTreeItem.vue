<script setup lang="ts">
import type { Folder, Note } from '~/models';
import type Sortable from 'sortablejs';

interface Props {
  folder: Folder;
  selectedId: number | null;
  depth?: number;
  isExpanded?: boolean;
  // For drag-and-drop: parent folder to get siblings
  parentFolder?: Folder | null;
  publishStatus?: { is_published: boolean; share_url?: string } | undefined;
}

interface Emits {
  (e: 'select', folderId: number): void;
  (e: 'toggle', folderId: number): void;
  (e: 'create-subfolder', parentId: number): void;
  (e: 'create-note', folderId: number): void;
  (e: 'create-quick-note', folderId: number): void;
  (e: 'create-list-note', folderId: number): void;
  (e: 'create-template-note', folderId: number): void;
  (e: 'create-ai-note', folderId: number): void;
  (e: 'import-recipe', folderId: number): void;
  (e: 'rename', folderId: number): void;
  (e: 'delete', folderId: number): void;
  (e: 'move-up', folderId: number): void;
  (e: 'move-down', folderId: number): void;
  (e: 'reorder-folder', folderId: number, newIndex: number): void;
  (e: 'open-note', noteId: string): void;
  (e: 'delete-note', noteId: string): void;
  (e: 'publish', folderId: number): void;
  (e: 'unpublish', folderId: number): void;
  (e: 'check-publish-status', folderId: number): void;
  (e: 'copy-link', folderId: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  isExpanded: false
});

const emit = defineEmits<Emits>();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();

const hasChildren = computed(() => {
  return props.folder.children && props.folder.children.length > 0;
});

const folderNotes = computed(() => {
  // Exclude notes shared WITH the user (they appear in "Shared" section instead)
  const notes = notesStore.notes.filter(note => 
    note.folder_id === props.folder.id && !note.share_permission
  );
  
  // Apply note ordering if available
  const folderKey = props.folder.id === null ? 'root' : `folder_${props.folder.id}`;
  const order = notesStore.noteOrder[folderKey];
  
  if (order && order.length > 0) {
    // Sort notes by order array
    const orderedNotes: Note[] = [];
    const noteMap = new Map(notes.map(n => [n.id, n]));
    
    // Add notes in order
    for (const noteId of order) {
      const note = noteMap.get(noteId);
      if (note) {
        orderedNotes.push(note);
        noteMap.delete(noteId);
      }
    }
    
    // Add any remaining notes (not in order array) at the end
    orderedNotes.push(...Array.from(noteMap.values()));
    
    return orderedNotes;
  }
  
  // Default: sort by updated_at descending
  return notes.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
});

// Watch note order changes to force UI update
watch(
  () => notesStore.noteOrder,
  () => {
    // Force reactivity update when note order changes
    nextTick();
  },
  { deep: true }
);

const noteCount = computed(() => {
  return folderNotes.value.length;
});

const hasContent = computed(() => {
  return hasChildren.value || noteCount.value > 0;
});

// Check if folder can move up/down within siblings
const canMoveUp = computed(() => {
  const siblings = foldersStore.getSiblings(props.folder.id);
  if (siblings.length <= 1) return false;
  const currentIndex = siblings.findIndex(f => f.id === props.folder.id);
  return currentIndex > 0;
});

const canMoveDown = computed(() => {
  const siblings = foldersStore.getSiblings(props.folder.id);
  if (siblings.length <= 1) return false;
  const currentIndex = siblings.findIndex(f => f.id === props.folder.id);
  return currentIndex >= 0 && currentIndex < siblings.length - 1;
});

const showContextMenu = ref(false);
const contextMenuButtonRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ top: 0, left: 0, bottom: 0 });
const menuOpensUpward = ref(false);
const showNewNoteSubmenu = ref(false);
const newNoteSubmenuPosition = ref({ top: 0, left: 0 });
const newNoteSubmenuButtonRef = ref<HTMLElement | null>(null);
const submenuOpensUpward = ref(false);
const submenuOpensLeft = ref(false); // Track if submenu should open to the left (for mobile)
const contextMenuJustOpened = ref(false);
const lastMousePosition = ref<{ x: number; y: number } | null>(null);

// Helper to detect mobile devices (viewport width < 768px)
function isMobile(): boolean {
  if (!process.client) return false;
  return window.innerWidth < 768;
}

// SortableJS instances
const notesContainerRef = ref<HTMLElement | null>(null);
let notesSortableInstance: Sortable | null = null;

// Folder sortable container for subfolders
const subfoldersContainerRef = ref<HTMLElement | null>(null);
let foldersSortableInstance: Sortable | null = null;

function handleSelect() {
  emit('select', props.folder.id);
}

function handleToggle(event: Event) {
  event.stopPropagation();
  if (hasContent.value) {
    emit('toggle', props.folder.id);
  }
}

function handleNoteClick(noteId: string, event?: Event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  emit('open-note', noteId);
}

function truncateNoteTitle(title: string, maxLength: number = 30): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

function toggleContextMenu(event: MouseEvent) {
  event.stopPropagation();
  // Check publish status when opening context menu
  emit('check-publish-status', props.folder.id);
  event.preventDefault();
  
  // Calculate position for the menu
  if (contextMenuButtonRef.value) {
    const rect = contextMenuButtonRef.value.getBoundingClientRect();
    const menuWidth = 192; // 192px = w-48
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Estimate menu height - approximately 400px for full menu with all options
    const menuEstimatedHeight = 400;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Calculate left position - prefer opening to the right, fallback to left if not enough space
    let left = rect.right + 4; // Position to the right with 4px gap
    // If menu would overflow on the right, position it to the left instead
    if (left + menuWidth > viewportWidth - 8) {
      // Not enough space on the right - position to the left
      left = rect.left - menuWidth - 4; // Position to the left with 4px gap
      // If still doesn't fit on the left, adjust to fit within viewport
      if (left < 8) {
        left = 8; // 8px minimum padding from left edge
      }
    }
    
    // Determine if menu should open upward
    let top = 0;
    let bottom = 0;
    if (spaceBelow < menuEstimatedHeight && spaceAbove >= menuEstimatedHeight) {
      // Not enough space below but enough above - open upward
      menuOpensUpward.value = true;
      // Calculate bottom position (distance from bottom of viewport to bottom of button + menu height)
      // We want the bottom of the menu to align with or be above the top of the button
      bottom = viewportHeight - rect.top + 4; // Distance from viewport bottom to button top + gap
      top = 0; // Not used when opening upward
      // Ensure menu doesn't go above viewport (bottom should not exceed viewport height - menu height)
      const maxBottom = viewportHeight - 8;
      if (bottom > maxBottom) {
        bottom = maxBottom;
      }
    } else {
      // Default: open downward
      menuOpensUpward.value = false;
      top = rect.bottom + 4;
      bottom = 0; // Not used when opening downward
      // Ensure menu doesn't go below viewport
      if (top + menuEstimatedHeight > viewportHeight - 8) {
        top = viewportHeight - menuEstimatedHeight - 8;
        // If we adjusted top, ensure it doesn't go above button
        if (top < rect.top) {
          top = Math.max(8, viewportHeight - menuEstimatedHeight - 8);
        }
      }
    }
    
    menuPosition.value = {
      top: top,
      left: left,
      bottom: bottom
    };
  }
  
  // Always close submenu when context menu opens/closes
  showNewNoteSubmenu.value = false;
  
  // Prevent submenu from auto-opening when menu first opens
  const wasClosed = !showContextMenu.value;
  showContextMenu.value = !showContextMenu.value;
  
  if (wasClosed && showContextMenu.value) {
    // Menu just opened - prevent submenu from auto-opening
    contextMenuJustOpened.value = true;
    lastMousePosition.value = null; // Reset mouse position tracking
    // Reset the flag after a longer delay to allow hover to work
    setTimeout(() => {
      contextMenuJustOpened.value = false;
      lastMousePosition.value = null; // Reset after delay too
    }, 500); // 500ms delay before submenu can open
  }
}

function showNewNoteSubmenuHandler(event?: MouseEvent) {
  // Clear any pending hide timeout
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
  // Prevent submenu from opening immediately after context menu opens
  if (contextMenuJustOpened.value) {
    return;
  }
  
  // Also check if context menu is actually open
  if (!showContextMenu.value) {
    return;
  }
  
  // If we have mouse event, check if mouse actually moved (not just hovering)
  if (event) {
    const currentPos = { x: event.clientX, y: event.clientY };
    if (lastMousePosition.value) {
      const dx = Math.abs(currentPos.x - lastMousePosition.value.x);
      const dy = Math.abs(currentPos.y - lastMousePosition.value.y);
      // If mouse hasn't moved much (less than 5px), it might be already hovering
      // But allow it if context menu just opened flag is cleared
      if (dx < 5 && dy < 5) {
        // Mouse hasn't moved - this might be an initial hover when menu opens
        // Only allow if enough time has passed
        return;
      }
    }
    lastMousePosition.value = currentPos;
  }
  
  if (newNoteSubmenuButtonRef.value) {
    const buttonRect = newNoteSubmenuButtonRef.value.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const submenuEstimatedHeight = 320; // Approximate height for 5 menu items
    const submenuWidth = 224; // w-56 = 224px
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const spaceRight = viewportWidth - buttonRect.right;
    const spaceLeft = buttonRect.left;
    
    // Determine if submenu should open to the left (mobile/small screens)
    // Check if there's enough space on the right (context menu + submenu + padding)
    // On mobile (viewport < 768px), prefer opening to the left if context menu is near right edge
    if (viewportWidth < 768 || spaceRight < submenuWidth + 8) {
      // Not enough space on right - open to the left
      submenuOpensLeft.value = true;
    } else {
      // Enough space on right - open to the right (default)
      submenuOpensLeft.value = false;
    }
    
    // If not enough space below but enough space above, open upward
    if (spaceBelow < submenuEstimatedHeight && spaceAbove >= submenuEstimatedHeight) {
      submenuOpensUpward.value = true;
    } else {
      // Default: open downward
      submenuOpensUpward.value = false;
    }
  }
  showNewNoteSubmenu.value = true;
}

let submenuTimeout: ReturnType<typeof setTimeout> | null = null;

function hideNewNoteSubmenuHandler() {
  // Clear any existing timeout
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
  }
  
  // Small delay to allow moving to submenu
  submenuTimeout = setTimeout(() => {
    // Check if mouse is still over button or submenu
    const isOverButton = newNoteSubmenuButtonRef.value?.matches(':hover');
    const isOverSubmenu = document.querySelector('[data-new-note-submenu-hover]')?.matches(':hover');
    
    if (!isOverButton && !isOverSubmenu) {
      showNewNoteSubmenu.value = false;
    }
    submenuTimeout = null;
  }, 150);
}

// Handle new note click - mobile: direct create, desktop: show submenu
function handleNewNoteClick(event: MouseEvent) {
  if (isMobile()) {
    // On mobile, directly create a note
    event.stopPropagation();
    event.preventDefault();
    // Close context menu
    showContextMenu.value = false;
    // Emit the create-note event
    // The handler (handleCreateNoteInFolder) will:
    // 1. Create the note in the folder
    // 2. Open it as a tab (notesStore.openTab)
    // 3. Close the mobile sidebar (isMobileSidebarOpen = false)
    emit('create-note', props.folder.id);
  }
  // On desktop, don't prevent default - let hover handler work
}

// Folder colors based on depth for visual hierarchy
const folderColors = [
  'text-blue-600 dark:text-blue-400',
  'text-purple-600 dark:text-purple-400',
  'text-green-600 dark:text-green-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
];

const folderColor = computed(() => {
  return folderColors[props.depth % folderColors.length] || 'text-blue-600 dark:text-blue-400';
});

// Initialize SortableJS for notes
async function initializeNotesSortable() {
  // Initialize if folder is expanded (even if empty - to allow drops)
  if (!notesContainerRef.value || !props.isExpanded) {
    return;
  }
  
  // Always initialize SortableJS for expanded folders to allow drops, even if empty
  // Empty folders need sortable to accept dropped notes
  
  if (notesSortableInstance) {
    notesSortableInstance.destroy();
    notesSortableInstance = null;
  }
  
  await nextTick();
  
  if (!notesContainerRef.value) {
    return;
  }
  
  try {
    const SortableJS = (await import('sortablejs')).default;
    
    notesSortableInstance = SortableJS.create(notesContainerRef.value, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      draggable: '.note-item',
      group: {
        name: 'notes',
        pull: true,
        put: true
      },
      forceFallback: false,
      // Longer delay on mobile to prevent conflicts with scrolling
      delay: 300, // 300ms delay for touch devices (only applies when delayOnTouchOnly is true)
      delayOnTouchOnly: true,
      touchStartThreshold: 3,
      filter: '.no-drag',
      preventOnFilter: false,
      emptyInsertThreshold: 20, // Increased threshold for empty containers
      swapThreshold: 0.65,
      invertSwap: false,
      fallbackOnBody: true, // Recommended for nested scenarios
      fallbackTolerance: 0, // Prevent creating duplicate drag elements
      onStart: (evt) => {
        console.log('[FolderTreeItem] Note drag started');
        // Add class to body to enable CSS for dragging state
        if (process.client) {
          document.body.classList.add('sortable-dragging');
          // Mark the source container (the one we're dragging from) to exclude it from empty folder styling
          const fromElement = evt.from as HTMLElement;
          if (fromElement) {
            fromElement.classList.add('sortable-source-container');
          }
        }
      },
      onMove: (evt) => {
        // Auto-expand folder when dragging over its notes container
        const relatedElement = evt.related;
        if (relatedElement) {
          // Check if we're moving over a notes container
          const notesContainer = relatedElement.closest('.notes-container');
          if (notesContainer) {
            const folderIdAttr = notesContainer.getAttribute('data-folder-id');
            if (folderIdAttr && folderIdAttr !== 'null') {
              const folderId = parseInt(folderIdAttr);
              if (!foldersStore.expandedFolderIds.has(folderId)) {
                foldersStore.expandFolder(folderId);
              }
            }
          }
        }
        return true; // Allow the move
      },
      onAdd: (evt) => {
        // Auto-expand folder when item is added (dragged into)
        const toElement = evt.to;
        if (toElement) {
          const folderIdAttr = toElement.getAttribute('data-folder-id');
          if (folderIdAttr && folderIdAttr !== 'null') {
            const folderId = parseInt(folderIdAttr);
            if (!foldersStore.expandedFolderIds.has(folderId)) {
              foldersStore.expandFolder(folderId);
            }
          }
        }
      },
      onEnd: async (evt) => {
        // Remove dragging class from body and source container marker
        if (process.client) {
          document.body.classList.remove('sortable-dragging');
          // Remove source container marker from all containers
          document.querySelectorAll('.sortable-source-container').forEach(el => {
            el.classList.remove('sortable-source-container');
          });
        }
        
        const { oldIndex, newIndex, item, to, from } = evt;
        
        const noteId = item.getAttribute('data-note-id');
        if (!noteId) {
          console.error('[FolderTreeItem] No note ID found on dragged item');
          return;
        }
        
        // Determine target folder from the notes container (to element)
        // The 'to' element should be the notes-container div where the note was dropped
        let targetFolderId: number | null = null;
        
        // Try multiple methods to get the target folder ID
        // Method 1: Check if 'to' element itself has the folder-id (most common case)
        let folderIdAttr = to.getAttribute('data-folder-id');
        
        // Method 2: If not found, check if 'to' element has a parent with data-folder-id
        if (!folderIdAttr) {
          const parentWithFolderId = to.closest('[data-folder-id]') as HTMLElement | null;
          if (parentWithFolderId) {
            folderIdAttr = parentWithFolderId.getAttribute('data-folder-id');
          }
        }
        
        // Method 3: If still not found, look for the notes-container element
        if (!folderIdAttr) {
          const notesContainer = to.closest('.notes-container') as HTMLElement | null;
          if (notesContainer) {
            folderIdAttr = notesContainer.getAttribute('data-folder-id');
          }
        }
        
        // Method 4: If still not found, check if 'to' contains a notes-container
        if (!folderIdAttr) {
          const notesContainer = to.querySelector('.notes-container') as HTMLElement | null;
          if (notesContainer) {
            folderIdAttr = notesContainer.getAttribute('data-folder-id');
          }
        }
        
        console.log('[FolderTreeItem] onEnd triggered', {
          oldIndex,
          newIndex,
          noteId,
          fromFolder: from?.getAttribute('data-folder-id'),
          toDataFolderId: folderIdAttr,
          toElement: to.className,
          toTagName: to.tagName,
          currentFolderId: props.folder.id,
          depth: props.depth
        });
        
        if (folderIdAttr) {
          if (folderIdAttr === 'null') {
            targetFolderId = null; // Root level
            console.log('[FolderTreeItem] Target folder: root (null)');
          } else {
            const parsedId = parseInt(folderIdAttr);
            if (!isNaN(parsedId)) {
              targetFolderId = parsedId;
              console.log('[FolderTreeItem] Target folder from data attribute:', targetFolderId);
            } else {
              console.error('[FolderTreeItem] Invalid folder ID:', folderIdAttr);
            }
          }
        }
        
        // Final fallback: use the current folder if we still don't have a target
        if (targetFolderId === null && folderIdAttr !== 'null') {
          targetFolderId = props.folder.id;
          console.warn('[FolderTreeItem] Could not determine target folder, using current folder as fallback:', targetFolderId);
        }
        
        const currentNote = notesStore.notes.find(n => n.id === noteId);
        if (!currentNote) {
          console.error('[FolderTreeItem] Note not found in store:', noteId);
          return;
        }
        
        console.log('[FolderTreeItem] Current note state', {
          noteId,
          currentFolderId: currentNote.folder_id,
          targetFolderId,
          folderChanged: targetFolderId !== currentNote.folder_id,
          oldIndex,
          newIndex,
          sameIndex: oldIndex === newIndex,
          noteOpen: notesStore.currentNote?.id === noteId
        });
        
        // If folder changed, move the note (even if index is the same)
        const folderChanged = targetFolderId !== currentNote.folder_id;
        
        if (!folderChanged && (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex)) {
          console.log('[FolderTreeItem] Skipping - no actual move occurred (same folder, same position)');
          return;
        }
        
        // If folder changed, move the note
        if (folderChanged) {
          try {
            console.log('[FolderTreeItem] Starting note move', {
              noteId,
              fromFolderId: currentNote.folder_id,
              toFolderId: targetFolderId,
              newIndex,
              depth: props.depth,
              targetFolderIdValid: targetFolderId !== null || targetFolderId === null // null is valid for root
            });
            
            // Validate targetFolderId is determined correctly
            if (targetFolderId === undefined) {
              console.error('[FolderTreeItem] Target folder ID is undefined, cannot move note');
              return;
            }
            
            // Expand the target folder if it's collapsed to show the moved note
            if (targetFolderId !== null) {
              console.log('[FolderTreeItem] Expanding target folder:', targetFolderId);
              foldersStore.expandFolder(targetFolderId);
            }
            
            // Wait a tick for folder expansion
            await nextTick();
            
            // Do the API call - this updates the note in the store optimistically
            console.log('[FolderTreeItem] Calling notesStore.moveNote with:', {
              noteId,
              targetFolderId,
              newIndex: newIndex ?? undefined
            });
            await notesStore.moveNote(noteId, targetFolderId, newIndex);
            console.log('[FolderTreeItem] moveNote completed successfully');
            
            // Force Vue reactivity update by using nextTick after store update
            await nextTick();
            
            // Verify the move was successful - fetch from server to ensure database saved
            console.log('[FolderTreeItem] Verifying move from server...');
            try {
              const authStore = useAuthStore();
              if (authStore.token) {
                // Fetch the note from server to verify database save
                const serverNote = await $fetch<Note>(`/api/notes/${noteId}`, {
                  headers: {
                    Authorization: `Bearer ${authStore.token}`
                  }
                });
                
                console.log('[FolderTreeItem] Server note response', {
                  noteId: serverNote.id,
                  serverFolderId: serverNote.folder_id,
                  localFolderId: notesStore.notes.find(n => n.id === noteId)?.folder_id,
                  expectedFolderId: targetFolderId,
                  match: serverNote.folder_id === targetFolderId
                });
                
                // Update note in store with server data
                const localNoteIndex = notesStore.notes.findIndex(n => n.id === noteId);
                if (localNoteIndex !== -1) {
                  console.log('[FolderTreeItem] Updating note in store array', {
                    before: notesStore.notes[localNoteIndex].folder_id,
                    after: serverNote.folder_id
                  });
                  notesStore.notes[localNoteIndex].folder_id = serverNote.folder_id;
                  notesStore.notes[localNoteIndex].updated_at = serverNote.updated_at;
                }
                
                // Update currentNote if it's the moved note
                if (notesStore.currentNote && notesStore.currentNote.id === noteId) {
                  console.log('[FolderTreeItem] Updating currentNote', {
                    before: notesStore.currentNote.folder_id,
                    after: serverNote.folder_id
                  });
                  
                  // Update currentNote with server data - create new object to force reactivity
                  const updatedNote = {
                    ...notesStore.currentNote,
                    folder_id: serverNote.folder_id,
                    updated_at: serverNote.updated_at
                  };
                  
                  // Update the note in the notes array first so activeNote getter finds the updated version
                  const noteArrayIndex = notesStore.notes.findIndex(n => n.id === noteId);
                  if (noteArrayIndex !== -1) {
                    notesStore.notes[noteArrayIndex].folder_id = serverNote.folder_id;
                    notesStore.notes[noteArrayIndex].updated_at = serverNote.updated_at;
                  }
                  
                  // Force activeNote getter to return updated note by triggering reactivity
                  // The activeNote getter will pick up the change from notes array
                  await nextTick();
                  
                  // This will trigger the activeNote watcher in dashboard.vue
                  notesStore.setCurrentNote(updatedNote);
                  console.log('[FolderTreeItem] currentNote updated via setCurrentNote', {
                    folder_id: updatedNote.folder_id,
                    noteInArray: notesStore.notes.find(n => n.id === noteId)?.folder_id
                  });
                  
                  // Force a small delay to let reactivity propagate
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
            } catch (err) {
              console.error('[FolderTreeItem] Failed to verify note move from server:', err);
            }
            
            // Force reactivity update for note count changes
            await nextTick();
            console.log('[FolderTreeItem] Move complete');
            
            // No need to refresh folder tree - moving a note doesn't change folder structure
            // The note's folder_id has already been updated in the store, and the UI will reactively update
            
          } catch (error) {
            console.error('[FolderTreeItem] Failed to move note:', error);
            // On error, refresh to show correct state
            await Promise.all([
              notesStore.fetchNotes(),
              foldersStore.fetchFolders()
            ]);
          }
        } else {
          // Same folder, just reorder
          try {
            await notesStore.reorderNote(noteId, targetFolderId, newIndex);
            // Force Vue to update the UI immediately
            await nextTick();
          } catch (error) {
            console.error('Failed to reorder note:', error);
          }
        }
      }
    });
  } catch (error) {
    console.error('[FolderTreeItem] Error initializing notes Sortable:', error);
  }
}

// Initialize SortableJS for folders (subfolders within this folder)
async function initializeFoldersSortable() {
  // Only initialize if we have children (subfolders to drag)
  if (!hasChildren.value || !subfoldersContainerRef.value) {
    console.log('[FolderTreeItem] Skipping folders sortable - no children or no container', {
      hasChildren: hasChildren.value,
      hasContainer: !!subfoldersContainerRef.value
    });
    return;
  }
  
  // Only initialize if folder is expanded (so we can see the subfolders)
  if (!props.isExpanded) {
    console.log('[FolderTreeItem] Skipping folders sortable - folder not expanded');
    return;
  }
  
  if (foldersSortableInstance) {
    foldersSortableInstance.destroy();
    foldersSortableInstance = null;
  }
  
  await nextTick();
  
  if (!subfoldersContainerRef.value) {
    return;
  }
  
  try {
    const SortableJS = (await import('sortablejs')).default;
    
    foldersSortableInstance = SortableJS.create(subfoldersContainerRef.value, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      draggable: '.folder-item',
      forceFallback: false,
      // Longer delay on mobile to prevent conflicts with scrolling
      delay: 300, // 300ms delay for touch devices (only applies when delayOnTouchOnly is true)
      delayOnTouchOnly: true,
      touchStartThreshold: 3,
      filter: '.no-drag',
      preventOnFilter: false,
      group: {
        name: 'folders',
        pull: false, // Don't allow moving folders between different parents
        put: false // Don't allow dropping folders from other parents
      },
      onStart: () => {
        console.log('[FolderTreeItem] Folder drag started');
      },
      onEnd: async (evt) => {
        const { oldIndex, newIndex, item } = evt;
        
        console.log('[FolderTreeItem] Folder drag ended', {
          oldIndex,
          newIndex,
          item,
          parentFolderId: props.folder.id
        });
        
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
          console.log('[FolderTreeItem] No folder reorder needed');
          return;
        }
        
        const folderId = item.getAttribute('data-folder-id');
        if (!folderId) {
          console.error('[FolderTreeItem] No folder ID found on dragged item');
          return;
        }
        
        console.log('[FolderTreeItem] Folder reordered', {
          folderId,
          oldIndex,
          newIndex,
          parentFolderId: props.folder.id
        });
        
        // Emit reorder event to parent (dashboard.vue handles it)
        emit('reorder-folder', parseInt(folderId), newIndex);
      }
    });
    
    console.log('[FolderTreeItem] Folders Sortable initialized');
  } catch (error) {
    console.error('[FolderTreeItem] Error initializing folders Sortable:', error);
  }
}

// Watch for expansion changes and reinitialize Sortable
watch(
  () => [props.isExpanded, hasChildren.value],
  async () => {
    if (props.isExpanded) {
      // Always initialize notes sortable when expanded (needed for drops)
      await nextTick();
      await initializeNotesSortable();
      
      // Initialize folders sortable if there are subfolders
      if (hasChildren.value) {
        await nextTick();
        await initializeFoldersSortable();
      }
    } else {
      if (notesSortableInstance) {
        notesSortableInstance.destroy();
        notesSortableInstance = null;
      }
      // Keep folders sortable instance if folder has children (might be collapsed but still needs drag)
      // Only destroy if truly empty
      if (!hasChildren.value && foldersSortableInstance) {
        foldersSortableInstance.destroy();
        foldersSortableInstance = null;
      }
    }
  },
  { immediate: true }
);

// Also watch for subfolders container availability
watch(
  () => subfoldersContainerRef.value,
  async (container) => {
    if (container && (hasChildren.value || props.isExpanded)) {
      await nextTick();
      await initializeFoldersSortable();
    }
  },
  { immediate: true }
);

// Handle drag-over events on folder items to auto-expand
onMounted(() => {
  // Handle drag over folder items to auto-expand them
  const handleFolderDragOver = (event: DragEvent) => {
    // Check if SortableJS is dragging (it adds classes to body)
    const isSortableDragging = document.body.classList.contains('sortable-drag') || 
                             document.querySelector('.sortable-ghost') ||
                             document.querySelector('.sortable-chosen');
    
    if (!isSortableDragging) {
      return;
    }
    
    const target = event.target as HTMLElement;
    const folderItem = target.closest('.folder-item');
    
    if (folderItem) {
      const folderIdAttr = folderItem.getAttribute('data-folder-id');
      if (folderIdAttr && folderIdAttr !== 'null') {
        const folderId = parseInt(folderIdAttr);
        if (!foldersStore.expandedFolderIds.has(folderId)) {
          foldersStore.expandFolder(folderId);
        }
      }
    }
  };
  
  // Attach to document for drag events (use capture to catch events early)
  document.addEventListener('dragover', handleFolderDragOver, true);
  
  // Close context menu when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    if (!showContextMenu.value) return;
    
    const target = event.target as HTMLElement;
    const button = contextMenuButtonRef.value;
    
    // Don't close if clicking the button itself (let toggleContextMenu handle it)
    if (button && button.contains(target)) {
      return;
    }
    
    // Close if clicking anywhere else
    showContextMenu.value = false;
  };
  
  document.addEventListener('click', handleClickOutside, true); // Use capture phase
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside, true);
    document.removeEventListener('dragover', handleFolderDragOver, true);
    if (notesSortableInstance) {
      notesSortableInstance.destroy();
      notesSortableInstance = null;
    }
    if (foldersSortableInstance) {
      foldersSortableInstance.destroy();
      foldersSortableInstance = null;
    }
  });
});
</script>

<template>
  <!-- Folder Item (root element must be draggable for SortableJS) -->
    <div
    class="folder-item group/folder relative flex items-center gap-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
    :data-folder-id="folder.id"
    >
      <!-- Expand/Collapse Button -->
      <button
        v-if="hasContent"
        @click.stop="handleToggle"
        @mousedown.stop
        class="no-drag flex-shrink-0 p-2 md:p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        :class="{ 'rotate-90': isExpanded }"
      >
        <UIcon name="i-heroicons-chevron-right" class="w-6 h-6 md:w-4 md:h-4 text-gray-500 transition-transform" />
      </button>
      <div v-else class="w-8 md:w-6" />

      <!-- Folder Button -->
      <button
        @click.stop="handleSelect"
        @mousedown.stop
        class="no-drag flex-1 flex items-center gap-3 md:gap-2 py-3 md:py-2.5 pr-2 text-lg md:text-sm font-medium transition-colors rounded-lg min-w-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/30"
      >
        <UIcon 
          name="i-heroicons-folder" 
          class="w-6 h-6 md:w-4 md:h-4 flex-shrink-0"
          :class="folderColor"
        />
        <span class="truncate flex-1 text-left">{{ folder.name }}</span>
        <span 
          v-if="noteCount > 0"
          class="text-base md:text-xs px-2.5 md:px-1.5 py-1 md:py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0"
        >
          {{ noteCount }}
        </span>
      </button>

      <!-- Context Menu Button -->
      <button
        ref="contextMenuButtonRef"
        type="button"
        @click.stop="toggleContextMenu"
        @mousedown.stop
        class="no-drag flex-shrink-0 p-2 md:p-1.5 rounded-md opacity-100 md:opacity-0 md:group-hover/folder:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
        :class="showContextMenu ? 'bg-gray-200 dark:bg-gray-600' : ''"
      >
        <svg class="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="8" cy="2" r="1.5"/>
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="8" cy="14" r="1.5"/>
        </svg>
      </button>
    </div>

    <!-- Context Menu Dropdown (Teleported to body) -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showContextMenu"
          @click.stop
          class="fixed w-48 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-2 z-[9999]"
          :style="{ 
            top: menuOpensUpward ? 'auto' : `${menuPosition.top}px`, 
            bottom: menuOpensUpward ? `${menuPosition.bottom}px` : 'auto',
            left: `${menuPosition.left}px` 
          }"
        >
          <button
            v-if="canMoveUp"
            type="button"
            @click="emit('move-up', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-arrow-up" class="w-5 h-5 text-gray-500" />
            <span>Move Up</span>
          </button>
          <button
            v-if="canMoveDown"
            type="button"
            @click="emit('move-down', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-arrow-down" class="w-5 h-5 text-gray-500" />
            <span>Move Down</span>
          </button>
          <div v-if="canMoveUp || canMoveDown" class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
          <button
            type="button"
            @click="emit('create-subfolder', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-folder-plus" class="w-5 h-5 text-blue-500" />
            <span>New Subfolder</span>
          </button>
          <div class="relative">
              <!-- Mobile: Direct create note, Desktop: Show submenu -->
              <button
              ref="newNoteSubmenuButtonRef"
              type="button"
              @click="handleNewNoteClick"
              @mouseenter="(e) => !isMobile() && showNewNoteSubmenuHandler(e as MouseEvent)"
              @mouseleave="!isMobile() && hideNewNoteSubmenuHandler()"
              class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between gap-3"
            >
              <div class="flex items-center gap-3">
                <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-green-500" />
                <span>New Note</span>
              </div>
              <!-- Only show chevron on desktop where submenu exists -->
              <UIcon v-if="!isMobile()" name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            </button>
            
            <!-- New Note Submenu (Desktop only) -->
            <Transition name="submenu">
              <div
                v-if="!isMobile() && showNewNoteSubmenu"
                data-new-note-submenu-hover
                @mouseenter="(e) => showNewNoteSubmenuHandler(e as MouseEvent)"
                @mouseleave="hideNewNoteSubmenuHandler"
                class="absolute w-56 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-2 z-[10000]"
                :class="[
                  submenuOpensLeft ? 'right-full mr-1' : 'left-full ml-1',
                  submenuOpensUpward ? 'bottom-0' : 'top-0'
                ]"
              >
                <!-- New Note (Blank) -->
                <button
                  type="button"
                  @click="emit('create-note', folder.id); showContextMenu = false; showNewNoteSubmenu = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3"
                >
                  <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-primary-500" />
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">New Note</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Create a blank note</div>
                  </div>
                </button>

                <!-- From Template -->
                <button
                  type="button"
                  @click="emit('create-template-note', folder.id); showContextMenu = false; showNewNoteSubmenu = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3"
                >
                  <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-indigo-500" />
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">From Template</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Use a pre-made template</div>
                  </div>
                </button>

                <!-- AI Generate -->
                <button
                  type="button"
                  @click="emit('create-ai-note', folder.id); showContextMenu = false; showNewNoteSubmenu = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-3"
                >
                  <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-emerald-500" />
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">AI Generate</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Create with AI</div>
                  </div>
                </button>

                <!-- Import Recipe -->
                <button
                  type="button"
                  @click="emit('import-recipe', folder.id); showContextMenu = false; showNewNoteSubmenu = false"
                  class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3"
                >
                  <UIcon name="i-heroicons-cake" class="w-5 h-5 text-rose-500" />
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">Import Recipe</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">From URL</div>
                  </div>
                </button>
              </div>
            </Transition>
          </div>
          <div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
          <button
            type="button"
            @click="emit('rename', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-gray-500" />
            <span>Rename</span>
          </button>
          <button
            v-if="!publishStatus?.is_published"
            type="button"
            @click="emit('publish', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-link" class="w-5 h-5" />
            <span>Publish Folder</span>
          </button>
          <button
            v-if="publishStatus?.is_published"
            type="button"
            @click="emit('copy-link', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-clipboard-document" class="w-5 h-5" />
            <span>Copy Link</span>
          </button>
          <button
            v-if="publishStatus?.is_published"
            type="button"
            @click="emit('unpublish', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-x-circle" class="w-5 h-5" />
            <span>Unpublish Folder</span>
          </button>
          <button
            type="button"
            @click="emit('delete', folder.id); showContextMenu = false"
            class="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
          >
            <UIcon name="i-heroicons-trash" class="w-5 h-5" />
            <span>Delete</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Children (Notes and Subfolders) -->
    <Transition name="expand">
      <!-- Always render when expanded to allow drops into empty folders -->
      <div v-if="isExpanded" class="expand-container" :data-folder-id="folder.id">
        <div class="expand-content">
          <!-- Notes in this folder - always render container, even if empty -->
          <div
            ref="notesContainerRef"
            class="notes-container"
            :data-folder-id="folder.id"
            :class="{ 'empty-folder': folderNotes.length === 0 && !hasChildren }"
          >
        <div
          v-for="note in folderNotes"
          :key="`note-${note.id}`"
            :data-note-id="note.id"
            class="note-item group/note flex items-center gap-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-grab active:cursor-grabbing"
            :style="{ 
              paddingLeft: `${(depth + 1) * 12 + 8}px`,
              transition: 'padding-left 0.15s ease'
            }"
          :class="notesStore.activeTabId === note.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
        >
          <div class="w-6 flex-shrink-0" />
          
          <div @click.stop="handleNoteClick(note.id, $event)" class="flex items-center gap-3 md:gap-2 flex-1 min-w-0 cursor-pointer py-2.5 md:py-2">
            <!-- Note Icon -->
            <UIcon 
              name="i-heroicons-document-text" 
              class="w-6 h-6 md:w-4 md:h-4 flex-shrink-0"
              :class="notesStore.activeTabId === note.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'"
            />
            
            <!-- Note Title -->
            <span 
              class="flex-1 text-lg md:text-sm pr-2 truncate"
              :class="notesStore.activeTabId === note.id ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-700 dark:text-gray-300'"
              :title="note.title"
            >
              {{ truncateNoteTitle(note.title) }}
            </span>
          </div>
          
          <!-- Note Delete Button -->
          <button
            @click.stop="$emit('delete-note', note.id)"
              class="no-drag flex-shrink-0 p-2.5 md:p-1.5 mr-2 rounded-md opacity-0 group-hover/note:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
            title="Delete note"
          >
            <UIcon name="i-heroicons-trash" class="w-5 h-5 md:w-3.5 md:h-3.5 text-red-600 dark:text-red-400" />
          </button>
          </div>
        </div>

        <!-- Subfolders (Recursive) - Draggable -->
        <div
          v-if="hasChildren"
          ref="subfoldersContainerRef"
          class="subfolders-container space-y-0.5"
          :data-parent-folder-id="folder.id"
        >
        <FolderTreeItem
          v-for="child in folder.children"
          :key="child.id"
          :folder="child"
          :selected-id="selectedId"
          :depth="depth + 1"
          :is-expanded="foldersStore.expandedFolderIds.has(child.id)"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
          @create-subfolder="emit('create-subfolder', $event)"
          @create-note="emit('create-note', $event)"
          @rename="emit('rename', $event)"
          @delete="emit('delete', $event)"
          @move-up="emit('move-up', $event)"
          @move-down="emit('move-down', $event)"
            @reorder-folder="(folderId, newIndex) => emit('reorder-folder', folderId, newIndex)"
          @open-note="emit('open-note', $event)"
          @delete-note="emit('delete-note', $event)"
        />
        </div>
        </div>
      </div>
    </Transition>
</template>

<style scoped>
/* Fade transition for context menu */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

/* Submenu transition */
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.15s ease;
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.submenu-enter-to,
.submenu-leave-from {
  opacity: 1;
  transform: translateX(0);
}

/* Expand transition for children - Notion-style smooth animation */
.expand-container {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
}

.expand-content {
  min-height: 0;
  overflow: hidden;
}

.expand-enter-active {
  transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  /* Slightly longer than SortableJS (150ms) to avoid conflicts */
}

.expand-leave-active {
  transition: grid-template-rows 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* Faster leave for snappy feel */
}

.expand-enter-from {
  grid-template-rows: 0fr;
  opacity: 0;
}

.expand-enter-to {
  grid-template-rows: 1fr;
  opacity: 1;
}

.expand-leave-from {
  grid-template-rows: 1fr;
  opacity: 1;
}

.expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* SortableJS drag states */
/* Ghost element - placeholder where item will be dropped */
/* IMPORTANT: Only apply to .note-item elements to prevent leaking to other elements */
.note-item.sortable-ghost,
:deep(.note-item.sortable-ghost) {
  opacity: 0.5;
  background: rgba(59, 130, 246, 0.1) !important;
  /* Border will be conditionally shown/hidden based on drag element existence */
  border: 2px dashed rgba(59, 130, 246, 0.5) !important;
}

:deep(.sortable-chosen) {
  cursor: grabbing !important;
}

/* When drag element is active, hide the ghost outline to prevent double boxes */
/* Only apply to .note-item elements to prevent affecting editor or other elements */
.note-item.sortable-drag,
:deep(.note-item.sortable-drag) {
  opacity: 1;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: rotate(2deg);
  /* Remove any duplicate border/outline */
  outline: none !important;
  border: none !important;
}

/* Prevent double outlines - when dragging, hide ghost border if drag element is visible */
/* The sortable-dragging class is added to body in onStart handler */
/* Only target .note-item elements */
body.sortable-dragging :deep(.note-item.sortable-drag) {
  /* Ensure drag element has no duplicate border */
  border: none !important;
  outline: none !important;
}

/* When dragging with sortable-drag (fallback mode), hide ghost border to prevent double outline */
/* Only target note-item elements to prevent affecting other elements like editor */
/* IMPORTANT: Hide ghost border when dragging - only show one outline (either ghost OR container, not both) */
body.sortable-dragging :deep(.note-item.sortable-drag ~ .note-item.sortable-ghost) {
  /* Hide ghost border when drag element exists in same container */
  border: none !important;
  outline: none !important;
  background: rgba(59, 130, 246, 0.05) !important;
  opacity: 0.2 !important;
}

/* When ghost is in an empty folder (drop target), show ghost border but hide container border */
body.sortable-dragging :deep(.notes-container.empty-folder .note-item.sortable-ghost) {
  /* Show ghost border when in empty folder - this is the drop indicator */
  border: 2px dashed rgba(59, 130, 246, 0.5) !important;
  opacity: 0.5 !important;
  background: rgba(59, 130, 246, 0.1) !important;
}

/* When ghost is in a non-empty folder (has other notes), minimize its visibility */
body.sortable-dragging :deep(.notes-container:not(.empty-folder) .note-item.sortable-ghost) {
  /* Minimize ghost when not in empty folder - just show as placeholder */
  border: none !important;
  outline: none !important;
  background: rgba(59, 130, 246, 0.05) !important;
  opacity: 0.3 !important;
}

/* Prevent SortableJS classes from affecting non-note elements (like editor) */
body.sortable-dragging :deep(.sortable-ghost:not(.note-item)),
body.sortable-dragging :deep(.sortable-drag:not(.note-item)),
body.sortable-dragging :deep(.sortable-chosen:not(.note-item)) {
  border: none !important;
  outline: none !important;
}

.folder-item,
.note-item {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}


/* Ensure proper indentation updates */
.note-item[data-note-id] {
  transition: padding-left 0.15s ease;
}

/* Ensure empty folder container is interactive and can receive drops */
/* Per SortableJS docs: empty containers need padding to be detected */
/* But we only show it when hovering over during drag to avoid weird UI spacing */
.notes-container.empty-folder {
  min-height: 4px; /* Tiny height so SortableJS can detect it */
  position: relative;
  padding: 0;
  margin: 0;
  border: 2px dashed transparent;
  border-radius: 8px;
  transition: all 0.15s ease;
}

/* Only show space when dragging AND hovering over empty folder */
/* When ghost exists, hide container border to prevent double outline */
.notes-container.empty-folder:has(.sortable-ghost) {
  min-height: 50px;
  padding: 8px 0;
  border-color: transparent !important; /* Hide border when ghost exists to prevent double outline */
  background-color: rgba(59, 130, 246, 0.05);
}

/* Show space only when hovering over empty folder during drag */
/* Exclude the source container (where note came from) to avoid weird space */
/* Hide border if ghost element exists to prevent double outline */
body.sortable-dragging .notes-container.empty-folder:hover:not(.sortable-source-container) {
  min-height: 50px;
  padding: 8px 0;
  border-color: transparent !important; /* Hide border to prevent double outline with ghost */
  background-color: rgba(59, 130, 246, 0.05);
}

/* Show border only when NO ghost element exists (when dragging but not over this container yet) */
body.sortable-dragging .notes-container.empty-folder:hover:not(.sortable-source-container):not(:has(.sortable-ghost)) {
  border-color: rgba(59, 130, 246, 0.3);
}

/* Don't show space on source container even if it becomes empty */
body.sortable-dragging .notes-container.sortable-source-container {
  min-height: 4px !important;
  padding: 0 !important;
}

/* Use :empty pseudo-class - only show padding when hovering during drag */
.notes-container:empty {
  min-height: 4px; /* Tiny height so SortableJS can detect it */
  padding: 0;
}

body.sortable-dragging .notes-container:empty:hover:not(.sortable-source-container) {
  min-height: 50px;
  padding: 8px 0;
}
</style>

