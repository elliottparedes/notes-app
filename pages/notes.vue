<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useNotesStore } from '~/stores/notes';
import { useFoldersStore } from '~/stores/folders';
import { useSpacesStore } from '~/stores/spaces';
import { useSharedNotesStore } from '~/stores/sharedNotes';
import { useToast } from '~/composables/useToast';
import { useNoteNavigation } from '~/composables/useNoteNavigation';
import type { Note, Space } from '~/types';

// New components
import NotebooksSidebar from '~/components/notes/NotebooksSidebar.vue';
import NoteListColumn from '~/components/notes/NoteListColumn.vue';
import NoteEditorPanel from '~/components/notes/NoteEditorPanel.vue';
import CreateFolderModal from '~/components/notes/CreateFolderModal.vue';
import DeleteSpaceModal from '~/components/notes/DeleteSpaceModal.vue';

// Composables
const { formatDate, formatTime, formatHeaderDate, getNoteLocation, getOrderedNotesForFolder } = useNotesFormatting();
const { handleOpenNote, handleCreateNoteInFolder, handleCloseActiveNote } = useNoteActions();
const folderActions = useFolderActions();
const {
  showCreateFolderModal,
  showFolderEditModal,
  editingFolder,
  openCreateFolderModal,
  openEditFolderModal,
  newFolderName,
  targetSpaceIdForFolderCreation
} = folderActions;
const spaceActions = useSpaceActions();
const {
  showDeleteSpaceModal,
  deletingSpaceId,
  isDeletingSpace,
  handleSelectSpace,
  handleDeleteSpace
} = spaceActions;
const { sidebarWidth, noteListWidth } = useSidebarResize();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();
const sharedNotesStore = useSharedNotesStore();
const toast = useToast();
const { navigateToNote } = useNoteNavigation();

// Initial loading state
const hasInitialized = ref(false);
const isLoadingNoteFromSearch = ref(false);
const searchQueryForHighlight = ref<string | null>(null);

// Selection State
const selectedFolderId = ref<number | null>(null);
const previousFolderId = ref<number | null>(null);

// Modal states
const showSearchModal = ref(false);
const showSpaceModal = ref(false);
const editingSpace = ref<Space | null>(null);

// View state
const currentView = ref<'notebooks' | 'storage'>('notebooks');
const isFullscreen = ref(false);

// Mobile view helper
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 1024;
});

// Active note
const activeNote = computed(() => notesStore.activeNote);

// Display notes for selected folder
const displayNotes = computed(() => getOrderedNotesForFolder(selectedFolderId.value));

// Continue writing & recent activity for mobile
const continueWritingNotes = computed(() => {
  return notesStore.notes
    .filter(n => !n.share_permission && n.title?.trim())
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);
});

const recentActivityNotes = computed(() => {
  return notesStore.notes
    .filter(n => !n.share_permission)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);
});

// View switching
watch(() => route.query.view, (view) => {
  if (view === 'storage') {
    router.replace('/storage');
  } else {
    currentView.value = 'notebooks';
  }
}, { immediate: true });

function switchToNotebooks() {
  // Already on notebooks
}

function switchToStorage() {
  router.push('/storage');
}

provide('switchView', { switchToNotebooks, switchToStorage });

// Data loading
async function loadData() {
  if (hasInitialized.value) return;

  try {
    await Promise.all([
      spacesStore.fetchSpaces(),
      foldersStore.fetchFolders(null),
      notesStore.fetchNotes(),
      sharedNotesStore.fetchSharedNotes(),
    ]);
    hasInitialized.value = true;
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.error('Failed to load data');
  }
}

// Search handling
async function handleSearchNoteSelected(note: Note | { id: string }, searchQuery?: string) {
  isLoadingNoteFromSearch.value = true;
  searchQueryForHighlight.value = searchQuery || null;

  try {
    await navigateToNote(note, spacesStore.expandedSpaceIds, (folderId) => {
      selectedFolderId.value = folderId;
    });
  } catch (error) {
    console.error('Failed to navigate to note from search:', error);
    toast.error('Failed to open note');
  } finally {
    isLoadingNoteFromSearch.value = false;
    setTimeout(() => {
      searchQueryForHighlight.value = null;
    }, 2000);
  }
}

// Fullscreen/Focus mode
function toggleFocusMode() {
  isFullscreen.value = !isFullscreen.value;
}

// Space modal handlers
function openEditSpaceModal(space: Space) {
  editingSpace.value = space;
  showSpaceModal.value = true;
}

function openCreateSpaceModal() {
  editingSpace.value = null;
  showSpaceModal.value = true;
}

// Folder handlers
function handleBackToHomeFromFolder() {
  selectedFolderId.value = null;
}

// Wrapped folder select to handle previousFolderId
async function handleFolderSelect(folderId: number) {
  await folderActions.handleSelectFolder(folderId, selectedFolderId, previousFolderId, handleOpenNote);
}

// Wrapped folder delete
async function handleFolderDelete(folderId: number) {
  await folderActions.handleDeleteFolder(folderId, selectedFolderId);
}

// Wrapped space delete confirm
async function handleConfirmDeleteSpace() {
  await spaceActions.confirmDeleteSpace(selectedFolderId);
}

function handleCancelDeleteSpace() {
  spaceActions.cancelDeleteSpace();
}

// Logout
async function handleLogout() {
  try {
    await authStore.logout();
  } catch (error) {
    console.error('Error logging out:', error);
    toast.error('Failed to log out');
  }
}

// Global keyboard shortcuts
function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
    e.preventDefault();
    showSearchModal.value = true;
  }
}

// Lifecycle
onMounted(async () => {
  await loadData();
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <AppLoadingScreen v-if="!hasInitialized" />
  <div v-else class="flex h-screen w-full bg-white dark:bg-gray-900 overflow-hidden">

    <!-- Desktop: Notebooks Sidebar -->
    <NotebooksSidebar
      v-if="currentView === 'notebooks'"
      :selected-folder-id="selectedFolderId"
      :is-fullscreen="isFullscreen"
      :sidebar-width="sidebarWidth"
      @select-folder="handleFolderSelect"
      @create-note-in-folder="handleCreateNoteInFolder"
      @delete-folder="handleFolderDelete"
      @open-search="showSearchModal = true"
      @open-create-space="openCreateSpaceModal"
      @open-create-folder="openCreateFolderModal"
      @logout="handleLogout"
      @edit-folder="openEditFolderModal"
    />

    <!-- Desktop: Note List Column -->
    <NoteListColumn
      v-if="currentView === 'notebooks'"
      :selected-folder-id="selectedFolderId"
      :note-list-width="noteListWidth"
      :is-fullscreen="isFullscreen"
      @open-note="handleOpenNote"
      @create-note-in-folder="handleCreateNoteInFolder"
    />

    <!-- Main Content Area -->
    <main v-if="currentView === 'notebooks'" class="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 relative">

      <!-- Desktop: Editor or Empty State -->
      <template v-if="!isMobileView">
        <NoteEditorPanel
          v-if="activeNote"
          :is-fullscreen="isFullscreen"
          :search-query-for-highlight="searchQueryForHighlight"
          @close-note="handleCloseActiveNote"
          @toggle-fullscreen="toggleFocusMode"
          @note-link-clicked="(id) => handleSearchNoteSelected({ id } as Note)"
        />
        <div v-else class="flex-1 flex items-start justify-center text-gray-500 dark:text-gray-400 pt-[50vh]">
          <div class="text-center">
            <UIcon name="i-heroicons-pencil-square" class="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p class="text-sm">Select a page to start editing</p>
          </div>
        </div>
      </template>

      <!-- Mobile: Active Note -->
      <template v-else-if="activeNote">
        <NoteEditorPanel
          :is-fullscreen="false"
          :search-query-for-highlight="searchQueryForHighlight"
          @close-note="handleCloseActiveNote"
          @toggle-fullscreen="toggleFocusMode"
          @note-link-clicked="(id) => handleSearchNoteSelected({ id } as Note)"
        />
      </template>

      <!-- Mobile: Folder Notes List -->
      <div
        v-else-if="selectedFolderId"
        class="lg:hidden flex-1 overflow-y-auto pb-28"
      >
        <div class="px-4 pt-6 pb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            class="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 active:scale-95 transition"
            @click="handleBackToHomeFromFolder"
          >
            <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
          </button>
          <div class="flex-1 min-w-0 text-center">
            <p class="text-xs uppercase tracking-wide text-gray-400">Section</p>
            <h1 class="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
              {{ foldersStore.getFolderById(selectedFolderId)?.name || 'Untitled section' }}
            </h1>
          </div>
          <button
            v-if="selectedFolderId"
            type="button"
            class="p-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 active:scale-95 transition"
            @click="handleCreateNoteInFolder(selectedFolderId)"
          >
            <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          </button>
        </div>

        <div class="px-4 space-y-4">
          <div v-if="notesStore.loading && displayNotes.length === 0" class="py-10 text-center text-gray-500">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto mb-2 animate-spin" />
            Loading notes...
          </div>

          <div v-else-if="displayNotes.length === 0" class="py-10 text-center text-gray-500 dark:text-gray-400">
            <p class="mb-3 text-sm">No notes in this section yet.</p>
          </div>

          <div v-else class="space-y-2">
            <button
              v-for="note in displayNotes"
              :key="note.id"
              type="button"
              class="w-full text-left rounded-2xl px-4 py-3 bg-gray-50/80 dark:bg-gray-800/80 active:scale-[0.99] transition flex flex-col gap-1"
              @click="handleOpenNote(note.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                  {{ note.title || 'Untitled note' }}
                </p>
                <span class="text-xs text-gray-400 whitespace-nowrap">
                  {{ formatTime(note.updated_at) }}
                </span>
              </div>
              <p class="text-[11px] text-gray-400">
                Last updated {{ formatDate(note.updated_at) }}
              </p>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile: Home View -->
      <div v-else class="lg:hidden flex-1 overflow-y-auto pb-28">
        <div class="px-4 pt-6 pb-4 flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-gray-400">Home</p>
            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-1">Welcome back</h1>
          </div>
          <button
            type="button"
            class="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 active:scale-95 transition"
            @click="showSearchModal = true"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
          </button>
        </div>

        <div class="px-4 space-y-6">
          <!-- Continue writing -->
          <section v-if="continueWritingNotes.length">
            <h2 class="text-xs uppercase tracking-wide text-gray-400 mb-3">Continue writing</h2>
            <div class="space-y-2">
              <button
                v-for="note in continueWritingNotes"
                :key="note.id"
                type="button"
                class="w-full text-left rounded-2xl px-4 py-3 bg-gradient-to-br from-primary-50/50 to-primary-100/30 dark:from-primary-900/20 dark:to-primary-800/10 border border-primary-200/50 dark:border-primary-700/30 active:scale-[0.99] transition"
                @click="handleOpenNote(note.id)"
              >
                <p class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate mb-1">
                  {{ note.title }}
                </p>
                <p class="text-[11px] text-gray-500 dark:text-gray-400">
                  {{ getNoteLocation(note).spaceName }} / {{ getNoteLocation(note).folderName }}
                </p>
              </button>
            </div>
          </section>

          <!-- Recent activity -->
          <section v-if="recentActivityNotes.length">
            <h2 class="text-xs uppercase tracking-wide text-gray-400 mb-3">Recent activity</h2>
            <div class="space-y-2">
              <button
                v-for="note in recentActivityNotes"
                :key="note.id"
                type="button"
                class="w-full text-left rounded-2xl px-4 py-3 bg-gray-50/80 dark:bg-gray-800/80 active:scale-[0.99] transition flex flex-col gap-1"
                @click="handleOpenNote(note.id)"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                    {{ note.title || 'Untitled note' }}
                  </p>
                  <span class="text-xs text-gray-400 whitespace-nowrap">
                    {{ formatTime(note.updated_at) }}
                  </span>
                </div>
                <p class="text-[11px] text-gray-400">
                  {{ getNoteLocation(note).spaceName }} / {{ getNoteLocation(note).folderName }}
                </p>
              </button>
            </div>
          </section>

          <!-- Browse spaces -->
          <section class="pb-4">
            <NuxtLink
              to="/settings"
              class="block w-full text-center rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 active:scale-[0.99] transition"
            >
              Account Settings
            </NuxtLink>
          </section>
        </div>
      </div>
    </main>

    <!-- Storage View (if applicable) -->
    <FileStorage v-if="currentView === 'storage'" />

    <!-- Modals -->
    <CreateFolderModal
      v-model="showCreateFolderModal"
      :target-space-id="targetSpaceIdForFolderCreation"
      @created="() => {}"
    />

    <DeleteSpaceModal
      v-model="showDeleteSpaceModal"
      :space-id="deletingSpaceId"
      :is-deleting="isDeletingSpace"
      @confirm="handleConfirmDeleteSpace"
      @cancel="handleCancelDeleteSpace"
    />

    <SpaceModal
      v-model:isOpen="showSpaceModal"
      :space="editingSpace"
      @created="spacesStore.fetchSpaces"
      @updated="spacesStore.fetchSpaces"
    />

    <FolderEditModal
      v-if="showFolderEditModal && editingFolder"
      v-model="showFolderEditModal"
      :folder="editingFolder"
    />

    <SearchModal
      v-model="showSearchModal"
      @selected="(note, isLoading, query) => handleSearchNoteSelected(note, query)"
      @loading-start="isLoadingNoteFromSearch = true"
    />
  </div>
</template>

<style scoped>
/* Preserve necessary styles */
</style>
