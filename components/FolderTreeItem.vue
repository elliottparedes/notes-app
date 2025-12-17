<script setup lang="ts">
import type { Folder } from '~/models';

interface Props {
  folder: Folder;
  selectedId: number | null;
  isExpanded?: boolean;
  openMenuId?: number | null;
}

interface Emits {
  (e: 'select', folderId: number): void;
  (e: 'toggle', folderId: number): void;
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
  (e: 'update:openMenuId', value: number | null): void;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  openMenuId: null
});

const emit = defineEmits<Emits>();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();

// Get note count for this folder
const noteCount = computed(() => {
  return notesStore.notes.filter(note => 
    note.folder_id === props.folder.id && !note.share_permission
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

// Renaming state
const isRenaming = ref(false);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

// Helper to detect mobile devices (viewport width < 1024px)
function isMobile(): boolean {
  if (!process.client) return false;
  return window.innerWidth < 1024;
}

function handleSelect() {
  if (isRenaming.value) return;
  emit('select', props.folder.id);
}

function startRename() {
  renameValue.value = props.folder.name;
  isRenaming.value = true;
  emit('update:openMenuId', null);
  
  // Focus input on next tick
  nextTick(() => {
    renameInputRef.value?.focus();
  });
}

async function saveRename() {
  if (!isRenaming.value) return;
  
  const newName = renameValue.value.trim();
  if (newName && newName !== props.folder.name) {
    try {
      await foldersStore.updateFolder(props.folder.id, { name: newName });
    } catch (error) {
      console.error('Failed to rename folder:', error);
      // Optional: show toast error
    }
  }
  
  isRenaming.value = false;
}

function cancelRename() {
  isRenaming.value = false;
  renameValue.value = '';
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
</script>

<template>
  <!-- Folder Item - Premium Apple Design -->
    <div
    class="folder-item group/folder relative flex items-center gap-2 transition-colors active:bg-gray-100 dark:active:bg-gray-700 cursor-grab active:cursor-grabbing"
    :data-folder-id="folder.id"
    :class="{ 
      'bg-blue-50 dark:bg-blue-900/20': selectedId === folder.id,
      'md:hover:bg-gray-50 dark:hover:bg-gray-800': selectedId !== folder.id
    }"
    >
      <div class="w-4" /> <!-- Spacing instead of expand button -->

      <!-- Folder Button -->
      <div v-if="isRenaming" class="flex-1 py-2 pr-2 min-w-0">
        <input
          ref="renameInputRef"
          v-model="renameValue"
          type="text"
          class="w-full px-2 py-0.5 text-sm bg-white dark:bg-gray-800 border border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          @blur="saveRename"
          @keydown.enter="saveRename"
          @keydown.esc="cancelRename"
          @click.stop
        />
      </div>
      <button
        v-else
        @click.stop="handleSelect"
        @dblclick.stop="startRename"
        class="flex-1 flex items-center gap-2.5 py-2 pr-2 font-normal transition-colors min-w-0 text-gray-900 dark:text-gray-100 active:bg-gray-100 dark:active:bg-gray-700"
        :class="{ 'md:hover:bg-gray-50 dark:hover:bg-gray-800': selectedId !== folder.id }"
        :style="{ fontSize: 'clamp(0.75rem, 0.5vw + 0.5rem, 0.875rem)' }"
      >
        <UIcon 
          name="i-heroicons-folder" 
          class="w-4 h-4 flex-shrink-0 transition-colors text-blue-600 dark:text-blue-400"
        />
        <span class="truncate flex-1 text-left">{{ folder.name }}</span>
        <span 
          v-if="noteCount > 0"
          class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0 font-normal text-xs"
          :style="{ fontSize: 'clamp(0.625rem, 0.4vw + 0.4rem, 0.75rem)' }"
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
        class="no-drag flex-shrink-0 p-1 opacity-100 md:opacity-0 md:group-hover/folder:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
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
