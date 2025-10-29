<script setup lang="ts">
import type { Note } from '~/models';

const notesStore = useNotesStore();

const activeTabId = computed(() => notesStore.activeTabId);
const tabNotes = computed(() => notesStore.tabNotes);

// Drag and drop state
const draggedTabIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function handleTabClick(noteId: string) {
  notesStore.setActiveTab(noteId);
}

function handleCloseTab(event: Event, noteId: string) {
  event.stopPropagation();
  notesStore.closeTab(noteId);
}

function handleDragStart(event: DragEvent, index: number) {
  draggedTabIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', ''); // Required for Firefox
  }
}

function handleDragOver(event: DragEvent, index: number) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverIndex.value = index;
}

function handleDragLeave() {
  dragOverIndex.value = null;
}

function handleDrop(event: DragEvent, toIndex: number) {
  event.preventDefault();
  
  if (draggedTabIndex.value !== null && draggedTabIndex.value !== toIndex) {
    notesStore.reorderTabs(draggedTabIndex.value, toIndex);
  }
  
  draggedTabIndex.value = null;
  dragOverIndex.value = null;
}

function handleDragEnd() {
  draggedTabIndex.value = null;
  dragOverIndex.value = null;
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
    <div class="flex items-center min-w-max">
      <div
        v-for="(note, index) in tabNotes"
        :key="note.id"
        :draggable="true"
        @dragstart="handleDragStart($event, index)"
        @dragover="handleDragOver($event, index)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, index)"
        @dragend="handleDragEnd"
        @click="handleTabClick(note.id)"
        class="group relative flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 min-w-[140px] max-w-[180px]"
        :class="{
          'bg-gray-50 dark:bg-gray-900 border-b-2 border-b-primary-500': activeTabId === note.id,
          'opacity-50': draggedTabIndex === index,
          'border-l-2 border-l-primary-400': dragOverIndex === index && draggedTabIndex !== index
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
          class="flex-1 text-xs font-medium truncate"
          :class="activeTabId === note.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
          :title="note.title"
        >
          {{ truncateTitle(note.title, 20) }}
        </span>
        
        <!-- Close Button -->
        <button
          @click="handleCloseTab($event, note.id)"
          class="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          :class="activeTabId === note.id ? 'opacity-100' : ''"
          title="Close tab"
        >
          <UIcon 
            name="i-heroicons-x-mark" 
            class="w-3 h-3"
            :class="activeTabId === note.id ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'"
          />
        </button>
        
        <!-- Drag indicator -->
        <div 
          v-if="draggedTabIndex === index"
          class="absolute inset-0 bg-primary-500/10 pointer-events-none"
        />
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
</style>

