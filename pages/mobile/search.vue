<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useNotesStore } from '~/stores/notes';
import { useFoldersStore } from '~/stores/folders';
import { useSpacesStore } from '~/stores/spaces';
import { useAuthStore } from '~/stores/auth';
import type { Note } from '~/models';

const router = useRouter();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();
const authStore = useAuthStore();

const searchQuery = ref('');
const searchResults = ref<Note[]>([]);
const isSearching = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// Default: recently worked on notes (sorted by updated_at)
const recentlyWorkedOn = computed(() => {
  return notesStore.notes
    .filter((note) => !note.share_permission)
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 20);
});

// Perform search
async function performSearch(query: string) {
  if (!query.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  
  try {
    const results = await $fetch<Array<Note & { relevance_score: number; match_context?: string }>>('/api/notes/search', {
      params: { q: query.trim() },
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });

    searchResults.value = results.map(note => ({
      id: note.id,
      user_id: note.user_id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      is_favorite: note.is_favorite,
      folder: note.folder,
      folder_id: note.folder_id,
      created_at: note.created_at,
      updated_at: note.updated_at,
      is_shared: note.is_shared,
      share_permission: note.share_permission
    }));
  } catch (error) {
    console.error('Search failed:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
}

// Debounced search watcher
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newQuery) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  if (!newQuery.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(newQuery);
  }, 300);
});

// Get folder name for a note
function getFolderName(note: Note): string {
  if (!note.folder_id) return '';
  const folder = foldersStore.getFolderById(note.folder_id);
  return folder?.name || '';
}

// Get space name for a note
function getSpaceName(note: Note): string {
  if (!note.folder_id) return spacesStore.currentSpace?.name || 'Unknown';
  const folder = foldersStore.getFolderById(note.folder_id);
  if (folder) {
    const space = spacesStore.spaces.find(s => s.id === folder.space_id);
    return space?.name || 'Unknown';
  }
  return 'Unknown';
}

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

async function handleSelectNote(note: Note) {
  await notesStore.openTab(note.id);
  router.push(`/mobile/notes/${note.id}`);
}

// Helper to check if we're on mobile (client-side only)
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 1024;
});

// Responsive routing - redirect to dashboard if screen becomes desktop
watch(isMobileView, (isMobile) => {
  if (!isMobile && process.client) {
    // Screen became desktop size, redirect to dashboard
    router.replace('/notes');
  }
}, { immediate: false });

onMounted(() => {
  // Redirect if on desktop
  if (!isMobileView.value) {
    router.replace('/notes');
    return;
  }

  nextTick(() => {
    searchInputRef.value?.focus();
  });

  // Listen for window resize
  const handleResize = () => {
    if (window.innerWidth >= 1024) {
      router.replace('/notes');
    }
  };

  window.addEventListener('resize', handleResize);
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});

onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
});
</script>

<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-900 lg:hidden">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-50 mb-4">Search</h1>
      <div class="relative">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Search notes..."
          class="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto pb-6">
      <!-- Loading -->
      <div v-if="isSearching" class="p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">Searching...</p>
      </div>

      <!-- Search Results -->
      <div v-else-if="searchQuery.trim() && searchResults.length > 0" class="px-4 py-4 space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ searchResults.length }} results</p>
        <button
          v-for="note in searchResults"
          :key="note.id"
          @click="handleSelectNote(note)"
          class="w-full text-left rounded-xl bg-gray-50 dark:bg-gray-800/80 px-4 py-3 active:scale-[0.99] transition"
        >
          <div class="flex items-center justify-between gap-2 mb-1">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate flex-1">
              {{ note.title || 'Untitled note' }}
            </h3>
            <span class="text-xs text-gray-400 whitespace-nowrap">
              {{ formatDate(note.updated_at) }}
            </span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            <span v-if="getSpaceName(note)">{{ getSpaceName(note) }}</span>
            <span v-if="getFolderName(note)"> · {{ getFolderName(note) }}</span>
          </div>
        </button>
      </div>

      <!-- No Results -->
      <div v-else-if="searchQuery.trim() && !isSearching && searchResults.length === 0" class="p-8 text-center">
        <UIcon name="i-heroicons-document-minus" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No notes found</p>
      </div>

      <!-- Default: Recently Worked On -->
      <div v-else class="px-4 py-4">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Recently worked on</p>
        <div class="space-y-2">
          <button
            v-for="note in recentlyWorkedOn"
            :key="note.id"
            @click="handleSelectNote(note)"
            class="w-full text-left rounded-xl bg-gray-50 dark:bg-gray-800/80 px-4 py-3 active:scale-[0.99] transition"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate flex-1">
                {{ note.title || 'Untitled note' }}
              </h3>
              <span class="text-xs text-gray-400 whitespace-nowrap">
                {{ formatDate(note.updated_at) }}
              </span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              <span v-if="getSpaceName(note)">{{ getSpaceName(note) }}</span>
              <span v-if="getFolderName(note)"> · {{ getFolderName(note) }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

