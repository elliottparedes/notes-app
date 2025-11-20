<script setup lang="ts">
import Fuse from 'fuse.js';
import type { Note, Folder } from '~/models';
import { useNotesStore } from '~/stores/notes';
import { useSpacesStore } from '~/stores/spaces';
import { useFoldersStore } from '~/stores/folders';
import { useAuthStore } from '~/stores/auth';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'selected', note: Note, isLoading?: boolean): void;
  (e: 'loading-start'): void; // Emit before selection to set loading state immediately
}>();

const notesStore = useNotesStore();
const spacesStore = useSpacesStore();
const foldersStore = useFoldersStore();
const authStore = useAuthStore();
const searchQuery = ref('');
const selectedIndex = ref(0);
const searchResults = ref<Array<{ item: Note; score: number; matches?: any }>>([]);
const searchInputRef = ref<HTMLInputElement | null>(null);
const allNotes = ref<Note[]>([]);
const isLoadingNotes = ref(false);

// Fetch all notes from all spaces when modal opens
async function loadAllNotes() {
  if (isLoadingNotes.value) return;
  
  isLoadingNotes.value = true;
  try {
    // Load folders for all spaces to enable space name lookup
    // Fetch folders without space_id filter to get all folders
    if (authStore.token && process.client) {
      try {
        const allFolders = await $fetch<Folder[]>('/api/folders', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        // Merge all folders into the store (they're already there from different spaces, but ensure we have all)
        const existingFolderIds = new Set(foldersStore.folders.map(f => f.id));
        const newFolders = allFolders.filter(f => !existingFolderIds.has(f.id));
        if (newFolders.length > 0) {
          foldersStore.folders.push(...newFolders);
        }
      } catch (err) {
        console.warn('[SearchModal] Failed to load all folders, continuing with existing folders:', err);
      }
    }
    
    const notes = await notesStore.fetchAllNotesForSearch();
    allNotes.value = notes;
  } catch (error) {
    console.error('[SearchModal] Failed to load all notes:', error);
    // Fallback to current space notes
    allNotes.value = notesStore.notes;
  } finally {
    isLoadingNotes.value = false;
  }
}

// Initialize Fuse.js with all notes
const fuse = computed(() => {
  if (!allNotes.value.length) return null;
  
  return new Fuse(allNotes.value, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'content', weight: 0.3 },
      { name: 'tags', weight: 0.2 }
    ],
    threshold: 0.4, // Lower = stricter matching (0.0 = exact match, 1.0 = match anything)
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true
  });
});

// Perform fuzzy search when query changes
watch([searchQuery, allNotes], () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    selectedIndex.value = 0;
    return;
  }

  if (!fuse.value) {
    searchResults.value = [];
    return;
  }

  const results = fuse.value.search(searchQuery.value.trim());
  searchResults.value = results;
  selectedIndex.value = 0;
}, { immediate: true });

// Reset when modal opens/closes
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = '';
    selectedIndex.value = 0;
    // Load all notes from all spaces when modal opens
    await loadAllNotes();
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  } else {
    searchQuery.value = '';
    searchResults.value = [];
  }
});

// Get space name for a note
function getSpaceName(note: Note): string {
  if (!note.folder_id) {
    // Note without folder - try to determine space
    // For now, show current space or "Unknown"
    return spacesStore.currentSpace?.name || 'Unknown Space';
  }
  
  // Find folder and get its space
  const folder = foldersStore.getFolderById(note.folder_id);
  if (folder) {
    const space = spacesStore.spaces.find(s => s.id === folder.space_id);
    return space?.name || 'Unknown Space';
  }
  
  return 'Unknown Space';
}

// Get space ID for a note (to switch spaces when selecting)
function getSpaceId(note: Note): number | null {
  if (!note.folder_id) {
    // Note without folder - return current space
    return spacesStore.currentSpaceId;
  }
  
  // Find folder and get its space
  const folder = foldersStore.getFolderById(note.folder_id);
  if (folder) {
    return folder.space_id;
  }
  
  return spacesStore.currentSpaceId;
}

function closeModal() {
  emit('update:isOpen', false);
}

function selectNote(note: Note) {
  console.log('[SearchModal] selectNote called:', {
    noteId: note.id,
    timestamp: Date.now()
  });
  
  // CRITICAL: Set loading state BEFORE closing modal to prevent flash
  console.log('[SearchModal] Emitting loading-start...');
  emit('loading-start');
  
  // Emit the selected event immediately - let parent handle space switching
  console.log('[SearchModal] Emitting selected event...');
  emit('selected', note, true);
  
  // Close modal immediately
  console.log('[SearchModal] Closing modal...');
  closeModal();
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.isOpen) return;

  if (event.key === 'Escape') {
    closeModal();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, searchResults.value.length - 1);
    // Scroll into view
    nextTick(() => {
      const selectedEl = document.querySelector(`[data-search-result-index="${selectedIndex.value}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    // Scroll into view
    nextTick(() => {
      const selectedEl = document.querySelector(`[data-search-result-index="${selectedIndex.value}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return;
  }

  if (event.key === 'Enter' && searchResults.value.length > 0) {
    event.preventDefault();
    const selectedResult = searchResults.value[selectedIndex.value];
    if (selectedResult) {
      selectNote(selectedResult.item);
    }
    return;
  }
}

// Handle keyboard events
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// Format date helper
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// Get preview text from note content
function getPreview(note: Note, maxLength: number = 150): string {
  if (!note.content) return 'No content';
  
  // Strip markdown and HTML for preview
  const text = note.content
    .replace(/[#*`_~\[\]]/g, '') // Remove markdown formatting
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Highlight search matches
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded">$1</mark>');
}
</script>

<template>
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
          v-if="isOpen" 
          class="fixed inset-0 z-50 overflow-y-auto"
          @click.self="closeModal"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
          
          <!-- Modal -->
          <div class="flex min-h-full items-start justify-center p-4 pt-20">
            <Transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95 translate-y-4"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 translate-y-4"
            >
              <div 
                v-if="isOpen"
                class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full overflow-hidden"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
                  <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <input
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search notes... (Ctrl+P)"
                    autofocus
                    class="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 text-lg"
                  />
                  <button
                    type="button"
                    @click="closeModal"
                    class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                  </button>
                </div>
                
                <!-- Results -->
                <div class="max-h-96 overflow-y-auto">
                  <!-- Empty state -->
                  <div v-if="!searchQuery.trim()" class="p-8 text-center">
                    <UIcon name="i-heroicons-magnifying-glass" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p class="text-gray-500 dark:text-gray-400 text-sm">Start typing to search your notes</p>
                  </div>

                  <!-- No results -->
                  <div v-else-if="searchQuery.trim() && searchResults.length === 0" class="p-8 text-center">
                    <UIcon name="i-heroicons-document-x-mark" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p class="text-gray-500 dark:text-gray-400 text-sm">No notes found matching "{{ searchQuery }}"</p>
                  </div>

                  <!-- Results list -->
                  <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
                    <button
                      v-for="(result, index) in searchResults"
                      :key="result.item.id"
                      :data-search-result-index="index"
                      @click="selectNote(result.item)"
                      class="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      :class="{
                        'bg-gray-50 dark:bg-gray-700/50': selectedIndex === index
                      }"
                    >
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 mt-1">
                          <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-gray-400" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <h3 
                              class="font-semibold text-gray-900 dark:text-white truncate"
                              v-html="highlightText(result.item.title || 'Untitled', searchQuery)"
                            ></h3>
                            <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                              {{ formatDate(result.item.updated_at) }}
                            </span>
                          </div>
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <UIcon name="i-heroicons-folder" class="w-3 h-3" />
                              {{ getSpaceName(result.item) }}
                            </span>
                          </div>
                          <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            <span v-html="highlightText(getPreview(result.item), searchQuery)"></span>
                          </p>
                          <div v-if="result.item.tags && result.item.tags.length > 0" class="flex items-center gap-1 mt-2 flex-wrap">
                            <UIcon name="i-heroicons-tag" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span
                              v-for="tag in result.item.tags"
                              :key="tag"
                              class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                            >
                              {{ tag }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <!-- Footer -->
                <div v-if="searchResults.length > 0" class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{{ searchResults.length }} {{ searchResults.length === 1 ? 'note' : 'notes' }} found</span>
                    <div class="flex items-center gap-4">
                      <span class="flex items-center gap-1">
                        <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">↑</kbd>
                        <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">↓</kbd>
                        <span>Navigate</span>
                      </span>
                      <span class="flex items-center gap-1">
                        <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Enter</kbd>
                        <span>Select</span>
                      </span>
                      <span class="flex items-center gap-1">
                        <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd>
                        <span>Close</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
mark {
  background-color: rgba(254, 240, 138, 0.5);
}

.dark mark {
  background-color: rgba(161, 98, 7, 0.3);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
