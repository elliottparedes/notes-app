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
      <div
        v-for="space in spacesStore.spaces"
        :key="space.id"
        class="space-item mb-0.5"
      >
        <!-- Notebook Header -->
        <div
          class="space-item-header group/space relative flex items-center gap-1 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 overflow-hidden min-w-0"
          :class="{
            'bg-blue-50 dark:bg-blue-900/20': dragOverSpaceId === space.id && !spacesStore.expandedSpaceIds.has(space.id)
          }"
          @dragover="handleSpaceDragOver($event, space.id)"
          @dragleave="handleSpaceDragLeave(space.id)"
          @drop="handleSpaceDrop($event, space.id)"
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
              class="h-2 -mt-1 transition-all border-b-2 relative z-10"
              :class="{
                '[border-bottom-width:3px] border-b-blue-500 dark:border-b-blue-400 h-3': dragOverTopOfSpace === space.id,
                'border-b-transparent': dragOverTopOfSpace !== space.id
              }"
            />
            <FolderTreeItem
              v-for="folder in getSpaceFolders(space.id, foldersStore.folders)"
              :key="folder.id"
              :folder="folder"
              :selected-id="selectedFolderId"
              :open-menu-id="openFolderMenuId"
              @select="(id) => $emit('select-folder', id)"
              @create-note="(id) => $emit('create-note-in-folder', id)"
              @delete="(id) => $emit('delete-folder', id)"
              @edit="(folder) => $emit('edit-folder', folder)"
              @update:openMenuId="openFolderMenuId = $event"
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
  (e: 'select-folder', folderId: number): void
  (e: 'create-note-in-folder', folderId: number): void
  (e: 'open-search'): void
  (e: 'open-create-space'): void
  (e: 'open-create-folder', spaceId?: number): void
  (e: 'logout'): void
  (e: 'edit-folder', folder: any): void
  (e: 'delete-folder', folderId: number): void
  (e: 'edit-space', space: Space): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const spacesStore = useSpacesStore();
const foldersStore = useFoldersStore();
const authStore = useAuthStore();
const { cachedProfilePicture } = useCachedProfilePicture();
const { handleSidebarResizeStart } = useSidebarResize((width) => emit('update:sidebarWidth', width));
const { handleSelectSpace, handleDeleteSpace } = useSpaceActions();

const showSpaceMenuId = ref<number | null>(null);
const openFolderMenuId = ref<number | null>(null);
const spaceMenuPosition = ref({ top: '0px', left: '0px' });

// Drag and drop state
const dragOverSpaceId = ref<number | null>(null);
const dragOverTopOfSpace = ref<number | null>(null);
const expandTimer = ref<NodeJS.Timeout | null>(null);

function toggleSpaceMenu(spaceId: number, event: MouseEvent) {
  event.stopPropagation();
  if (showSpaceMenuId.value === spaceId) {
    showSpaceMenuId.value = null;
  } else {
    showSpaceMenuId.value = spaceId;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    spaceMenuPosition.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`
    };
  }
}

function editSpace(space: Space) {
  showSpaceMenuId.value = null;
  emit('edit-space', space);
}

function deleteSpace(spaceId: number) {
  showSpaceMenuId.value = null;
  handleDeleteSpace(spaceId);
}

// Drag and drop handlers for auto-expanding spaces
function handleSpaceDragOver(event: DragEvent, spaceId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  const data = event.dataTransfer.types.includes('application/json');
  if (!data) return;

  dragOverSpaceId.value = spaceId;

  // If space is not expanded, set a timer to auto-expand
  if (!spacesStore.expandedSpaceIds.has(spaceId)) {
    if (!expandTimer.value) {
      expandTimer.value = setTimeout(() => {
        spacesStore.expandSpace(spaceId);
        expandTimer.value = null;
      }, 800); // Auto-expand after 800ms
    }
  }
}

function handleSpaceDragLeave(spaceId: number) {
  if (dragOverSpaceId.value === spaceId) {
    dragOverSpaceId.value = null;
  }

  // Clear expand timer
  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}

function handleSpaceDrop(event: DragEvent, spaceId: number) {
  event.preventDefault();
  dragOverSpaceId.value = null;

  // Clear expand timer
  if (expandTimer.value) {
    clearTimeout(expandTimer.value);
    expandTimer.value = null;
  }
}

// Drop zone at top of folder list handlers
function handleDragOverTopOfSpace(event: DragEvent, spaceId: number) {
  event.preventDefault();
  if (!event.dataTransfer) return;

  event.dataTransfer.dropEffect = 'move';
  dragOverTopOfSpace.value = spaceId;
}

function handleDragLeaveTopOfSpace() {
  dragOverTopOfSpace.value = null;
}

async function handleDropTopOfSpace(event: DragEvent, spaceId: number) {
  event.preventDefault();
  event.stopPropagation();
  dragOverTopOfSpace.value = null;

  if (!event.dataTransfer) return;

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));

    if (data.type === 'folder') {
      const draggedFolderId = data.folderId;
      const draggedSpaceId = data.spaceId;

      // If moving to a different space
      if (draggedSpaceId !== spaceId) {
        await foldersStore.moveFolder(draggedFolderId, spaceId);
      }
      // Reorder to index 0 (top of list)
      await foldersStore.reorderFolder(draggedFolderId, 0);
    }
  } catch (error) {
    console.error('Failed to handle folder drop at top:', error);
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
    // Clear expand timer on unmount
    if (expandTimer.value) {
      clearTimeout(expandTimer.value);
    }
  });
});
</script>