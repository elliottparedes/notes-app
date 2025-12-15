<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotesStore } from '~/stores/notes';
import { useFoldersStore } from '~/stores/folders';
import { useSpacesStore } from '~/stores/spaces';
import { useToast } from '~/composables/useToast';
import type { Note } from '~/models';

const router = useRouter();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();
const toast = useToast();

// Current view: 'notebooks' or 'storage'
const currentView = ref<'notebooks' | 'storage'>('notebooks');
const showViewDropdown = ref(false);
const showSettingsMenu = ref(false);

// Expanded spaces
const expandedSpaceIds = ref<Set<number>>(new Set());

// Folder menu state
const openFolderMenuId = ref<number | null>(null);
const showCreateFolderModal = ref(false);
const newFolderName = ref('');
const targetSpaceIdForFolderCreation = ref<number | undefined>(undefined);
const isCreatingFolder = ref(false);

// Most recently edited notes (6 for carousel)
const recentNotes = computed(() => {
  return notesStore.notes
    .filter((note) => !note.share_permission)
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);
});

// Get note location
function getNoteLocation(note: Note) {
  if (!note.folder_id) return {};
  const folder = foldersStore.getFolderById(note.folder_id);
  if (!folder) return {};
  const space = spacesStore.spaces.find((s) => s.id === folder.space_id);
  return {
    spaceName: space?.name,
    folderName: folder.name
  };
}

function formatTime(date: string | Date): string {
  if (!date) return '';
  let d = new Date(date);
  if (typeof date === 'string') {
    if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      d = new Date(date.replace(' ', 'T') + 'Z');
    } else if (date.indexOf('T') !== -1 && !date.endsWith('Z') && !date.includes('+') && !date.match(/-\d{2}:\d{2}$/)) {
      d = new Date(date + 'Z');
    }
  }
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDate(date: string | Date): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

async function handleOpenNote(noteId: string) {
  await notesStore.openTab(noteId);
  // Navigate to mobile note view
  router.push(`/mobile/notes/${noteId}`);
}

function toggleSpace(spaceId: number) {
  if (expandedSpaceIds.value.has(spaceId)) {
    expandedSpaceIds.value.delete(spaceId);
  } else {
    expandedSpaceIds.value.add(spaceId);
    spacesStore.setCurrentSpace(spaceId);
  }
}

function getSpaceFolders(spaceId: number) {
  return foldersStore.folders.filter(f => f.space_id === spaceId);
}

function getFolderNotes(folderId: number) {
  return notesStore.notes.filter(n => n.folder_id === folderId && !n.share_permission);
}

function toggleFolder(folderId: number) {
  foldersStore.toggleFolder(folderId);
}

// Get ordered notes for a folder
function getOrderedNotesForFolder(folderId: number) {
  const notesInFolder = notesStore.notes.filter(note => 
    note.folder_id === folderId && !note.share_permission
  );

  const folderKey = `folder_${folderId}`;
  const order = notesStore.noteOrder[folderKey];

  if (order && order.length > 0) {
    return notesInFolder.sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      if (indexA === -1 && indexB !== -1) return 1;
      if (indexA !== -1 && indexB === -1) return -1;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  return notesInFolder.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

async function handleCreateNoteInFolder(folderId: number) {
  try {
    const newNote = await notesStore.createNote({
      title: '',
      content: '',
      folder_id: folderId
    });
    await handleOpenNote(newNote.id);
    openFolderMenuId.value = null;
  } catch (error) {
    toast.error('Failed to create note');
  }
}

async function handleDeleteFolder(folderId: number) {
  try {
    await foldersStore.deleteFolder(folderId);
    toast.success('Folder deleted');
    openFolderMenuId.value = null;
  } catch (error) {
    toast.error('Failed to delete folder');
  }
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim() || isCreatingFolder.value) return;
  
  isCreatingFolder.value = true;
  try {
    await foldersStore.createFolder({
      name: newFolderName.value.trim(),
      space_id: targetSpaceIdForFolderCreation.value || spacesStore.currentSpaceId || undefined
    });
    showCreateFolderModal.value = false;
    newFolderName.value = '';
    toast.success('Folder created');
  } catch (error) {
    toast.error('Failed to create folder');
  } finally {
    isCreatingFolder.value = false;
  }
}

function openCreateFolderModal(spaceId?: number) {
  newFolderName.value = '';
  targetSpaceIdForFolderCreation.value = spaceId;
  showCreateFolderModal.value = true;
}

// Initialize expanded state
watch(() => spacesStore.currentSpaceId, (newId) => {
  if (newId !== null && !expandedSpaceIds.value.has(newId)) {
    expandedSpaceIds.value.add(newId);
  }
}, { immediate: true });

// Helper to check if we're on mobile (client-side only)
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 768;
});

// Responsive routing - redirect to dashboard if screen becomes desktop
watch(isMobileView, (isMobile) => {
  if (!isMobile && process.client) {
    // Screen became desktop size, redirect to dashboard
    router.replace('/dashboard');
  }
}, { immediate: false });

// Watch for window resize
onMounted(async () => {
  // Redirect if on desktop
  if (!isMobileView.value) {
    router.replace('/dashboard');
    return;
  }

  try {
    await Promise.all([
      spacesStore.fetchSpaces(),
      foldersStore.fetchFolders(null),
      notesStore.fetchNotes()
    ]);
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.error('Failed to load data');
  }

  // Listen for window resize
  const handleResize = () => {
    if (window.innerWidth >= 768) {
      // Screen became desktop, redirect
      router.replace('/dashboard');
    }
  };

  window.addEventListener('resize', handleResize);
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});

// Close dropdowns when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-view-dropdown]')) {
      showViewDropdown.value = false;
    }
    if (!target.closest('[data-settings-menu]')) {
      showSettingsMenu.value = false;
    }
  };
  document.addEventListener('click', handleClickOutside);
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
});
</script>

<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-900 md:hidden">
    <!-- Top Nav (Mobile Only) -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <!-- App Dropdown (Left) -->
      <div class="relative" data-view-dropdown>
        <button
          @click.stop="showViewDropdown = !showViewDropdown"
          class="flex items-center gap-1.5 font-medium text-sm text-gray-900 dark:text-gray-100"
        >
          <span>{{ currentView === 'notebooks' ? 'Notes' : 'Storage' }}</span>
          <UIcon 
            name="i-heroicons-chevron-down" 
            class="w-4 h-4 transition-transform"
            :class="{ 'rotate-180': showViewDropdown }"
          />
        </button>
        
        <!-- Dropdown Menu -->
        <Transition
          enter-active-class="transition-opacity duration-100"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showViewDropdown"
            class="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 z-50 rounded-lg"
            @click.stop
          >
            <button
              @click="currentView = 'notebooks'; showViewDropdown = false"
              class="w-full text-left px-3 py-2 text-sm transition-colors"
              :class="currentView === 'notebooks' 
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            >
              Notes
            </button>
            <button
              @click="router.push('/mobile/storage'); showViewDropdown = false"
              class="w-full text-left px-3 py-2 text-sm transition-colors"
              :class="currentView === 'storage' 
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            >
              Storage
            </button>
          </div>
        </Transition>
      </div>
      
      <!-- Three Dot Menu (Right) -->
      <div class="relative" data-settings-menu>
        <button
          @click.stop="showSettingsMenu = !showSettingsMenu"
          class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="8" cy="2" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="8" cy="14" r="1.5"/>
          </svg>
        </button>
        
        <!-- Settings Menu -->
        <Transition
          enter-active-class="transition-opacity duration-100"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showSettingsMenu"
            class="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 z-50 rounded-lg"
            @click.stop
          >
            <NuxtLink
              to="/settings"
              @click="showSettingsMenu = false"
              class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4" />
              <span>Settings</span>
            </NuxtLink>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto pb-20">
      <div class="px-4 pt-6 pb-4">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-50">Home</h1>
      </div>

      <div class="px-4 space-y-6 pb-6">
        <!-- Jump back in section (Carousel) -->
        <section v-if="recentNotes.length > 0">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">Jump back in</h2>
          </div>
          <div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <button
              v-for="note in recentNotes"
              :key="note.id"
              @click="handleOpenNote(note.id)"
              class="flex-shrink-0 w-64 rounded-xl bg-gray-50 dark:bg-gray-800/80 px-4 py-3 active:scale-[0.98] transition text-left"
            >
              <div class="flex items-center justify-between gap-2 mb-1">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-50 truncate flex-1">
                  {{ note.title || 'Untitled note' }}
                </p>
                <span class="text-xs text-gray-400 whitespace-nowrap">
                  {{ formatTime(note.updated_at) }}
                </span>
              </div>
              <div class="text-[11px] text-gray-400">
                <template v-if="getNoteLocation(note).spaceName">
                  {{ getNoteLocation(note).spaceName }}<span v-if="getNoteLocation(note).folderName"> · {{ getNoteLocation(note).folderName }}</span>
                </template>
              </div>
            </button>
          </div>
        </section>

        <!-- Notebook/Folder Tree -->
        <section>
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Notebooks</h2>
          <div class="space-y-3">
            <div
              v-for="space in spacesStore.spaces"
              :key="space.id"
              class="rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <!-- Space Header -->
              <div class="flex items-center justify-between p-3">
                <button
                  @click="toggleSpace(space.id)"
                  class="flex-1 flex items-center gap-2 text-left"
                >
                  <UIcon 
                    :name="expandedSpaceIds.has(space.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
                    class="w-4 h-4 text-gray-500 dark:text-gray-400"
                  />
                  <UIcon 
                    :name="space.icon ? `i-lucide-${space.icon}` : 'i-heroicons-book-open'" 
                    class="w-4 h-4 text-gray-700 dark:text-gray-300"
                  />
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ space.name }}</span>
                </button>
                
                <!-- Three dot menu for space -->
                <div class="relative">
                  <button
                    @click.stop="openCreateFolderModal(space.id)"
                    class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Add folder"
                  >
                    <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Folders (Sections) -->
              <div v-show="expandedSpaceIds.has(space.id)" class="pl-4 pb-2 space-y-1">
                <div
                  v-for="folder in getSpaceFolders(space.id)"
                  :key="folder.id"
                  class="rounded border border-gray-200 dark:border-gray-700"
                >
                  <!-- Folder Header -->
                  <div class="flex items-center justify-between p-2">
                    <button
                      @click="toggleFolder(folder.id)"
                      class="flex-1 flex items-center gap-2 text-left"
                    >
                      <UIcon 
                        :name="foldersStore.expandedFolderIds.has(folder.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" 
                        class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400"
                      />
                      <UIcon name="i-heroicons-folder" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span class="text-sm text-gray-700 dark:text-gray-300">{{ folder.name }}</span>
                      <span v-if="getFolderNotes(folder.id).length > 0" class="text-xs text-gray-400">
                        ({{ getFolderNotes(folder.id).length }})
                      </span>
                    </button>
                    
                    <!-- Three dot menu for folder -->
                    <div class="relative">
                      <button
                        @click.stop="openFolderMenuId = openFolderMenuId === folder.id ? null : folder.id"
                        class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <circle cx="8" cy="2" r="1.5"/>
                          <circle cx="8" cy="8" r="1.5"/>
                          <circle cx="8" cy="14" r="1.5"/>
                        </svg>
                      </button>
                      
                      <!-- Folder Menu Dropdown -->
                      <Transition
                        enter-active-class="transition-opacity duration-100"
                        enter-from-class="opacity-0"
                        enter-to-class="opacity-100"
                        leave-active-class="transition-opacity duration-100"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <div
                          v-if="openFolderMenuId === folder.id"
                          class="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 z-50 rounded-lg"
                          @click.stop
                        >
                          <button
                            @click="handleCreateNoteInFolder(folder.id)"
                            class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                            <span>Add note</span>
                          </button>
                          <button
                            @click="handleDeleteFolder(folder.id)"
                            class="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </Transition>
                    </div>
                  </div>

                  <!-- Notes inside folder -->
                  <div v-show="foldersStore.expandedFolderIds.has(folder.id)" class="pl-6 pr-2 pb-2 space-y-1">
                    <div v-if="getOrderedNotesForFolder(folder.id).length === 0" class="px-2 py-1 text-xs text-gray-400">
                      No notes yet
                    </div>
                    <button
                      v-for="note in getOrderedNotesForFolder(folder.id)"
                      :key="note.id"
                      @click="handleOpenNote(note.id)"
                      class="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:scale-[0.98] transition text-sm"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-gray-900 dark:text-gray-100 truncate flex-1">
                          {{ note.title || 'Untitled note' }}
                        </span>
                        <span class="text-xs text-gray-400 whitespace-nowrap">
                          {{ formatTime(note.updated_at) }}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Create Folder Modal -->
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
            v-if="showCreateFolderModal" 
            class="fixed inset-0 z-50 overflow-y-auto"
            @click.self="showCreateFolderModal = false"
          >
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div 
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5 rounded-lg"
                @click.stop
              >
                <h3 class="text-base font-semibold mb-3 text-gray-900 dark:text-white">Create New Folder</h3>
                <input
                  v-model="newFolderName"
                  type="text"
                  placeholder="Folder Name"
                  class="mb-3 w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                  autofocus
                  @keyup.enter="handleCreateFolder"
                />
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    @click="showCreateFolderModal = false"
                    class="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="handleCreateFolder"
                    :disabled="isCreatingFolder"
                    class="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2"
                  >
                    <UIcon 
                      v-if="isCreatingFolder" 
                      name="i-heroicons-arrow-path" 
                      class="w-4 h-4 animate-spin" 
                    />
                    <span>Create</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Backdrop for folder menu -->
    <div
      v-if="openFolderMenuId !== null"
      class="fixed inset-0 z-40 md:hidden"
      @click="openFolderMenuId = null"
    />

    <!-- Mobile Bottom Navigation -->
    <MobileBottomNav />
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

