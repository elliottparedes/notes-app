<script setup lang="ts">
import type { PublishedSpaceWithDetails, PublishedFolderWithDetails, PublishedNoteWithDetails } from '~/models';

const route = useRoute();
const shareId = computed(() => route.params.shareId as string);
const publishedSpace = ref<PublishedSpaceWithDetails | null>(null);
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
    const data = await $fetch<PublishedSpaceWithDetails>(`/api/publish/space/${shareId.value}`);
    publishedSpace.value = data;
    
    // Expand all folders by default for better navigation
    if (publishedSpace.value) {
      const expandAll = (folders: PublishedFolderWithDetails[]) => {
        folders.forEach(folder => {
          expandedFolders.value.add(folder.folder_id);
          if (folder.subfolders.length > 0) {
            expandAll(folder.subfolders);
          }
        });
      };
      expandAll(publishedSpace.value.folders);
    }
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to load published space';
    console.error('Error loading published space:', err);
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
  if (selectedNote.value?.share_id === noteShareId) return;
  
  isLoadingNote.value = true;
  await new Promise(resolve => setTimeout(resolve, 150));
  
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
      console.error('Error sharing:', err);
    }
  }
}

useHead({
  title: computed(() => publishedSpace.value?.space_name || 'Published Space'),
  meta: [
    {
      name: 'description',
      content: computed(() => `Published space: ${publishedSpace.value?.space_name || ''}`)
    }
  ]
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
    <!-- Header - Premium Confluence-style -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 fixed top-0 left-0 right-0 z-50 flex-shrink-0 shadow-sm">
      <div class="w-full px-8 py-5">
        <div class="flex items-center justify-between max-w-[1920px] mx-auto">
          <div class="flex items-center gap-4">
            <div class="relative">
              <img src="/note_book_logo.png" alt="Unfold Notes" class="w-9 h-9 flex-shrink-0" />
            </div>
            <div>
              <h1 class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                {{ publishedSpace?.space_name || 'Published Space' }}
              </h1>
              <p v-if="publishedSpace" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {{ publishedSpace.folders.length }} {{ publishedSpace.folders.length === 1 ? 'folder' : 'folders' }} · {{ publishedSpace.notes.length }} {{ publishedSpace.notes.length === 1 ? 'note' : 'notes' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <UButton
              v-if="hasShareAPI"
              icon="i-heroicons-share"
              color="primary"
              variant="soft"
              size="md"
              class="font-medium"
              @click="shareLink"
            >
              Share
            </UButton>
            <UButton
              v-else
              icon="i-heroicons-clipboard-document"
              color="primary"
              variant="soft"
              size="md"
              class="font-medium"
              @click="copyLink"
            >
              Copy Link
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
        <div class="relative">
          <div class="w-16 h-16 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin mx-auto"></div>
        </div>
        <p class="text-gray-500 dark:text-gray-400 animate-pulse">Loading...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4 animate-fade-in">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 text-red-500 mx-auto" />
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Space Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="publishedSpace" class="flex-1 flex pt-[100px]">
      <!-- Sidebar - Always Visible, Premium Design -->
      <aside 
        class="w-72 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 fixed top-[100px] left-0 bottom-0 overflow-y-auto flex-shrink-0"
      >
        <div class="p-6 space-y-8">
          <!-- Root Level Notes -->
          <div v-if="publishedSpace.notes.length > 0" class="space-y-2">
            <h3 class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">
              Quick Notes
            </h3>
            <TransitionGroup name="list" tag="div" class="space-y-1">
              <div
                v-for="note in publishedSpace.notes"
                :key="note.note_id"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group"
                :class="selectedNote?.note_id === note.note_id 
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm border border-primary-200 dark:border-primary-800' 
                  : 'hover:bg-white dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300 border border-transparent'"
                @click="openNote(note.share_id)"
              >
                <UIcon name="i-heroicons-document-text" class="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                <span class="text-sm font-medium truncate flex-1 leading-snug">{{ note.note_title }}</span>
              </div>
            </TransitionGroup>
          </div>

          <!-- Folders -->
          <div v-if="publishedSpace.folders.length > 0" class="space-y-2">
            <h3 class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">
              Folders
            </h3>
            <PublishedFolderTree
              v-for="folder in publishedSpace.folders"
              :key="folder.folder_id"
              :folder="folder"
              :expanded-folders="expandedFolders"
              :selected-note-id="selectedNote?.note_id"
              @toggle-folder="toggleFolder"
              @open-note="openNote"
            />
          </div>

          <!-- Empty State -->
          <div v-if="publishedSpace.folders.length === 0 && publishedSpace.notes.length === 0" class="text-center py-16">
            <UIcon name="i-heroicons-squares-2x2" class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p class="text-sm text-gray-500 dark:text-gray-400">This space is empty</p>
          </div>
        </div>
      </aside>

      <!-- Main Content Area - Premium Reading Experience -->
      <main 
        class="flex-1 overflow-y-auto bg-white dark:bg-gray-950 ml-72"
      >
        <Transition name="fade-slide" mode="out-in">
          <div v-if="isLoadingNote" key="loading" class="flex items-center justify-center h-full">
            <div class="text-center space-y-4">
              <div class="relative">
                <div class="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin mx-auto"></div>
              </div>
              <p class="text-gray-500 dark:text-gray-400">Loading note...</p>
            </div>
          </div>
          <div v-else-if="selectedNote" key="note" class="max-w-4xl mx-auto px-12 py-16">
            <!-- Note Header - Premium Typography -->
            <header class="mb-12 pb-8 border-b border-gray-200 dark:border-gray-800">
              <h1 class="text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight">
                {{ selectedNote.note_title }}
              </h1>
              <div class="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <span v-if="selectedNote.owner_name" class="flex items-center gap-2">
                  <UIcon name="i-heroicons-user-circle" class="w-4 h-4" />
                  <span class="font-medium">{{ selectedNote.owner_name }}</span>
                </span>
                <span class="flex items-center gap-2">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  <span>Updated {{ new Date(selectedNote.note_updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
                </span>
              </div>
            </header>

            <!-- Note Content - Premium Reading Experience -->
            <article class="prose prose-lg dark:prose-invert max-w-none">
              <div v-if="selectedNote.note_content" class="note-content" v-html="selectedNote.note_content"></div>
              <div v-else class="text-gray-400 dark:text-gray-500 italic text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                This note is empty.
              </div>
            </article>
          </div>
          <div v-else key="empty" class="flex items-center justify-center h-full">
            <div class="text-center space-y-5">
              <div class="w-24 h-24 mx-auto bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-400 dark:text-gray-600" />
              </div>
              <div>
                <p class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Select a note to view</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">Choose a note from the sidebar to get started</p>
              </div>
            </div>
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Smooth animations */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out;
}

/* Transition animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

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

/* Note content styling - same as folder page */
.note-content {
  color: rgb(17 24 39);
  animation: fade-in-up 0.5s ease-out;
}

.dark .note-content {
  color: rgb(243 244 246);
}

.note-content :deep(p) {
  margin-bottom: 1.75rem;
  line-height: 1.85;
  font-size: 1.125rem;
  color: rgb(31 41 55);
}

.dark .note-content :deep(p) {
  color: rgb(229 231 235);
}

.note-content :deep(h1) {
  font-size: 2.5rem;
  line-height: 3rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  margin-top: 3rem;
  color: rgb(17 24 39);
  letter-spacing: -0.02em;
}

.dark .note-content :deep(h1) {
  color: rgb(243 244 246);
}

.note-content :deep(h2) {
  font-size: 2rem;
  line-height: 2.5rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  margin-top: 2.5rem;
  color: rgb(17 24 39);
  letter-spacing: -0.01em;
}

.dark .note-content :deep(h2) {
  color: rgb(243 244 246);
}

.note-content :deep(h3) {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 2rem;
  color: rgb(17 24 39);
}

.dark .note-content :deep(h3) {
  color: rgb(243 244 246);
}

.note-content :deep(ul),
.note-content :deep(ol) {
  margin-bottom: 1.5rem;
  margin-left: 1.75rem;
}

.note-content :deep(li) {
  margin-bottom: 0.75rem;
  line-height: 1.8;
}

.note-content :deep(ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
  margin-left: 0;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"]) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
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
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
  border-radius: 0.25rem;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"][data-checked="true"] > div) {
  text-decoration: line-through;
  opacity: 0.6;
}

.note-content :deep(code) {
  background-color: rgb(243 244 246);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.dark .note-content :deep(code) {
  background-color: rgb(31 41 55);
}

.note-content :deep(pre) {
  background-color: rgb(243 244 246);
  padding: 1.25rem;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin-bottom: 1.5rem;
  border: 1px solid rgb(229 231 235);
}

.dark .note-content :deep(pre) {
  background-color: rgb(31 41 55);
  border-color: rgb(75 85 99);
}

.note-content :deep(blockquote) {
  border-left: 4px solid rgb(59 130 246);
  padding-left: 1.25rem;
  font-style: italic;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  color: rgb(107 114 128);
}

.dark .note-content :deep(blockquote) {
  color: rgb(156 163 175);
}

.note-content :deep(a) {
  color: rgb(59 130 246);
  text-decoration: underline;
  transition: color 0.2s;
}

.note-content :deep(a:hover) {
  color: rgb(37 99 235);
}

.note-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 2.5rem 0;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.note-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 2rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
}

.note-content :deep(th),
.note-content :deep(td) {
  border: 1px solid rgb(229 231 235);
  padding: 0.75rem;
}

.dark .note-content :deep(th),
.dark .note-content :deep(td) {
  border-color: rgb(75 85 99);
}

.note-content :deep(th) {
  background-color: rgb(249 250 251);
  font-weight: 600;
}

.dark .note-content :deep(th) {
  background-color: rgb(31 41 55);
}
</style>
