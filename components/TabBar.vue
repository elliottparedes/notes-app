<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type Sortable from 'sortablejs';
import type { Note } from '~/models';

const notesStore = useNotesStore();

// Use storeToRefs for proper reactivity
const { activeTabId, openTabs } = storeToRefs(notesStore);
const tabNotes = computed(() => notesStore.tabNotes);

// Sortable setup
const tabsContainer = ref<HTMLElement | null>(null);
let sortableInstance: any = null;

// Initialize Sortable
async function initializeSortable() {
  if (!tabsContainer.value) {
    console.log('[TabBar] Cannot initialize - no container ref');
    return;
  }
  
  if (sortableInstance) {
    console.log('[TabBar] Sortable already initialized');
    return;
  }
  
  // Wait for DOM to be fully ready
  await nextTick();
  
  if (!tabsContainer.value) {
    console.log('[TabBar] Still no container after nextTick');
    return;
  }
  
  console.log('[TabBar] Initializing Sortable with', tabNotes.value.length, 'tabs');
  
  try {
    // Dynamically import SortableJS
    const SortableJS = (await import('sortablejs')).default;
    
    sortableInstance = SortableJS.create(tabsContainer.value, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      draggable: '.tab-item',
      forceFallback: false,
      delay: 0,
      delayOnTouchOnly: true,
      touchStartThreshold: 3,
      filter: '.no-drag',
      preventOnFilter: false,
      onStart: (evt) => {
        console.log('[TabBar] Drag started');
      },
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
          console.log('[TabBar] Reordering from', oldIndex, 'to', newIndex);
          notesStore.reorderTabs(oldIndex, newIndex);
        }
      }
    });
    
    console.log('[TabBar] Sortable initialized successfully');
  } catch (error) {
    console.error('[TabBar] Error initializing Sortable:', error);
  }
}

// Watch for when tabs appear and initialize Sortable
watch(
  () => tabNotes.value.length,
  async (newLength, oldLength) => {
    console.log('[TabBar] Tab count changed:', oldLength, '->', newLength);
    if (newLength > 0 && !sortableInstance) {
      // Wait a tick for the template to render
      await nextTick();
      initializeSortable();
    }
  },
  { immediate: true }
);

// Cleanup on unmount
onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
});

function handleTabClick(noteId: string) {
  notesStore.setActiveTab(noteId);
}

function handleCloseTab(event: Event, noteId: string) {
  event.stopPropagation();
  notesStore.closeTab(noteId);
}

function truncateTitle(title: string, maxLength: number = 25): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}
</script>

<template>
  <div 
    v-if="tabNotes.length > 0"
    class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto"
  >
    <div ref="tabsContainer" class="flex items-center min-w-max">
      <div
        v-for="note in tabNotes"
        :key="note.id"
        @click="handleTabClick(note.id)"
        class="tab-item group relative flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-700 w-[180px] cursor-grab active:cursor-grabbing transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 overflow-hidden"
        :class="{
          'bg-gray-50 dark:bg-gray-900 border-b-2 border-b-primary-500': activeTabId === note.id
        }"
      >
        <!-- Note Icon -->
        <UIcon 
          name="i-heroicons-document-text" 
          class="w-3.5 h-3.5 flex-shrink-0"
          :class="activeTabId === note.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'"
        />
        
        <!-- Note Title -->
        <span 
          class="flex-1 text-xs font-medium truncate min-w-0"
          :class="activeTabId === note.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
          :title="note.title"
        >
          {{ note.title }}
        </span>
        
        <!-- Close Button -->
        <button
          @click.stop="handleCloseTab($event, note.id)"
          @mousedown.stop
          class="no-drag flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
          :class="activeTabId === note.id ? 'opacity-100' : ''"
          title="Close tab"
        >
          <UIcon 
            name="i-heroicons-x-mark" 
            class="w-3 h-3"
            :class="activeTabId === note.id ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for horizontal scrolling */
::-webkit-scrollbar {
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

/* Tab items */
.tab-item {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* SortableJS drag states */
:deep(.sortable-ghost) {
  opacity: 0.5;
  background: rgba(59, 130, 246, 0.1) !important;
  border: 2px dashed rgba(59, 130, 246, 0.5) !important;
}

:deep(.sortable-chosen) {
  cursor: grabbing !important;
}

:deep(.sortable-drag) {
  opacity: 1;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: rotate(2deg);
}
</style>

