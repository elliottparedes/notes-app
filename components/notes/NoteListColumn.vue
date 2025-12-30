<template>
  <aside
    v-if="!isFullscreen"
    class="hidden lg:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 flex-shrink-0 relative"
    :style="{ width: `${noteListWidth}px` }"
  >
    <!-- Resize Handle -->
    <div
      @mousedown.stop="handleNoteListResizeStart"
      @dragstart.prevent.stop
      draggable="false"
      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 z-50 pointer-events-auto"
      style="margin-right: -2px;"
    />

    <!-- Header -->
    <div class="h-12 flex items-center justify-between px-3 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
          {{ selectedFolderId ? foldersStore.getFolderById(selectedFolderId)?.name : 'Select Section' }}
        </span>
        <UIcon
          v-if="notesStore.isSyncing"
          name="i-heroicons-arrow-path"
          class="w-3.5 h-3.5 animate-spin text-gray-500 dark:text-gray-400 flex-shrink-0"
          title="Syncing..."
        />
      </div>
      <button
        v-if="selectedFolderId"
        @click="$emit('create-note-in-folder', selectedFolderId)"
        class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 flex-shrink-0"
        title="New Page"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
      </button>
    </div>

    <!-- Note List -->
    <div class="notes-scroll flex-1 overflow-y-auto note-list-scrollbar">
      <!-- Loading State -->
      <div v-if="notesStore.loading && displayNotes.length === 0" class="p-8 text-center text-gray-500">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto animate-spin mb-2" />
        Loading pages...
      </div>
      <!-- No Selection State -->
      <div v-else-if="!selectedFolderId" class="p-8 text-center text-gray-500">
        Select a section to view pages
      </div>
      <!-- Empty State -->
      <div v-else-if="displayNotes.length === 0" class="p-8 text-center text-gray-500">
        No pages in this section
      </div>
      <!-- Note List -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700" ref="noteListRef" :key="selectedFolderId">
        <!-- Drop Zone at Top - Large hit area, invisible when not hovering -->
        <div
          @dragover.prevent="handleDragOverTop"
          @dragleave="handleDragLeaveTop"
          @drop="handleDropTop"
          class="transition-all"
          :class="{
            'h-16 bg-blue-50 dark:bg-blue-900/20 border-t-4 border-blue-500 dark:border-blue-400': dragOverTop,
            'h-0': !dragOverTop
          }"
          style="margin-top: -8px; padding-top: 8px;"
        ></div>
        <TransitionGroup name="note-list">
          <div
            v-for="(note, index) in displayNotes"
            :key="note.id"
            :data-note-id="note.id"
            draggable="true"
            @click="$emit('open-note', note.id)"
            @mousedown="handleNoteMouseDown"
            @mousemove="handleNoteMouseMove"
            @mouseup="handleNoteMouseUp"
            @dragstart="handleDragStart($event, note.id)"
            @dragend="handleDragEnd"
            @dragover="handleDragOver($event, note.id)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, note.id, index)"
            class="note-item group px-3 py-2 cursor-grab active:cursor-grabbing transition-all duration-150 relative border-l-2 border-b-2"
            :class="{
              'bg-gray-50 dark:bg-gray-800/50 [border-left-width:3px] border-l-blue-600 dark:border-l-blue-400': activeNote?.id === note.id,
              'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-800': activeNote?.id !== note.id,
              'opacity-50': draggingNoteId === note.id,
              'border-b-blue-500 dark:border-b-blue-400 [border-bottom-width:3px]': dragOverNoteId === note.id,
              'border-b-transparent': dragOverNoteId !== note.id
            }"
          >
          <div class="flex flex-col gap-0.5 pr-8">
            <div class="font-normal text-sm truncate select-none text-gray-900 dark:text-gray-100">{{ note.title || 'Untitled Page' }}</div>
            <!-- Developer UI: ID Badge -->
            <button 
              v-if="authStore.isDeveloperUIEnabled" 
              class="text-[10px] font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-1 rounded w-fit max-w-full cursor-copy hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors border border-indigo-200 dark:border-indigo-700/50"
              @click.stop="copyId(note.id)"
              title="Click to copy Page ID"
            >
              ID: {{ note.id }}
            </button>
          </div>
          <!-- Delete Button -->
          <button
            @click.stop="handleDeleteClick(note.id, $event)"
            draggable="false"
            class="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 rounded-md transition-colors flex items-center justify-center"
            :class="noteToDelete === note.id
              ? 'opacity-100 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            :title="noteToDelete === note.id ? 'Click to confirm delete' : 'Delete note'"
          >
            <UIcon
              :name="noteToDelete === note.id ? 'i-heroicons-trash' : 'i-heroicons-x-mark'"
              class="w-4 h-4"
            />
          </button>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Note list transition animations */
.note-list-move {
  transition: transform 0.3s ease;
}
</style>

<script setup lang="ts">
interface Props {
  selectedFolderId: number | null
  noteListWidth: number
  isFullscreen: boolean
}

interface Emits {
  (e: 'update:noteListWidth', width: number): void
  (e: 'open-note', pageId: string): void
  (e: 'create-note-in-folder', sectionId: number): void
  (e: 'delete-note', pageId: string): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const authStore = useAuthStore();
const toast = useToast();
const { getOrderedNotesForFolder } = useNotesFormatting();
const { handleNoteListResizeStart } = useSidebarResize(undefined, (width) => emit('update:noteListWidth', width));
const { noteToDelete, handleDeleteClick } = useNoteActions();

function copyId(id: string) {
  if (process.client) {
    navigator.clipboard.writeText(id);
    toast.success('Note ID copied to clipboard');
  }
}

const noteListRef = ref<HTMLElement | null>(null);

const displayNotes = computed(() => getOrderedNotesForFolder(props.selectedFolderId));
const activeNote = computed(() => notesStore.activeNote);

// Drag and drop functionality
const draggingNoteId = ref<string | null>(null);
const dragOverNoteId = ref<string | null>(null);
const dragOverTop = ref(false);
const canDragNote = ref(false);
const noteDragStartTimer = ref<NodeJS.Timeout | null>(null);
const noteMouseDownPos = ref<{ x: number; y: number } | null>(null);

function handleNoteMouseDown(event: MouseEvent) {
  // Don't initiate drag on buttons
  if ((event.target as HTMLElement).closest('button')) {
    return;
  }

  noteMouseDownPos.value = { x: event.clientX, y: event.clientY };

  // Allow drag after 200ms delay or 5px movement
  noteDragStartTimer.value = setTimeout(() => {
    canDragNote.value = true;
  }, 200);
}

function handleNoteMouseMove(event: MouseEvent) {
  if (!noteMouseDownPos.value || canDragNote.value) return;

  const deltaX = Math.abs(event.clientX - noteMouseDownPos.value.x);
  const deltaY = Math.abs(event.clientY - noteMouseDownPos.value.y);

  // If moved more than 5px, allow drag immediately
  if (deltaX > 5 || deltaY > 5) {
    if (noteDragStartTimer.value) {
      clearTimeout(noteDragStartTimer.value);
    }
    canDragNote.value = true;
  }
}

function handleNoteMouseUp() {
  if (noteDragStartTimer.value) {
    clearTimeout(noteDragStartTimer.value);
  }
  noteMouseDownPos.value = null;
  canDragNote.value = false;
}

function handleDragStart(event: DragEvent, pageId: string) {
  console.log('[NoteListColumn] handleDragStart called', {
    pageId,
    canDragNote: canDragNote.value,
    selectedFolderId: props.selectedFolderId
  });

  if (!canDragNote.value) {
    console.log('[NoteListColumn] handleDragStart prevented - canDragNote is false');
    event.preventDefault();
    return;
  }

  if (!event.dataTransfer) {
    console.log('[NoteListColumn] handleDragStart - no dataTransfer');
    return;
  }

  draggingNoteId.value = pageId;

  // Store note data
  const dragData = {
    type: 'note',
    pageId: pageId,
    sectionId: props.selectedFolderId
  };
  console.log('[NoteListColumn] handleDragStart setting drag data:', dragData);

  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify(dragData));

  // Add visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '0.5';
  }
}

function handleDragEnd(event: DragEvent) {
  draggingNoteId.value = null;
  dragOverTop.value = false;
  canDragNote.value = false;
  noteMouseDownPos.value = null;

  if (noteDragStartTimer.value) {
    clearTimeout(noteDragStartTimer.value);
    noteDragStartTimer.value = null;
  }

  // Remove visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '1';
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (noteDragStartTimer.value) {
    clearTimeout(noteDragStartTimer.value);
  }
});

function handleDragOver(event: DragEvent, pageId: string) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  event.dataTransfer.dropEffect = 'move';
  dragOverNoteId.value = pageId;
  dragOverTop.value = false;
}

function handleDragLeave() {
  dragOverNoteId.value = null;
}

function handleDragOverTop(event: DragEvent) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  event.dataTransfer.dropEffect = 'move';
  dragOverTop.value = true;
  dragOverNoteId.value = null;
}

function handleDragLeaveTop() {
  dragOverTop.value = false;
}

async function handleDropTop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragOverTop.value = false;

  console.log('[NoteListColumn] handleDropAtTop called', {
    hasDataTransfer: !!event.dataTransfer,
    selectedFolderId: props.selectedFolderId
  });

  if (!event.dataTransfer || !props.selectedFolderId) {
    console.log('[NoteListColumn] handleDropAtTop early return - missing dataTransfer or selectedFolderId');
    return;
  }

  try {
    const dataString = event.dataTransfer.getData('application/json');
    console.log('[NoteListColumn] handleDropAtTop dataTransfer raw data:', dataString);

    const data = JSON.parse(dataString);
    console.log('[NoteListColumn] handleDropAtTop parsed drag data:', data);

    if (data.type === 'note') {
      const draggedNoteId = data.pageId;
      console.log('[NoteListColumn] handleDropAtTop calling reorderNote', {
        draggedNoteId,
        sectionId: props.selectedFolderId,
        newIndex: 0
      });

      // Reorder the note to index 0 (top of list)
      await notesStore.reorderNote(draggedNoteId, props.selectedFolderId, 0);
      console.log('[NoteListColumn] handleDropAtTop reorderNote completed successfully');
    } else {
      console.log('[NoteListColumn] handleDropAtTop skipping - wrong type');
    }
  } catch (error) {
    console.error('Failed to handle note drop at top:', error);
  }
}

async function handleDrop(event: DragEvent, targetNoteId: string, targetIndex: number) {
  event.preventDefault();
  event.stopPropagation();
  dragOverNoteId.value = null;

  console.log('[NoteListColumn] handleDrop called', {
    hasDataTransfer: !!event.dataTransfer,
    selectedFolderId: props.selectedFolderId,
    targetNoteId,
    targetIndex
  });

  if (!event.dataTransfer || !props.selectedFolderId) {
    console.log('[NoteListColumn] handleDrop early return - missing dataTransfer or selectedFolderId');
    return;
  }

  try {
    const dataString = event.dataTransfer.getData('application/json');
    console.log('[NoteListColumn] dataTransfer raw data:', dataString);

    const data = JSON.parse(dataString);
    console.log('[NoteListColumn] parsed drag data:', data);

    if (data.type === 'note' && data.pageId !== targetNoteId) {
      const draggedNoteId = data.pageId;

      console.log('[NoteListColumn] Current displayNotes order:', displayNotes.value.map((n, i) => ({
        index: i,
        id: n.id.substring(0, 8),
        title: n.title.substring(0, 20)
      })));

      const currentVisualIndex = displayNotes.value.findIndex(n => n.id === draggedNoteId);

      console.log('[NoteListColumn] Calling reorderNote', {
        draggedNoteId: draggedNoteId.substring(0, 8),
        draggedNoteTitle: displayNotes.value.find(n => n.id === draggedNoteId)?.title.substring(0, 20),
        currentVisualIndex: currentVisualIndex,
        targetNoteId: targetNoteId.substring(0, 8),
        targetNoteTitle: displayNotes.value.find(n => n.id === targetNoteId)?.title.substring(0, 20),
        targetVisualIndex: targetIndex,
        newIndexToSend: targetIndex + 1,
        note: 'Inserting AFTER target (line shows at bottom)',
        sectionId: props.selectedFolderId
      });

      // Reorder the note to after the target position (since line shows at bottom of note)
      await notesStore.reorderNote(draggedNoteId, props.selectedFolderId, targetIndex + 1);
      console.log('[NoteListColumn] reorderNote completed successfully');
    } else {
      console.log('[NoteListColumn] Skipping reorder - same note or wrong type');
    }
  } catch (error) {
    console.error('Failed to handle note drop:', error);
  }
}
</script>
