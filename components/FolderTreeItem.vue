<script setup lang="ts">
import type { Folder } from '~/models';

interface Props {
  folder: Folder;
  selectedId: number | null;
  depth?: number;
  isExpanded?: boolean;
}

interface Emits {
  (e: 'select', folderId: number): void;
  (e: 'toggle', folderId: number): void;
  (e: 'create-subfolder', parentId: number): void;
  (e: 'rename', folderId: number): void;
  (e: 'delete', folderId: number): void;
  (e: 'move-up', folderId: number): void;
  (e: 'move-down', folderId: number): void;
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

const noteCount = computed(() => {
  return notesStore.notes.filter(note => note.folder_id === props.folder.id).length;
});

const showContextMenu = ref(false);
const contextMenuButtonRef = ref<HTMLElement | null>(null);
const menuPosition = ref({ top: 0, left: 0 });

function handleSelect() {
  emit('select', props.folder.id);
}

function handleToggle(event: Event) {
  event.stopPropagation();
  if (hasChildren.value) {
    emit('toggle', props.folder.id);
  }
}

function toggleContextMenu(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  
  // Calculate position for the menu
  if (contextMenuButtonRef.value) {
    const rect = contextMenuButtonRef.value.getBoundingClientRect();
    menuPosition.value = {
      top: rect.bottom + 4,
      left: rect.right - 192 // 192px = w-48
    };
  }
  
  showContextMenu.value = !showContextMenu.value;
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

// Check if folder can be moved up or down
const canMoveUp = computed(() => foldersStore.canMoveUp(props.folder.id));
const canMoveDown = computed(() => foldersStore.canMoveDown(props.folder.id));

// Close context menu when clicking outside
onMounted(() => {
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
  });
});
</script>

<template>
  <div>
    <!-- Folder Item -->
    <div
      class="group/folder relative flex items-center gap-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
    >
      <!-- Expand/Collapse Button -->
      <button
        v-if="hasChildren"
        @click="handleToggle"
        class="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        :class="{ 'rotate-90': isExpanded }"
      >
        <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-500 transition-transform" />
      </button>
      <div v-else class="w-6" />

      <!-- Folder Button -->
      <button
        @click="handleSelect"
        class="flex-1 flex items-center gap-2 py-2.5 pr-2 text-sm font-medium transition-colors rounded-lg min-w-0"
        :class="selectedId === folder.id 
          ? 'text-primary-700 dark:text-primary-300' 
          : 'text-gray-700 dark:text-gray-300'"
      >
        <UIcon 
          name="i-heroicons-folder" 
          class="w-4 h-4 flex-shrink-0"
          :class="[folderColor, { 'text-primary-600 dark:text-primary-400': selectedId === folder.id }]"
        />
        <span class="truncate flex-1 text-left">{{ folder.name }}</span>
        <span 
          v-if="noteCount > 0"
          class="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0"
        >
          {{ noteCount }}
        </span>
      </button>

      <!-- Context Menu Button -->
      <button
        ref="contextMenuButtonRef"
        type="button"
        @click="toggleContextMenu"
        class="flex-shrink-0 p-1.5 rounded-md opacity-0 group-hover/folder:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
        :class="showContextMenu ? 'opacity-100 bg-gray-200 dark:bg-gray-600' : ''"
      >
        <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
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
          :style="{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }"
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

    <!-- Children Folders (Recursive) -->
    <Transition name="expand">
      <div v-if="isExpanded && hasChildren" class="overflow-hidden">
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
          @rename="emit('rename', $event)"
          @delete="emit('delete', $event)"
          @move-up="emit('move-up', $event)"
          @move-down="emit('move-down', $event)"
        />
      </div>
    </Transition>
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

/* Expand transition for children */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>

