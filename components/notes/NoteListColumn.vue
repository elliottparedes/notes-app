<template>
  <aside
    v-if="!isFullscreen"
    class="hidden lg:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 flex-shrink-0 relative"
    :style="{ width: `${noteListWidth}px` }"
  >
    <!-- Resize Handle -->
    <div
      @mousedown="handleNoteListResizeStart"
      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
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
    <div class="notes-scroll flex-1 overflow-y-auto">
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
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700" ref="noteListRef">
        <div
          v-for="(note, index) in displayNotes"
          :key="note.id"
          :data-note-id="note.id"
          @click="$emit('open-note', note.id)"
          class="note-item group px-3 py-2 cursor-pointer transition-colors relative border-l-2"
          :class="{
            'bg-blue-50 dark:bg-blue-900/20 border-l-blue-600 dark:border-l-blue-400': activeNote?.id === note.id,
            'border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-800': activeNote?.id !== note.id
          }"
        >
          <div class="font-normal text-sm truncate select-none pr-8 text-gray-900 dark:text-gray-100">{{ note.title || 'Untitled Page' }}</div>
          <!-- Delete Button -->
          <button
            @click.stop="handleDeleteClick(note.id, $event)"
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
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
interface Props {
  selectedFolderId: number | null
  noteListWidth: number
  isFullscreen: boolean
}

interface Emits {
  (e: 'update:noteListWidth', width: number): void
  (e: 'open-note', noteId: string): void
  (e: 'create-note-in-folder', folderId: number): void
  (e: 'delete-note', noteId: string): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const { getOrderedNotesForFolder } = useNotesFormatting();
const { handleNoteListResizeStart } = useSidebarResize();
const { noteToDelete, handleDeleteClick } = useNoteActions();

const noteListRef = ref<HTMLElement | null>(null);

const displayNotes = computed(() => getOrderedNotesForFolder(props.selectedFolderId));
const activeNote = computed(() => notesStore.activeNote);
</script>
