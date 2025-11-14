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

const expandContentRef = ref<HTMLElement | null>(null);
const contentHeight = ref<number>(0);

const isExpanded = computed(() => props.expandedFolders.has(props.folder.folder_id));

watch(isExpanded, (newVal) => {
  if (newVal && expandContentRef.value) {
    // Measure the actual height when expanding
    nextTick(() => {
      if (expandContentRef.value) {
        contentHeight.value = expandContentRef.value.scrollHeight;
      }
    });
  }
});

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
      class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group"
      :class="isExpanded 
        ? 'bg-gray-50 dark:bg-gray-800/50' 
        : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'"
      @click="toggle"
    >
      <UIcon
        :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200"
        :class="isExpanded ? 'rotate-0' : ''"
      />
      <UIcon 
        name="i-heroicons-folder" 
        class="w-5 h-5 text-primary-500 dark:text-primary-400 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" 
      />
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
        {{ folder.folder_name }}
      </span>
      <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
        {{ folder.notes.length }}
      </span>
    </div>

    <!-- Expanded Content -->
    <Transition name="expand">
      <div 
        v-if="isExpanded" 
        ref="expandContentRef"
        class="ml-8 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4"
      >
        <!-- Notes in this folder -->
        <TransitionGroup name="list" tag="div">
          <div
            v-for="note in folder.notes"
            :key="note.note_id"
            class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group"
            :class="selectedNoteId === note.note_id 
              ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 text-primary-700 dark:text-primary-300 shadow-sm' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'"
            @click.stop="openNote(note.share_id)"
          >
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span class="text-sm font-medium truncate flex-1">{{ note.note_title }}</span>
          </div>
        </TransitionGroup>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Expand animation */
.expand-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.expand-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.expand-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to {
  opacity: 1;
  max-height: 2000px;
  transform: translateY(0);
}

.expand-leave-from {
  opacity: 1;
  max-height: 2000px;
  transform: translateY(0);
}

.expand-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* List animation */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
