<script setup lang="ts">
import type { Folder } from '~/models';

interface Props {
  folder: Section;
  selectedId: number | null;
  isExpanded?: boolean;
  openMenuId?: number | null;
  draggedFolderId?: number | null;
  dragOverFolderId?: number | null;
}

interface Emits {
  (e: 'select', sectionId: number): void;
  (e: 'toggle', sectionId: number): void;
  (e: 'create-note', sectionId: number): void;
  (e: 'create-quick-note', sectionId: number): void;
  (e: 'create-list-note', sectionId: number): void;
  (e: 'create-template-note', sectionId: number): void;
  (e: 'create-ai-note', sectionId: number): void;
  (e: 'import-recipe', sectionId: number): void;
  (e: 'rename', sectionId: number): void;
  (e: 'edit', folder: Section): void;
  (e: 'delete', sectionId: number): void;
  (e: 'move-up', sectionId: number): void;
  (e: 'move-down', sectionId: number): void;
  (e: 'reorder-folder', sectionId: number, newIndex: number): void;
  (e: 'update:openMenuId', value: number | null): void;
  (e: 'drag-start', sectionId: number): void;
  (e: 'drag-end'): void;
  (e: 'drag-over', event: DragEvent, sectionId: number): void;
  (e: 'drag-leave'): void;
  (e: 'drop', event: DragEvent, sectionId: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  openMenuId: null,
  draggedFolderId: null,
  dragOverFolderId: null
});

const emit = defineEmits<Emits>();
const foldersStore = useFoldersStore();
const notesStore = useNotesStore();
const authStore = useAuthStore();
const toast = useToast();

function copyId(id: number) {
  if (process.client) {
    navigator.clipboard.writeText(String(id));
    toast.success('Folder ID copied to clipboard');
  }
}

// Get note count for this folder
const noteCount = computed(() => {
  return notesStore.notes.filter(note => 
    note.section_id === props.folder.id && !note.share_permission
  ).length;
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

const contextMenuButtonRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ top: 0, left: 0, bottom: 0 });
const menuOpensUpward = ref(false);

const isMenuOpen = computed(() => props.openMenuId === props.folder.id);

// Helper to detect mobile devices (viewport width < 1024px)
function isMobile(): boolean {
  if (!process.client) return false;
  return window.innerWidth < 1024;
}

function isUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('/') || value.startsWith('http');
}

function handleSelect() {
  emit('select', props.folder.id);
}

function openEditModal() {
  emit('edit', props.folder);
  emit('update:openMenuId', null);
}

function toggleContextMenu(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();

  if (!process.client) return;

  // Calculate position for the menu
  if (contextMenuButtonRef.value) {
    const rect = contextMenuButtonRef.value.getBoundingClientRect();
    const menuWidth = 192; // 192px = w-48
    const viewportWidth = window.innerWidth;

    // Position directly to the right of the button
    let left = rect.right + 4;

    // If menu would overflow on the right, position it to the left instead
    if (left + menuWidth > viewportWidth - 8) {
      left = rect.left - menuWidth - 4;
      if (left < 8) {
        left = 8;
      }
    }

    // Align top of menu with top of button (like space menu)
    const top = rect.top;

    menuPosition.value = {
      top: top,
      left: left,
      bottom: 0
    };
    menuOpensUpward.value = false;
  }

  if (isMenuOpen.value) {
    emit('update:openMenuId', null);
  } else {
    emit('update:openMenuId', props.folder.id);
  }
}

// Drag and drop functionality
const isDragging = ref(false);
const isDragOver = ref(false);
const canDrag = ref(false);
const dragStartTimer = ref<NodeJS.Timeout | null>(null);
const mouseDownPos = ref<{ x: number; y: number } | null>(null);

function handleMouseDown(event: MouseEvent) {
  // Don't initiate drag on context menu button
  const target = event.target as HTMLElement;
  if (target.closest('[data-context-menu-button]')) {
    return;
  }

  mouseDownPos.value = { x: event.clientX, y: event.clientY };

  // Allow drag after 200ms delay or 5px movement
  dragStartTimer.value = setTimeout(() => {
    canDrag.value = true;
  }, 200);
}

function handleMouseMove(event: MouseEvent) {
  if (!mouseDownPos.value || canDrag.value) return;

  const deltaX = Math.abs(event.clientX - mouseDownPos.value.x);
  const deltaY = Math.abs(event.clientY - mouseDownPos.value.y);

  // If moved more than 5px, allow drag immediately
  if (deltaX > 5 || deltaY > 5) {
    if (dragStartTimer.value) {
      clearTimeout(dragStartTimer.value);
    }
    canDrag.value = true;
  }
}

function handleMouseUp() {
  if (dragStartTimer.value) {
    clearTimeout(dragStartTimer.value);
  }
  mouseDownPos.value = null;
  canDrag.value = false;
}

function handleDragStart(event: DragEvent) {
  if (!canDrag.value) {
    event.preventDefault();
    return;
  }

  if (!event.dataTransfer) return;
  isDragging.value = true;

  // Store folder data
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'folder',
    sectionId: props.folder.id,
    notebookId: props.folder.notebook_id
  }));

  // Add visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '0.5';
  }

  // Emit drag start
  emit('drag-start', props.folder.id);
}

function handleDragEnd(event: DragEvent) {
  isDragging.value = false;
  canDrag.value = false;
  mouseDownPos.value = null;

  if (dragStartTimer.value) {
    clearTimeout(dragStartTimer.value);
    dragStartTimer.value = null;
  }

  // Remove visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '1';
  }

  // Emit drag end
  emit('drag-end');
}

// Click outside handler to close menu
function handleClickOutside(event: MouseEvent) {
  if (!isMenuOpen.value) return;

  const target = event.target as HTMLElement;
  // Don't close if clicking on the menu itself or the button
  if (target.closest('[data-context-menu]') || target.closest('[data-context-menu-button]')) {
    return;
  }

  emit('update:openMenuId', null);
}

// Setup and cleanup click outside listener
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  if (dragStartTimer.value) {
    clearTimeout(dragStartTimer.value);
  }
});

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  const hasData = event.dataTransfer.types.includes('application/json');
  if (!hasData) return;

  event.dataTransfer.dropEffect = 'move';

  // Emit for folder reordering
  emit('drag-over', event, props.folder.id);

  // Show visual feedback for note drops
  try {
    // We can't access dataTransfer.getData during dragover, so show indicator for all drags
    isDragOver.value = true;
  } catch (error) {
    // Ignore
  }
}

function handleDragLeave() {
  isDragOver.value = false;
  emit('drag-leave');
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'folder') {
      // Emit for folder reordering
      emit('drop', event, props.folder.id);
    } else if (data.type === 'note') {
      // Handle note drops
      const draggedNoteId = data.pageId;
      const targetFolderId = props.folder.id;

      const note = notesStore.notes.find(n => n.id === draggedNoteId);
      if (note && note.section_id !== targetFolderId) {
        await notesStore.moveNote(draggedNoteId, targetFolderId);
      }
    }
  } catch (error) {
    console.error('Failed to handle drop:', error);
  }
}
</script>

<template>
  <!-- Folder Item - Premium Apple Design (wrapped in single root for TransitionGroup) -->
  <div class="folder-tree-item-wrapper">
    <div
    draggable="true"
    class="folder-item group/folder relative flex items-center gap-2 transition-all duration-150 active:bg-gray-100 dark:active:bg-gray-700 cursor-grab active:cursor-grabbing border-l-2 border-t-2"
    :data-folder-id="folder.id"
    :class="{
      'bg-gray-50 dark:bg-gray-800/50 border-l-blue-600 dark:border-l-blue-400 [border-left-width:3px]': selectedId === folder.id,
      'border-l-transparent md:hover:bg-gray-50 dark:hover:bg-gray-800': selectedId !== folder.id,
      'opacity-50': isDragging,
      'bg-blue-50 dark:bg-blue-900/20': isDragOver && dragOverFolderId !== folder.id,
      'border-t-blue-500 dark:border-t-blue-400 [border-top-width:3px]': dragOverFolderId === folder.id,
      'border-t-transparent': dragOverFolderId !== folder.id
    }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    >
      <div class="w-4" /> <!-- Spacing instead of expand button -->

      <!-- Folder Button -->
      <button
        @click.stop="handleSelect"
        @dblclick.stop="openEditModal"
        draggable="false"
        class="flex-1 flex items-center gap-2.5 py-2.5 pr-2 font-normal transition-colors min-w-0 text-gray-900 dark:text-gray-100 active:bg-gray-100 dark:active:bg-gray-700"
        :class="{ 'md:hover:bg-gray-50 dark:hover:bg-gray-800': selectedId !== folder.id }"
        :style="{ fontSize: 'clamp(0.875rem, 0.6vw + 0.5rem, 1rem)' }"
      >
        <img 
          v-if="isUrl(folder.icon)" 
          :src="folder.icon!" 
          class="w-5 h-5 flex-shrink-0 object-contain rounded-sm"
        />
        <UIcon
          :name="folder.icon ? `i-lucide-${folder.icon}` : 'i-heroicons-folder'"
          class="w-5 h-5 flex-shrink-0 transition-colors text-gray-700 dark:text-gray-300"
        />
        <span class="truncate flex-1 text-left font-normal">{{ folder.name }}</span>
        <!-- Developer UI: ID Badge -->
        <button 
          v-if="authStore.isDeveloperUIEnabled"
          class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50 mr-2 cursor-copy hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
          @click.stop="copyId(folder.id)"
          title="Click to copy Folder ID"
        >
          ID:{{ folder.id }}
        </button>
        <span 
          v-if="noteCount > 0"
          class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0 font-normal text-xs"
          :style="{ fontSize: 'clamp(0.7rem, 0.4vw + 0.4rem, 0.8rem)' }"
        >
          {{ noteCount }}
        </span>
      </button>

      <!-- Context Menu Button -->
      <button
        ref="contextMenuButtonRef"
        data-context-menu-button
        type="button"
        @click.stop="toggleContextMenu"
        @mousedown.stop
        draggable="false"
        class="no-drag flex-shrink-0 p-1 hidden md:flex opacity-100 md:opacity-0 md:group-hover/folder:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
        :class="isMenuOpen ? 'bg-gray-200 dark:bg-gray-700' : ''"
      >
        <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
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
          v-if="isMenuOpen"
          data-context-menu
          @click.stop
          class="fixed w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 z-[9999]"
          :style="{ 
            top: menuOpensUpward ? 'auto' : `${menuPosition.top}px`, 
            bottom: menuOpensUpward ? `${menuPosition.bottom}px` : 'auto',
            left: `${menuPosition.left}px` 
          }"
        >
          <button
            type="button"
            @click="openEditModal"
            class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 flex items-center gap-2"
          >
            <UIcon name="i-heroicons-pencil" class="w-5 h-5" />
            <span>Edit</span>
          </button>
          
          <button
            type="button"
            @click="emit('delete', folder.id); emit('update:openMenuId', null)"
            class="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 flex items-center gap-2"
          >
            <UIcon name="i-heroicons-trash" class="w-5 h-5" />
            <span>Delete</span>
          </button>
        </div>
      </Transition>
      <!-- Backdrop for mobile - closes menu when clicking outside -->
      <div
        v-if="isMenuOpen && isMobile()"
        class="fixed inset-0 z-[9998] md:hidden"
        @click="emit('update:openMenuId', null)"
      />
    </Teleport>
  </div>
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

.folder-item {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
</style>
