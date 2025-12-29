<template>
  <aside
    v-if="!isFullscreen"
    class="hidden lg:flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 flex-shrink-0 relative overflow-x-hidden"
    :style="{ width: `${sidebarWidth}px` }"
  >
    <!-- Resize Handle -->
    <div
      @mousedown.stop="handleSidebarResizeStart"
      @dragstart.prevent.stop
      draggable="false"
      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 z-50 pointer-events-auto"
      style="margin-right: -2px;"
    />

    <!-- Header -->
    <div class="h-12 flex items-center justify-between px-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 font-medium text-sm px-2 py-1 text-gray-900 dark:text-gray-100">
          <UIcon name="i-heroicons-book-open" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>Notebooks</span>
        </div>

        <button
          @click="$emit('open-search')"
          class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          title="Search Notes"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
        </button>
      </div>
      <button
        @click="$emit('open-create-space')"
        class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
        title="New Notebook"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
      </button>
    </div>

    <!-- Notebooks List -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-1">
      <TransitionGroup name="space-list">
        <div
          v-for="space in spacesStore.spaces"
          :key="space.id"
          class="space-item mb-0.5"
        >
          <!-- Notebook Header -->
          <div
            draggable="true"
            class="space-item-header group/space relative flex items-center gap-1 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 overflow-hidden min-w-0 cursor-grab active:cursor-grabbing border-t-2"
            :class="{
              'bg-blue-50 dark:bg-blue-900/20': dragOverSpaceId === space.id && !spacesStore.expandedSpaceIds.has(space.id),
              'opacity-50': isDraggingSpace && draggedSpaceId === space.id,
              'border-t-blue-500 dark:border-t-blue-400 [border-top-width:3px]': dragOverSpaceReorderId === space.id,
              'border-t-transparent': dragOverSpaceReorderId !== space.id
            }"
            @mousedown="handleSpaceMouseDown($event, space.id)"
            @mousemove="handleSpaceMouseMove"
            @mouseup="handleSpaceMouseUp"
            @dragstart="handleSpaceDragStart($event, space.id)"
            @dragend="handleSpaceDragEnd"
            @dragover="handleSpaceReorderDragOver($event, space.id)"
            @dragleave="handleSpaceReorderDragLeave"
            @drop="handleSpaceReorderDrop($event, space.id)"
          >
            <button
              @click="handleSelectSpace(space.id)"
              draggable="false"
              class="space-button flex-1 flex items-center gap-2 px-2 py-2.5 transition-colors text-left min-w-0"
            >
              <UIcon
                :name="spacesStore.expandedSpaceIds.has(space.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
              />
              <img
                v-if="isUrl(space.icon)"
                :src="space.icon!"
                class="w-5 h-5 object-contain rounded-sm flex-shrink-0"
              />
              <UIcon
                v-else
                :name="space.icon ? `i-lucide-${space.icon}` : 'i-heroicons-book-open'"
                class="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0"
              />
              <span class="font-normal text-sm lg:text-base truncate flex-1 text-gray-900 dark:text-gray-100">{{ space.name }}</span>
            </button>

            <!-- Context Menu Button -->
            <button
              type="button"
              @click.stop="toggleSpaceMenu(space.id, $event)"
              @mousedown.stop
              draggable="false"
              class="no-drag flex-shrink-0 p-1 opacity-100 lg:opacity-0 lg:group-hover/space:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
              :class="showSpaceMenuId === space.id ? 'bg-gray-200 dark:bg-gray-700' : ''"
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
            <div
              v-if="showSpaceMenuId === space.id"
              @click.stop
              class="fixed w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 z-[9999]"
              :style="spaceMenuPosition"
            >
              <button
                type="button"
                @click="editSpace(space)"
                class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-pencil" class="w-4 h-4" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                @click="deleteSpace(space.id)"
                class="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </Teleport>
        </ClientOnly>

        <!-- Sections (Folders) -->
        <div v-show="spacesStore.expandedSpaceIds.has(space.id)">
          <div class="relative pl-6 space-y-0.5 min-h-[5px]">
            <!-- Vertical ruler line -->
            <div
              class="absolute left-[18px] top-0 bottom-0 w-[1px] bg-gray-200 dark:bg-gray-700"
              aria-hidden="true"
            />
            <!-- Drop zone at top of folder list -->
            <div
              @dragover="handleDragOverTopOfSpace($event, space.id)"
              @dragleave="handleDragLeaveTopOfSpace"
              @drop="handleDropTopOfSpace($event, space.id)"
              class="h-1 transition-all border-t-2 relative"
              :class="{
                '[border-top-width:3px] border-t-blue-500 dark:border-t-blue-400 h-2': dragOverTopOfSpace === space.id,
                'border-t-transparent': dragOverTopOfSpace !== space.id
              }"
            />
            <TransitionGroup name="folder-list">
              <FolderTreeItem
                v-for="folder in getSpaceFolders(space.id, foldersStore.folders)"
                :key="folder.id"
                :folder="folder"
                :selected-id="selectedFolderId"
                :open-menu-id="openFolderMenuId"
                :dragged-folder-id="draggedFolderId"
                :drag-over-folder-id="dragOverFolderReorderId"
                @select="(id) => $emit('select-folder', id)"
                @create-note="(id) => $emit('create-note-in-folder', id)"
                @delete="(id) => $emit('delete-folder', id)"
                @edit="(folder) => $emit('edit-folder', folder)"
                @update:openMenuId="openFolderMenuId = $event"
                @drag-start="handleFolderDragStart"
                @drag-end="handleFolderDragEnd"
                @drag-over="handleFolderReorderDragOver"
                @drag-leave="handleFolderReorderDragLeave"
                @drop="handleFolderReorderDrop"
              />
            </TransitionGroup>
            <!-- Drop zone at bottom of folder list -->
            <div
              @dragover="handleDragOverBottomOfSpace($event, space.id)"
              @dragleave="handleDragLeaveBottomOfSpace"
              @drop="handleDropBottomOfSpace($event, space.id)"
              class="h-1 transition-all border-t-2 relative"
              :class="{
                '[border-top-width:3px] border-t-blue-500 dark:border-t-blue-400 h-2': dragOverBottomOfSpace === space.id,
                'border-t-transparent': dragOverBottomOfSpace !== space.id
              }"
            />
          </div>

          <!-- New Section Button -->
          <div class="pl-6 mt-0.5">
            <div
              class="relative flex items-center gap-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group"
              @click="$emit('open-create-folder', space.id)"
            >
              <div class="w-4" />
              <div class="flex-1 flex items-center gap-2 py-1.5 pr-2 text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
                <span class="font-normal">New Section</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </TransitionGroup>

      <!-- Drop zone at bottom of spaces list -->
      <div
        @dragover="handleDragOverBottomOfSpacesList"
        @dragleave="handleDragLeaveBottomOfSpacesList"
        @drop="handleDropBottomOfSpacesList"
        class="h-2 transition-all border-t-2"
        :class="{
          '[border-top-width:3px] border-t-blue-500 dark:border-t-blue-400 h-3': dragOverBottomOfSpacesList,
          'border-t-transparent': !dragOverBottomOfSpacesList
        }"
      />
    </div>

    <!-- User Footer -->
    <div class="p-3 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden rounded-full">
          <img
            v-if="cachedProfilePicture"
            :src="cachedProfilePicture"
            class="w-full h-full object-cover"
          />
          <span v-else>{{ authStore.currentUser?.name?.[0] || 'U' }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-normal truncate text-gray-900 dark:text-gray-100">{{ authStore.currentUser?.name }}</div>
        </div>
        <div class="flex items-center gap-0.5">
          <NuxtLink
            to="/settings"
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title="Settings"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4" />
          </NuxtLink>
          <button
            @click="$emit('logout')"
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Sign Out"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Space } from '~/types';
import { getSpaceFolders, isUrl } from '~/utils/notesHelpers';

interface Props {
  selectedFolderId: number | null
  isFullscreen: boolean
  sidebarWidth: number
}

interface Emits {
  (e: 'update:sidebarWidth', width: number): void
  (e: 'select-folder', sectionId: number): void
  (e: 'create-note-in-folder', sectionId: number): void
  (e: 'open-search'): void
  (e: 'open-create-space'): void
  (e: 'open-create-folder', notebookId?: number): void
  (e: 'logout'): void
  (e: 'edit-folder', folder: any): void
  (e: 'delete-folder', sectionId: number): void
  (e: 'edit-space', space: Notebook): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const spacesStore = useSpacesStore();
const foldersStore = useFoldersStore();
const authStore = useAuthStore();
const { cachedImageUrl: cachedProfilePicture } = useCachedProfilePicture(authStore.user?.id, authStore.user?.profile_picture_url);
const { handleSidebarResizeStart } = useSidebarResize((width) => emit('update:sidebarWidth', width));
const { handleSelectSpace, handleDeleteSpace } = useSpaceActions();

const showSpaceMenuId = ref<number | null>(null);
const openFolderMenuId = ref<number | null>(null);
const spaceMenuPosition = ref({ top: '0px', left: '0px' });

// Drag and drop state for folders
const dragOverSpaceId = ref<number | null>(null);
const dragOverTopOfSpace = ref<number | null>(null);
const dragOverBottomOfSpace = ref<number | null>(null);
const expandTimer = ref<NodeJS.Timeout | null>(null);
const draggedFolderId = ref<number | null>(null);
const dragOverFolderReorderId = ref<number | null>(null);

// Drag and drop state for spaces
const draggedSpaceId = ref<number | null>(null);
const isDraggingSpace = ref(false);
const canDragSpace = ref(false);
const dragStartSpaceTimer = ref<NodeJS.Timeout | null>(null);
const mouseDownSpacePos = ref<{ x: number; y: number } | null>(null);
const dragOverSpaceReorderId = ref<number | null>(null);
const dragOverBottomOfSpacesList = ref(false);
const expandedSpacesBeforeDrag = ref<Set<number>>(new Set());

function toggleSpaceMenu(notebookId: number, event: MouseEvent) {
  event.stopPropagation();
  if (showSpaceMenuId.value === notebookId) {
    showSpaceMenuId.value = null;
  } else {
    showSpaceMenuId.value = notebookId;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    spaceMenuPosition.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`
    };
  }
}

function editSpace(space: Notebook) {
  showSpaceMenuId.value = null;
  emit('edit-space', space);
}

function deleteSpace(notebookId: number) {
  showSpaceMenuId.value = null;
  handleDeleteSpace(notebookId);
}

// Drag and drop handlers for auto-expanding spaces
function handleSpaceDragOver(event: DragEvent, notebookId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  const data = event.dataTransfer.types.includes('application/json');
  if (!data) return;

  dragOverSpaceId.value = notebookId;

  // If space is not expanded, set a timer to auto-expand
  if (!spacesStore.expandedSpaceIds.has(notebookId)) {
    if (!expandTimer.value) {
      expandTimer.value = setTimeout(() => {
        spacesStore.expandSpace(notebookId);
        expandTimer.value = null;
      }, 800); // Auto-expand after 800ms
    }
  }
}

function handleSpaceDragLeave(notebookId: number) {
  if (dragOverSpaceId.value === notebookId) {
    dragOverSpaceId.value = null;
  }

  // Clear expand timer
  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}

function handleSpaceDrop(event: DragEvent, notebookId: number) {
  event.preventDefault();
  dragOverSpaceId.value = null;

  // Clear expand timer
  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}

// Drop zone at top of folder list handlers
function handleDragOverTopOfSpace(event: DragEvent, notebookId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  // Only show indicator when dragging folders, not spaces
  if (isDraggingSpace.value) {
    dragOverTopOfSpace.value = null;
    return;
  }

  event.dataTransfer.dropEffect = 'move';
  dragOverTopOfSpace.value = notebookId;
}

function handleDragLeaveTopOfSpace() {
  dragOverTopOfSpace.value = null;
}

async function handleDropTopOfSpace(event: DragEvent, notebookId: number) {
  event.preventDefault();
  event.stopPropagation();
  dragOverTopOfSpace.value = null;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'folder') {
      const draggedFolderId = data.sectionId;
      const draggedSpaceId = data.notebookId;
      const draggedFolder = foldersStore.getFolderById(draggedFolderId);

      if (!draggedFolder) return;

      const isCrossSpace = draggedSpaceId !== notebookId;

      if (isCrossSpace) {
        // Do optimistic update locally ONCE with final position
        const oldSpaceId = draggedFolder.notebook_id;

        // 1. Update space_id
        draggedFolder.notebook_id = notebookId;

        // 2. Remove from old position
        const allFolders = [...foldersStore.folders];
        const draggedIndex = allFolders.findIndex(f => f.id === draggedFolderId);
        allFolders.splice(draggedIndex, 1);

        // 3. Get new space folders and insert at position 0
        const newSpaceFolders = allFolders.filter(f => f.notebook_id === notebookId);
        const otherFolders = allFolders.filter(f => f.notebook_id !== notebookId);
        newSpaceFolders.unshift(draggedFolder);

        // 4. Update store in one go
        foldersStore.folders = [...otherFolders, ...newSpaceFolders];

        // Now make API calls in background
        try {
          await foldersStore.moveFolder(draggedFolderId, notebookId);
          await foldersStore.reorderFolder(draggedFolderId, 0);
        } catch (error) {
          // Revert on error
          draggedFolder.notebook_id = oldSpaceId;
          await foldersStore.fetchFolders(undefined, true);
          throw error;
        }
      } else {
        // Same space, just reorder
        await foldersStore.reorderFolder(draggedFolderId, 0);
      }
    }
  } catch (error) {
    console.error('Failed to handle folder drop at top:', error);
  }
}

// Drop zone at bottom of folder list handlers
function handleDragOverBottomOfSpace(event: DragEvent, notebookId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  // Only show indicator when dragging folders, not spaces
  if (isDraggingSpace.value) {
    dragOverBottomOfSpace.value = null;
    return;
  }

  event.dataTransfer.dropEffect = 'move';
  dragOverBottomOfSpace.value = notebookId;
}

function handleDragLeaveBottomOfSpace() {
  dragOverBottomOfSpace.value = null;
}

async function handleDropBottomOfSpace(event: DragEvent, notebookId: number) {
  event.preventDefault();
  event.stopPropagation();
  dragOverBottomOfSpace.value = null;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'folder') {
      const draggedFolderId = data.sectionId;
      const draggedSpaceId = data.notebookId;
      const draggedFolder = foldersStore.getFolderById(draggedFolderId);

      if (!draggedFolder) return;

      const isCrossSpace = draggedSpaceId !== notebookId;

      // Calculate the last position
      const foldersInSpace = foldersStore.folders.filter(f => f.notebook_id === notebookId && f.id !== draggedFolderId);
      const lastIndex = foldersInSpace.length;

      if (isCrossSpace) {
        // Do optimistic update locally ONCE with final position
        const oldSpaceId = draggedFolder.notebook_id;

        // 1. Update space_id
        draggedFolder.notebook_id = notebookId;

        // 2. Remove from old position
        const allFolders = [...foldersStore.folders];
        const draggedIndex = allFolders.findIndex(f => f.id === draggedFolderId);
        allFolders.splice(draggedIndex, 1);

        // 3. Get new space folders and insert at last position
        const newSpaceFolders = allFolders.filter(f => f.notebook_id === notebookId);
        const otherFolders = allFolders.filter(f => f.notebook_id !== notebookId);
        newSpaceFolders.push(draggedFolder);

        // 4. Update store in one go
        foldersStore.folders = [...otherFolders, ...newSpaceFolders];

        // Now make API calls in background
        try {
          await foldersStore.moveFolder(draggedFolderId, notebookId);
          await foldersStore.reorderFolder(draggedFolderId, lastIndex);
        } catch (error) {
          // Revert on error
          draggedFolder.notebook_id = oldSpaceId;
          await foldersStore.fetchFolders(undefined, true);
          throw error;
        }
      } else {
        // Same space, just reorder
        await foldersStore.reorderFolder(draggedFolderId, lastIndex);
      }
    }
  } catch (error) {
    console.error('Failed to handle folder drop at bottom:', error);
  }
}

// Folder drag handlers
function handleFolderDragStart(sectionId: number) {
  draggedFolderId.value = sectionId;
  dragOverSpaceReorderId.value = null; // Clear space indicator when dragging folder
}

function handleFolderDragEnd() {
  draggedFolderId.value = null;
  dragOverFolderReorderId.value = null;
  dragOverSpaceReorderId.value = null;
}

function handleFolderReorderDragOver(event: DragEvent, sectionId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  const hasData = event.dataTransfer.types.includes('application/json');
  if (!hasData) return;

  // Don't show indicator if dragging over self
  if (draggedFolderId.value === sectionId) {
    dragOverFolderReorderId.value = null;
    return;
  }

  event.dataTransfer.dropEffect = 'move';
  dragOverFolderReorderId.value = sectionId;
}

function handleFolderReorderDragLeave() {
  dragOverFolderReorderId.value = null;
}

async function handleFolderReorderDrop(event: DragEvent, targetFolderId: number) {
  event.preventDefault();
  event.stopPropagation();
  dragOverFolderReorderId.value = null;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'folder' && data.sectionId !== targetFolderId) {
      const draggedFolderId = data.sectionId;
      const draggedFolder = foldersStore.getFolderById(draggedFolderId);
      const targetFolder = foldersStore.getFolderById(targetFolderId);

      if (!draggedFolder || !targetFolder) return;

      const isCrossSpace = draggedFolder.notebook_id !== targetFolder.notebook_id;

      // Calculate target index
      const targetSpaceFolders = foldersStore.folders.filter(f => f.notebook_id === targetFolder.notebook_id);
      const targetIndex = targetSpaceFolders.findIndex(f => f.id === targetFolderId);

      if (targetIndex < 0) return;

      if (isCrossSpace) {
        // Do optimistic update locally ONCE with final position
        const oldSpaceId = draggedFolder.notebook_id;

        // 1. Update space_id
        draggedFolder.notebook_id = targetFolder.notebook_id;

        // 2. Remove from old position
        const allFolders = [...foldersStore.folders];
        const draggedIndex = allFolders.findIndex(f => f.id === draggedFolderId);
        allFolders.splice(draggedIndex, 1);

        // 3. Get new space folders and insert at correct position
        const newSpaceFolders = allFolders.filter(f => f.notebook_id === targetFolder.notebook_id);
        const otherFolders = allFolders.filter(f => f.notebook_id !== targetFolder.notebook_id);
        newSpaceFolders.splice(targetIndex, 0, draggedFolder);

        // 4. Update store in one go
        foldersStore.folders = [...otherFolders, ...newSpaceFolders];

        // Now make API calls in background
        try {
          await foldersStore.moveFolder(draggedFolderId, targetFolder.notebook_id);
          await foldersStore.reorderFolder(draggedFolderId, targetIndex);
        } catch (error) {
          // Revert on error
          draggedFolder.notebook_id = oldSpaceId;
          await foldersStore.fetchFolders(undefined, true);
          throw error;
        }
      } else {
        // Same space, just reorder
        await foldersStore.reorderFolder(draggedFolderId, targetIndex);
      }
    }
  } catch (error) {
    console.error('Failed to handle folder drop:', error);
  }
}

// Space drag handlers
function handleSpaceMouseDown(event: MouseEvent, notebookId: number) {
  // Don't initiate drag on context menu button
  const target = event.target as HTMLElement;
  if (target.closest('button[type="button"]')) {
    return;
  }

  mouseDownSpacePos.value = { x: event.clientX, y: event.clientY };
  draggedSpaceId.value = notebookId;

  // Allow drag after 200ms delay or 5px movement
  dragStartSpaceTimer.value = setTimeout(() => {
    canDragSpace.value = true;
  }, 200);
}

function handleSpaceMouseMove(event: MouseEvent) {
  if (!mouseDownSpacePos.value || canDragSpace.value) return;

  const deltaX = Math.abs(event.clientX - mouseDownSpacePos.value.x);
  const deltaY = Math.abs(event.clientY - mouseDownSpacePos.value.y);

  // If moved more than 5px, allow drag immediately
  if (deltaX > 5 || deltaY > 5) {
    if (dragStartSpaceTimer.value) {
      clearTimeout(dragStartSpaceTimer.value);
    }
    canDragSpace.value = true;
  }
}

function handleSpaceMouseUp() {
  if (dragStartSpaceTimer.value) {
    clearTimeout(dragStartSpaceTimer.value);
  }
  mouseDownSpacePos.value = null;
  canDragSpace.value = false;
}

function handleSpaceDragStart(event: DragEvent, notebookId: number) {
  if (!canDragSpace.value) {
    event.preventDefault();
    return;
  }

  if (!event.dataTransfer) return;
  isDraggingSpace.value = true;

  // Store space data
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'space',
    notebookId: notebookId
  }));

  // Save currently expanded spaces and collapse all
  expandedSpacesBeforeDrag.value = new Set(spacesStore.expandedSpaceIds);
  spacesStore.expandedSpaceIds.clear();
  spacesStore.expandedSpaceIds = new Set(); // Trigger reactivity

  // Add visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '0.5';
  }
}

function handleSpaceDragEnd(event: DragEvent) {
  isDraggingSpace.value = false;
  canDragSpace.value = false;
  mouseDownSpacePos.value = null;
  draggedSpaceId.value = null;
  dragOverSpaceReorderId.value = null;
  dragOverBottomOfSpacesList.value = false;

  if (dragStartSpaceTimer.value) {
    clearTimeout(dragStartSpaceTimer.value);
    dragStartSpaceTimer.value = null;
  }

  // Restore expanded spaces
  spacesStore.expandedSpaceIds = new Set(expandedSpacesBeforeDrag.value);
  expandedSpacesBeforeDrag.value = new Set();

  // Remove visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '1';
  }
}

function handleSpaceReorderDragOver(event: DragEvent, notebookId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  const hasData = event.dataTransfer.types.includes('application/json');
  if (!hasData) return;

  // Only show indicator for space drags, not folder drags
  try {
    // Check if we're dragging a space (only spaces can be reordered here)
    const types = Array.from(event.dataTransfer.types);
    if (!types.includes('application/json')) {
      dragOverSpaceReorderId.value = null;
      return;
    }
  } catch (error) {
    // Can't determine type during dragover, ignore
  }

  // Don't show indicator if dragging over self
  if (draggedSpaceId.value === notebookId) {
    dragOverSpaceReorderId.value = null;
    return;
  }

  // Only show indicator if we're actually dragging a space
  // (All spaces are collapsed during drag, so no need to check for expanded state)
  if (isDraggingSpace.value) {
    event.dataTransfer.dropEffect = 'move';
    dragOverSpaceReorderId.value = notebookId;
  } else if (draggedFolderId.value) {
    // Dragging a folder - enable auto-expand for collapsed spaces
    dragOverSpaceReorderId.value = null;

    // If space is not expanded, set a timer to auto-expand
    if (!spacesStore.expandedSpaceIds.has(notebookId)) {
      if (!expandTimer.value) {
        expandTimer.value = setTimeout(() => {
          spacesStore.expandSpace(notebookId);
          expandTimer.value = null;
        }, 800); // Auto-expand after 800ms
      }
    }
  } else {
    // Not dragging a space or folder, don't show indicator
    dragOverSpaceReorderId.value = null;
  }
}

function handleSpaceReorderDragLeave() {
  dragOverSpaceReorderId.value = null;

  // Clear expand timer when leaving the space
  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}

async function handleSpaceReorderDrop(event: DragEvent, targetSpaceId: number) {
  event.preventDefault();
  event.stopPropagation();
  dragOverSpaceReorderId.value = null;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'space' && data.notebookId !== targetSpaceId) {
      const draggedSpaceId = data.notebookId;
      const targetIndex = spacesStore.spaces.findIndex(s => s.id === targetSpaceId);

      if (targetIndex >= 0) {
        await spacesStore.reorderSpace(draggedSpaceId, targetIndex);
      }
    }
  } catch (error) {
    console.error('Failed to handle space drop:', error);
  }
}

// Bottom drop zone handlers for spaces
function handleDragOverBottomOfSpacesList(event: DragEvent) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  // Only show indicator when dragging spaces
  if (isDraggingSpace.value) {
    event.dataTransfer.dropEffect = 'move';
    dragOverBottomOfSpacesList.value = true;
  } else {
    dragOverBottomOfSpacesList.value = false;
  }
}

function handleDragLeaveBottomOfSpacesList() {
  dragOverBottomOfSpacesList.value = false;
}

async function handleDropBottomOfSpacesList(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragOverBottomOfSpacesList.value = false;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'space') {
      const draggedSpaceId = data.notebookId;
      const lastIndex = spacesStore.spaces.length - 1;

      // Only reorder if not already at the end
      const currentIndex = spacesStore.spaces.findIndex(s => s.id === draggedSpaceId);
      if (currentIndex !== lastIndex) {
        await spacesStore.reorderSpace(draggedSpaceId, lastIndex);
      }
    }
  } catch (error) {
    console.error('Failed to handle space drop at bottom:', error);
  }
}

// Close menu when clicking outside
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-space-context-menu]') && !target.closest('button')) {
      showSpaceMenuId.value = null;
    }
  };
  document.addEventListener('click', handleClickOutside);
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    // Clear timers on unmount
    if (expandTimer.value) {
      clearTimeout(expandTimer.value);
    }
    if (dragStartSpaceTimer.value) {
      clearTimeout(dragStartSpaceTimer.value);
    }
  });
});
</script>

<style scoped>
/* Space list transition animations */
.space-list-move {
  transition: transform 0.3s ease;
}

/* Folder list transition animations */
.folder-list-move {
  transition: transform 0.3s ease;
}
</style>