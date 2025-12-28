<template>
  <div v-if="activeNote" class="flex flex-col h-full">
    <!-- Editor Title Area -->
    <div class="px-6 pt-4 pb-3 relative border-b border-gray-200 dark:border-gray-700">
      <!-- Desktop: Action Buttons / Mobile: Close Note -->
      <div v-if="!isMobileView" class="absolute top-4 right-6 flex items-center gap-1 z-10">
        <!-- Download PDF Button -->
        <button
          @click="downloadPDF"
          class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          title="Download as PDF"
        >
          <UIcon
            name="i-heroicons-arrow-down-tray"
            class="w-4 h-4"
          />
        </button>
        <!-- Focus Mode Button -->
        <button
          @click="$emit('toggle-fullscreen')"
          class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          :title="isFullscreen ? 'Show Sidebars' : 'Hide Sidebars'"
        >
          <UIcon
            :name="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
            class="w-4 h-4"
          />
        </button>
      </div>
      <button
        v-else
        @click="$emit('close-note')"
        class="absolute top-4 right-6 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors z-10"
        title="Close note"
      >
        <UIcon
          name="i-heroicons-x-mark"
          class="w-4 h-4"
        />
      </button>

      <input
        v-model="activeNote.title"
        class="w-full text-2xl font-semibold bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-gray-500 py-2 leading-tight text-gray-900 dark:text-gray-100"
        :class="isMobileView ? 'pr-12' : 'pr-32'"
        placeholder="Page Title"
        @input="handleTitleChange"
      />
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
        <ClientOnly>
          <div class="flex items-center gap-2">
            <template v-if="activeNote">
              <!-- Saved indicator -->
              <div v-if="notesStore.loading" class="flex items-center gap-1.5 text-gray-400">
                <UIcon name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </div>
              <div v-else class="flex items-center gap-1.5 text-green-600 dark:text-green-400 transition-all duration-300">
                <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5" />
                <span>Saved</span>
              </div>
              <span class="text-gray-300 dark:text-gray-600 mx-1">|</span>
              <span>{{ formatHeaderDate(activeNote.updated_at) }}</span>
            </template>
          </div>
        </ClientOnly>
      </div>

      <!-- Tags Input -->
      <div class="mt-3 flex items-center gap-2 flex-wrap">
        <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-400 flex-shrink-0" />

        <div class="flex items-center gap-1.5 flex-wrap">
          <span
            v-for="tag in activeNote.tags || []"
            :key="tag"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 group cursor-pointer hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            @click="removeTag(tag)"
            title="Click to remove"
          >
            {{ tag }}
            <UIcon name="i-heroicons-x-mark" class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>

          <input
            v-model="tagInput"
            type="text"
            class="bg-transparent border-none outline-none text-xs text-gray-600 dark:text-gray-400 placeholder-gray-400 min-w-[60px]"
            placeholder="Add tag..."
            @keydown.enter="addTag"
            @blur="addTag"
          />
        </div>
      </div>
    </div>

    <!-- Unified Editor -->
    <div class="flex-1 overflow-hidden relative">
      <UnifiedEditor
        ref="editorRef"
        v-model="activeNote.content"
        :note-id="activeNote.id"
        :editable="isEditorEditable"
        :placeholder="'Start writing...'"
        :is-collaborative="false"
        :is-polishing="isPolishing"
        :is-asking-a-i="isAskingAI"
        :search-query="searchQueryForHighlight"
        @update:model-value="handleContentChange"
        @request-polish="polishNote"
        @request-ask-ai="askAINote"
        @note-link-clicked="(id) => handleNoteLink(id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/types';

interface Emits {
  (e: 'close-note'): void
  (e: 'toggle-fullscreen'): void
  (e: 'note-link-clicked', noteId: string): void
}

interface Props {
  isFullscreen?: boolean
  searchQueryForHighlight?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  isFullscreen: false,
  searchQueryForHighlight: null
});

const emit = defineEmits<Emits>();

const notesStore = useNotesStore();
const { formatHeaderDate } = useNotesFormatting();
const {
  tagInput,
  isPolishing,
  isAskingAI,
  handleTitleChange,
  handleContentChange,
  addTag,
  removeTag,
  polishNote,
  askAINote,
  downloadPDF
} = useNoteEditor();

const editorRef = ref();

const activeNote = computed(() => notesStore.activeNote);

const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 1024;
});

const isEditorEditable = computed(() => !(isPolishing.value || isAskingAI.value));

function handleNoteLink(id: string) {
  emit('note-link-clicked', id);
}
</script>
