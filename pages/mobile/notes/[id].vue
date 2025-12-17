<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotesStore } from '~/stores/notes';
import { useToast } from '~/composables/useToast';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const toast = useToast();

const noteId = computed(() => route.params.id as string);
const activeNote = computed(() => notesStore.activeNote);
const isSaving = ref(false);
const titleSaveTimeout = ref<NodeJS.Timeout | null>(null);
const contentSaveTimeout = ref<NodeJS.Timeout | null>(null);
const showDeleteModal = ref(false);
const isDeleting = ref(false);

// Auto-save title
function handleTitleChange() {
  if (!activeNote.value) return;
  
  if (titleSaveTimeout.value) clearTimeout(titleSaveTimeout.value);
  
  titleSaveTimeout.value = setTimeout(async () => {
    if (!activeNote.value) return;
    try {
      await notesStore.updateNote(activeNote.value.id, {
        title: activeNote.value.title
      });
    } catch (error) {
      console.error('Failed to save title:', error);
    }
  }, 1000);
}

// Auto-save content
function handleContentChange(newContent: string) {
  if (!activeNote.value) return;
  
  // Update local state immediately
  activeNote.value.content = newContent;
  
  if (contentSaveTimeout.value) clearTimeout(contentSaveTimeout.value);
  
  contentSaveTimeout.value = setTimeout(async () => {
    if (!activeNote.value) return;
    try {
      await notesStore.updateNote(activeNote.value.id, {
        content: activeNote.value.content
      });
    } catch (error) {
      console.error('Failed to save content:', error);
      toast.error('Failed to save changes');
    }
  }, 2000);
}

function handleCloseNote() {
  notesStore.closeTab(noteId.value);
  router.push('/mobile/home');
}

async function handleDeleteNote() {
  if (!activeNote.value || isDeleting.value) return;
  
  isDeleting.value = true;
  try {
    await notesStore.deleteNote(activeNote.value.id);
    toast.success('Note deleted');
    router.push('/mobile/home');
  } catch (error) {
    console.error('Failed to delete note:', error);
    toast.error('Failed to delete note');
  } finally {
    isDeleting.value = false;
    showDeleteModal.value = false;
  }
}

function formatHeaderDate(date: string | Date): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper to check if we're on mobile (client-side only)
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 1024;
});

// Responsive routing - redirect to dashboard if screen becomes desktop
watch(isMobileView, (isMobile) => {
  if (!isMobile && process.client) {
    // Screen became desktop size, redirect to dashboard with note open
    router.replace(`/notes/${noteId.value}`);
  }
}, { immediate: false });

// Open the note when component mounts
onMounted(async () => {
  // Redirect if on desktop
  if (!isMobileView.value) {
    router.replace(`/notes/${noteId.value}`);
    return;
  }

  try {
    await notesStore.openTab(noteId.value);
  } catch (error) {
    console.error('Error opening note:', error);
    toast.error('Failed to open note');
    router.push('/mobile/home');
  }

  // Listen for window resize
  const handleResize = () => {
    if (window.innerWidth >= 1024) {
      router.replace(`/notes/${noteId.value}`);
    }
  };

  window.addEventListener('resize', handleResize);
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});

onUnmounted(() => {
  if (titleSaveTimeout.value) clearTimeout(titleSaveTimeout.value);
  if (contentSaveTimeout.value) clearTimeout(contentSaveTimeout.value);
});
</script>

<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-900 lg:hidden">
    <!-- Top Nav with Close Button -->
    <div class="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div class="flex items-center justify-between mb-3">
        <button
          @click="handleCloseNote"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 active:scale-95 transition"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
        </button>
        <button
          @click="showDeleteModal = true"
          class="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition"
        >
          <UIcon name="i-heroicons-trash" class="w-5 h-5" />
        </button>
      </div>
      
      <input
        v-if="activeNote"
        v-model="activeNote.title"
        class="w-full text-2xl font-semibold bg-transparent border-none outline-none placeholder-gray-400 dark:placeholder-gray-500 py-2 leading-tight text-gray-900 dark:text-gray-100"
        placeholder="Page Title"
        @input="handleTitleChange"
      />
      <div v-if="activeNote" class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
        <ClientOnly>
          <div class="flex items-center gap-2">
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
          </div>
        </ClientOnly>
      </div>
    </div>

    <!-- Editor -->
    <div class="flex-1 overflow-hidden relative">
      <div v-if="!activeNote" class="flex items-center justify-center h-full">
        <div class="text-center">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
          <p class="text-sm text-gray-500 dark:text-gray-400">Loading note...</p>
        </div>
      </div>
      <UnifiedEditor
        v-else
        :key="activeNote.id"
        :model-value="activeNote.content"
        @update:model-value="handleContentChange"
        :note-id="activeNote.id"
        :editable="true"
        :initial-content="activeNote.content"
      />
    </div>

    <!-- Delete Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div 
            v-if="showDeleteModal" 
            class="fixed inset-0 z-50 overflow-y-auto"
            @click.self="showDeleteModal = false"
          >
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div 
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5 rounded-lg"
                @click.stop
              >
                <h3 class="text-base font-semibold mb-2 text-gray-900 dark:text-white">Delete Note</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete this note? This action cannot be undone.
                </p>
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    @click="showDeleteModal = false"
                    class="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="handleDeleteNote"
                    :disabled="isDeleting"
                    class="px-3 py-2 bg-red-600 dark:bg-red-500 text-white text-sm font-normal border border-red-700 dark:border-red-600 hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2"
                  >
                    <UIcon 
                      v-if="isDeleting" 
                      name="i-heroicons-arrow-path" 
                      class="w-4 h-4 animate-spin" 
                    />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

