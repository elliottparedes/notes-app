<script setup lang="ts">
import Fuse from 'fuse.js';
import type { PublishedFolderWithDetails, PublishedNoteWithDetails } from '~/models';

const route = useRoute();
const shareId = computed(() => route.params.shareId as string);
const publishedFolder = ref<PublishedFolderWithDetails | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const expandedFolders = ref<Set<number>>(new Set());
const selectedNote = ref<PublishedNoteWithDetails | null>(null);
const isLoadingNote = ref(false);
const isSidebarCollapsed = ref(false);

// Search functionality
const searchQuery = ref('');
const searchResults = ref<Array<{ item: PublishedNoteWithDetails; score: number; matches?: any }>>([]);
const allNotes = ref<PublishedNoteWithDetails[]>([]);
const isSearchActive = computed(() => searchQuery.value.trim().length > 0);
const searchContainerRef = ref<HTMLElement | null>(null);

// Client-side checks
const isClient = ref(false);
const hasShareAPI = ref(false);

// Collect all notes recursively
function collectAllNotes(folder: PublishedFolderWithDetails): PublishedNoteWithDetails[] {
  const notes: PublishedNoteWithDetails[] = [...folder.notes];
  folder.subfolders.forEach(subfolder => {
    notes.push(...collectAllNotes(subfolder));
  });
  return notes;
}

// Helper function to strip HTML tags and get plain text
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  // Create a temporary div to parse HTML and extract text
  if (process.client) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
  // Fallback for SSR: basic HTML tag removal
  return html.replace(/<[^>]*>/g, '').trim();
}

// Initialize Fuse.js for fuzzy search
const fuse = computed(() => {
  if (!allNotes.value.length) return null;
  
  return new Fuse(allNotes.value, {
    keys: [
      { name: 'note_title', weight: 0.8 },
      { name: 'note_content', weight: 0.2 }
    ],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true
  });
});

// Perform fuzzy search
watch([searchQuery, () => allNotes.value], () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  if (!fuse.value) {
    searchResults.value = [];
    return;
  }

  const results = fuse.value.search(searchQuery.value.trim());
  searchResults.value = results;
}, { immediate: true });

// Close search dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (searchContainerRef.value && !searchContainerRef.value.contains(event.target as Node)) {
    searchQuery.value = '';
  }
}

onMounted(async () => {
  isClient.value = true;
  hasShareAPI.value = typeof navigator !== 'undefined' && 'share' in navigator;
  
  // Add click outside listener
  document.addEventListener('click', handleClickOutside);
  
  try {
    const data = await $fetch<PublishedFolderWithDetails>(`/api/publish/folder/${shareId.value}`);
    publishedFolder.value = data;
    
    // Collect all notes for search
    if (publishedFolder.value) {
      allNotes.value = collectAllNotes(publishedFolder.value);
      
      // Expand all folders by default
      const expandAll = (folder: PublishedFolderWithDetails) => {
        expandedFolders.value.add(folder.folder_id);
        folder.subfolders.forEach(subfolder => expandAll(subfolder));
      };
      expandAll(publishedFolder.value);
    }
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to load published folder';
    console.error('Error loading published folder:', err);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
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
  // Add a small delay for smooth transition
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

function selectSearchResult(note: PublishedNoteWithDetails) {
  openNote(note.share_id);
  searchQuery.value = '';
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
  <div class="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
    <!-- Header -->
    <header class="border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 flex-shrink-0 transition-all duration-300">
      <div class="w-full px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <!-- Sidebar Toggle - Integrated in Header -->
            <button
              @click="isSidebarCollapsed = !isSidebarCollapsed"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex-shrink-0"
              :title="isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'"
            >
              <UIcon 
                :name="isSidebarCollapsed ? 'i-heroicons-bars-3' : 'i-heroicons-chevron-left'" 
                class="w-5 h-5 text-gray-600 dark:text-gray-400" 
              />
            </button>
            <div class="flex items-center gap-4">
              <div class="relative">
                <img src="/swan-unfold.png" alt="Unfold Notes" class="w-10 h-10 flex-shrink-0 transition-transform duration-300 hover:scale-110" />
              </div>
              <div>
                <h1 class="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-200">
                  {{ publishedFolder?.folder_name || 'Published Folder' }}
                </h1>
                <p v-if="publishedFolder" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ publishedFolder.notes.length + publishedFolder.subfolders.reduce((sum, f) => sum + f.notes.length + f.subfolders.length, 0) }} items
                </p>
              </div>
            </div>
          </div>
          <UButton
            v-if="hasShareAPI"
            icon="i-heroicons-share"
            color="primary"
            variant="soft"
            size="sm"
            class="transition-all duration-200 hover:scale-105"
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
            class="transition-all duration-200 hover:scale-105"
            @click="copyLink"
          >
            Copy Link
          </UButton>
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
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Folder Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="publishedFolder" class="flex-1 flex pt-[88px]">
      <!-- Sidebar - Folder Tree -->
      <aside 
        class="w-80 border-r border-gray-200/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm fixed top-[88px] left-0 bottom-0 overflow-y-auto flex-shrink-0 transition-all duration-300 shadow-lg"
        :class="isSidebarCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'"
      >
        <div class="p-6 space-y-6">
          <!-- Search Bar -->
          <div class="relative" ref="searchContainerRef">
            <div class="relative">
              <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search notes..."
                class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all duration-200"
                @click.stop
              />
            </div>
            
            <!-- Search Results -->
            <Transition name="fade-slide">
              <div v-if="isSearchActive && searchResults.length > 0" class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                <div class="p-2">
                  <div class="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Search Results ({{ searchResults.length }})
                  </div>
                  <div
                    v-for="(result, index) in searchResults"
                    :key="result.item.note_id"
                    class="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 group"
                    :class="selectedNote?.note_id === result.item.note_id ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
                    @click="selectSearchResult(result.item)"
                  >
                    <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {{ result.item.note_title }}
                      </div>
                      <div v-if="result.matches && result.matches[0]" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {{ stripHtml(result.item.note_content)?.substring(0, 60) || 'No content' }}...
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- No Results -->
            <Transition name="fade-slide">
              <div v-if="isSearchActive && searchResults.length === 0 && searchQuery.trim().length >= 2" class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 text-center z-50">
                <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p class="text-sm text-gray-500 dark:text-gray-400">No notes found</p>
              </div>
            </Transition>
          </div>

          <!-- Notes in root folder -->
          <div v-if="!isSearchActive && publishedFolder.notes.length > 0" class="space-y-1">
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">
              Notes
            </h3>
            <TransitionGroup name="list" tag="div">
              <div
                v-for="note in publishedFolder.notes"
                :key="note.note_id"
                class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group"
                :class="selectedNote?.note_id === note.note_id 
                  ? 'bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-800/20 text-primary-700 dark:text-primary-300 shadow-sm' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'"
                @click="openNote(note.share_id)"
              >
                <UIcon name="i-heroicons-document-text" class="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span class="text-sm font-medium truncate flex-1">{{ note.note_title }}</span>
              </div>
            </TransitionGroup>
          </div>

          <!-- Subfolders -->
          <div v-if="!isSearchActive && publishedFolder.subfolders.length > 0" class="space-y-1">
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">
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
          <div v-if="!isSearchActive && publishedFolder.notes.length === 0 && publishedFolder.subfolders.length === 0" class="text-center py-12">
            <UIcon name="i-heroicons-folder-open" class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p class="text-sm text-gray-500 dark:text-gray-400">This folder is empty</p>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main 
        class="flex-1 overflow-y-auto bg-white dark:bg-gray-900 transition-all duration-300"
        :class="isSidebarCollapsed ? 'ml-0' : 'ml-80'"
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
          <div v-else-if="selectedNote" key="note" class="max-w-4xl mx-auto px-8 py-12">
            <!-- Note Header -->
            <header class="mb-10 pb-8 border-b border-gray-200 dark:border-gray-800 animate-fade-in">
              <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                {{ selectedNote.note_title }}
              </h1>
              <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span v-if="selectedNote.owner_name" class="flex items-center gap-1.5">
                  <UIcon name="i-heroicons-user" class="w-4 h-4" />
                  Published by {{ selectedNote.owner_name }}
                </span>
                <span class="flex items-center gap-1.5">
                  <UIcon name="i-heroicons-clock" class="w-4 h-4" />
                  Updated {{ new Date(selectedNote.note_updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                </span>
              </div>
            </header>

            <!-- Note Content -->
            <article class="prose prose-lg dark:prose-invert max-w-none animate-fade-in-up">
              <div v-if="selectedNote.note_content" class="note-content" v-html="selectedNote.note_content"></div>
              <div v-else class="text-gray-500 dark:text-gray-400 italic text-center py-12">
                This note is empty.
              </div>
            </article>
          </div>
          <div v-else key="empty" class="flex items-center justify-center h-full">
            <div class="text-center space-y-4 animate-fade-in">
              <div class="w-20 h-20 mx-auto bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 rounded-2xl flex items-center justify-center">
                <UIcon name="i-heroicons-document-text" class="w-10 h-10 text-primary-600 dark:text-primary-400" />
              </div>
              <p class="text-lg font-medium text-gray-700 dark:text-gray-300">Select a note to view</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Choose from the sidebar or search for a note</p>
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

/* Note content styling */
.note-content {
  color: rgb(17 24 39);
  animation: fade-in-up 0.5s ease-out;
}

.dark .note-content {
  color: rgb(243 244 246);
}

.note-content :deep(p) {
  margin-bottom: 1.5rem;
  line-height: 1.8;
  font-size: 1.0625rem;
}

.note-content :deep(h1) {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  margin-top: 2.5rem;
  color: rgb(17 24 39);
}

.dark .note-content :deep(h1) {
  color: rgb(243 244 246);
}

.note-content :deep(h2) {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 2rem;
  color: rgb(17 24 39);
}

.dark .note-content :deep(h2) {
  color: rgb(243 244 246);
}

.note-content :deep(h3) {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
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

/* Task list styles */
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
  border-radius: 0.75rem;
  margin: 2rem 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
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
