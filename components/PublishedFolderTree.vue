<script setup lang="ts">
import type { PublishedFolderWithDetails } from '~/models';

interface Props {
  folder: PublishedFolderWithDetails;
  expandedFolders: Set<number>;
  selectedNoteId?: string;
}

interface Emits {
  (e: 'toggle-folder', sectionId: number): void;
  (e: 'open-note', shareId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const expandContentRef = ref<HTMLElement | null>(null);
const contentHeight = ref<number>(0);

const isExpanded = computed(() => props.expandedFolders.has(props.folder.section_id));

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
  emit('toggle-folder', props.folder.section_id);
}

function openNote(shareId: string) {
  emit('open-note', shareId);
}
</script>

<template>
  <div class="space-y-1">
    <!-- Folder Header - Premium Design -->
    <div
      class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group border border-transparent"
      :class="isExpanded 
        ? 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700' 
        : 'hover:bg-white dark:hover:bg-gray-800/60 border-transparent'"
      @click="toggle"
    >
      <UIcon
        :name="isExpanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 transition-transform duration-200"
        :class="isExpanded ? 'rotate-0' : ''"
      />
      <UIcon 
        name="i-heroicons-folder" 
        class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-colors duration-200 group-hover:text-primary-600 dark:group-hover:text-primary-400" 
      />
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1 leading-snug">
        {{ folder.folder_name }}
      </span>
      <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md font-medium">
        {{ folder.notes.length }}
      </span>
    </div>

    <!-- Expanded Content -->
    <Transition name="expand">
      <div 
        v-if="isExpanded" 
        ref="expandContentRef"
        class="ml-7 space-y-1 border-l border-gray-200 dark:border-gray-700 pl-4 mt-1"
      >
        <!-- Notes in this folder -->
        <TransitionGroup name="list" tag="div" class="space-y-1">
          <div
            v-for="note in folder.notes"
            :key="note.page_id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group border border-transparent"
            :class="selectedNoteId === note.page_id 
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm border-primary-200 dark:border-primary-800' 
              : 'hover:bg-white dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300'"
            @click.stop="openNote(note.share_id)"
          >
            <UIcon name="i-heroicons-document-text" class="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
            <span class="text-sm font-medium truncate flex-1 leading-snug">{{ note.page_title }}</span>
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
