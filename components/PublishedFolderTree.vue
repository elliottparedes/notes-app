<script setup lang="ts">
import type { PublishedFolderWithDetails } from '~/models';

interface Props {
  folder: PublishedFolderWithDetails;
  expandedFolders: Set<number>;
  selectedNoteId?: string;
}

interface Emits {
  (e: 'toggle-folder', folderId: number): void;
  (e: 'open-note', shareId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isExpanded = computed(() => props.expandedFolders.has(props.folder.folder_id));

function toggle() {
  emit('toggle-folder', props.folder.folder_id);
}

function openNote(shareId: string) {
  emit('open-note', shareId);
}
</script>

<template>
  <div class="space-y-1">
    <!-- Folder Header -->
    <div
      class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      @click="toggle"
    >
      <UIcon
        :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        class="w-4 h-4 text-gray-400 flex-shrink-0"
      />
      <UIcon name="i-heroicons-folder" class="w-4 h-4 text-primary-500 flex-shrink-0" />
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
        {{ folder.folder_name }}
      </span>
      <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
        {{ folder.notes.length + folder.subfolders.length }}
      </span>
    </div>

    <!-- Expanded Content -->
    <div v-if="isExpanded" class="ml-6 space-y-1">
      <!-- Notes in this folder -->
      <div
        v-for="note in folder.notes"
        :key="note.note_id"
        class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors"
        :class="selectedNoteId === note.note_id 
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'"
        @click.stop="openNote(note.share_id)"
      >
        <UIcon name="i-heroicons-document-text" class="w-4 h-4 flex-shrink-0" />
        <span class="text-sm truncate flex-1">{{ note.note_title }}</span>
      </div>

      <!-- Subfolders (recursive) -->
      <PublishedFolderTree
        v-for="subfolder in folder.subfolders"
        :key="subfolder.folder_id"
        :folder="subfolder"
        :expanded-folders="expandedFolders"
        :selected-note-id="selectedNoteId"
        @toggle-folder="$emit('toggle-folder', $event)"
        @open-note="$emit('open-note', $event)"
      />
    </div>
  </div>
</template>
