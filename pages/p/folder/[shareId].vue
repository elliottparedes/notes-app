<script setup lang="ts">
import type { PublishedFolderWithDetails, PublishedNoteWithDetails } from '~/models';

const route = useRoute();
const shareId = computed(() => route.params.shareId as string);
const publishedFolder = ref<PublishedFolderWithDetails | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const expandedFolders = ref<Set<number>>(new Set());
const selectedNote = ref<PublishedNoteWithDetails | null>(null);
const isLoadingNote = ref(false);

// Client-side checks
const isClient = ref(false);
const hasShareAPI = ref(false);

onMounted(async () => {
  isClient.value = true;
  hasShareAPI.value = typeof navigator !== 'undefined' && 'share' in navigator;
  
  try {
    const data = await $fetch<PublishedFolderWithDetails>(`/api/publish/folder/${shareId.value}`);
    publishedFolder.value = data;
    // Expand all folders by default
    const expandAll = (folder: PublishedFolderWithDetails) => {
      expandedFolders.value.add(folder.folder_id);
      folder.subfolders.forEach(subfolder => expandAll(subfolder));
    };
    if (publishedFolder.value) {
      expandAll(publishedFolder.value);
    }
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to load published folder';
    console.error('Error loading published folder:', err);
  } finally {
    isLoading.value = false;
  }
});

function toggleFolder(folderId: number) {
  if (expandedFolders.value.has(folderId)) {
    expandedFolders.value.delete(folderId);
  } else {
    expandedFolders.value.add(folderId);
  }
}

async function openNote(noteShareId: string) {
  if (selectedNote.value?.share_id === noteShareId) return; // Already selected
  
  isLoadingNote.value = true;
  try {
    const note = await $fetch<PublishedNoteWithDetails>(`/api/publish/note/${noteShareId}`);
    selectedNote.value = note;
  } catch (err: any) {
    console.error('Error loading note:', err);
    error.value = err.data?.message || 'Failed to load note';
  } finally {
    isLoadingNote.value = false;
  }
}

// Copy link function
function copyLink() {
  if (isClient.value && navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href);
  }
}

// Share function
async function shareLink() {
  if (isClient.value && navigator.share) {
    try {
      await navigator.share({ url: window.location.href });
    } catch (err) {
      // User cancelled or error occurred
      console.error('Error sharing:', err);
    }
  }
}

useHead({
  title: computed(() => publishedFolder.value?.folder_name || 'Published Folder'),
  meta: [
    {
      name: 'description',
      content: computed(() => `Published folder: ${publishedFolder.value?.folder_name || ''}`)
    }
  ]
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <!-- Header -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 fixed top-0 left-0 right-0 z-10 flex-shrink-0">
      <div class="w-full px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/swan-unfold.png" alt="The Swan" class="w-10 h-10 flex-shrink-0" />
            <div>
              <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ publishedFolder?.folder_name || 'Published Folder' }}
              </h1>
              <p v-if="publishedFolder" class="text-sm text-gray-500 dark:text-gray-400">
                {{ publishedFolder.notes.length + publishedFolder.subfolders.reduce((sum, f) => sum + f.notes.length + f.subfolders.length, 0) }} items
              </p>
            </div>
          </div>
          <UButton
            v-if="hasShareAPI"
            icon="i-heroicons-share"
            color="primary"
            variant="soft"
            size="sm"
            @click="shareLink"
          >
            Share
          </UButton>
          <UButton
            v-else
            icon="i-heroicons-clipboard-document"
            color="primary"
            variant="soft"
            size="sm"
            @click="copyLink"
          >
            Copy Link
          </UButton>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Folder Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="publishedFolder" class="flex-1 flex pt-[73px]">
      <!-- Sidebar - Folder Tree -->
      <aside class="w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 fixed top-[73px] left-0 bottom-0 overflow-y-auto flex-shrink-0">
        <div class="p-4 space-y-4">
          <!-- Notes in root folder -->
          <div v-if="publishedFolder.notes.length > 0" class="space-y-1">
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
              Notes
            </h3>
            <div
              v-for="note in publishedFolder.notes"
              :key="note.note_id"
              class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors"
              :class="selectedNote?.note_id === note.note_id 
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'"
              @click="openNote(note.share_id)"
            >
              <UIcon name="i-heroicons-document-text" class="w-4 h-4 flex-shrink-0" />
              <span class="text-sm truncate flex-1">{{ note.note_title }}</span>
            </div>
          </div>

          <!-- Subfolders -->
          <div v-if="publishedFolder.subfolders.length > 0" class="space-y-1">
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
              Folders
            </h3>
            <PublishedFolderTree
              v-for="subfolder in publishedFolder.subfolders"
              :key="subfolder.folder_id"
              :folder="subfolder"
              :expanded-folders="expandedFolders"
              :selected-note-id="selectedNote?.note_id"
              @toggle-folder="toggleFolder"
              @open-note="openNote"
            />
          </div>

          <!-- Empty State -->
          <div v-if="publishedFolder.notes.length === 0 && publishedFolder.subfolders.length === 0" class="text-center py-12">
            <UIcon name="i-heroicons-folder-open" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p class="text-sm text-gray-500 dark:text-gray-400">This folder is empty</p>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto bg-white dark:bg-gray-900 ml-80">
        <div v-if="isLoadingNote" class="flex items-center justify-center h-full">
          <div class="animate-pulse space-y-4 text-center">
            <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-400 mx-auto" />
            <p class="text-gray-500 dark:text-gray-400">Loading note...</p>
          </div>
        </div>
        <div v-else-if="selectedNote" class="max-w-4xl mx-auto px-8 py-8">
          <!-- Note Header -->
          <header class="mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {{ selectedNote.note_title }}
            </h1>
            <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span v-if="selectedNote.owner_name">
                Published by {{ selectedNote.owner_name }}
              </span>
              <span>
                Updated {{ new Date(selectedNote.note_updated_at).toLocaleDateString() }}
              </span>
            </div>
          </header>

          <!-- Note Content -->
          <article class="prose prose-lg dark:prose-invert max-w-none">
            <div v-if="selectedNote.note_content" class="note-content" v-html="selectedNote.note_content"></div>
            <div v-else class="text-gray-500 dark:text-gray-400 italic">
              This note is empty.
            </div>
          </article>
        </div>
        <div v-else class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-heroicons-document-text" class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p class="text-gray-500 dark:text-gray-400">Select a note to view</p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.note-content {
  color: rgb(17 24 39);
}

.dark .note-content {
  color: rgb(243 244 246);
}

.note-content :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.75;
}

.note-content :deep(h1) {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

.note-content :deep(h2) {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
}

.note-content :deep(h3) {
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
}

.note-content :deep(ul),
.note-content :deep(ol) {
  margin-bottom: 1rem;
  margin-left: 1.5rem;
}

.note-content :deep(li) {
  margin-bottom: 0.5rem;
}

/* Task list styles - override default ul styles */
.note-content :deep(ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
  margin-left: 0;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"]) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"] > label) {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  margin-top: 0.125rem;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"] > label input[type="checkbox"]) {
  cursor: pointer;
  width: 1rem;
  height: 1rem;
  margin: 0;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"] > div) {
  flex: 1 1 auto;
}

/* Strikethrough for checked task items */
.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"][data-checked="true"] > div) {
  text-decoration: line-through;
  opacity: 0.7;
}

.note-content :deep(code) {
  background-color: rgb(243 244 246);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.dark .note-content :deep(code) {
  background-color: rgb(31 41 55);
}

.note-content :deep(pre) {
  background-color: rgb(243 244 246);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.dark .note-content :deep(pre) {
  background-color: rgb(31 41 55);
}

.note-content :deep(blockquote) {
  border-left: 4px solid rgb(59 130 246);
  padding-left: 1rem;
  font-style: italic;
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.note-content :deep(a) {
  color: rgb(59 130 246);
  text-decoration: underline;
}

.note-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.note-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.note-content :deep(th),
.note-content :deep(td) {
  border: 1px solid rgb(209 213 219);
  padding: 0.5rem;
}

.dark .note-content :deep(th),
.dark .note-content :deep(td) {
  border-color: rgb(75 85 99);
}
</style>
