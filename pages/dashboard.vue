<script setup lang="ts">
import type { Note, CreateNoteDto } from '~/models';
import type { NoteTemplate } from '~/types/noteTemplate';
import { noteTemplates } from '~/utils/noteTemplates';

// Stores
const authStore = useAuthStore();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const toast = useToast();
const router = useRouter();
const route = useRoute();

// Network status
const { isOnline } = useNetworkStatus();

// State
const searchQuery = ref('');
const selectedFolderId = ref<number | null>(null);
const loading = ref(false);
const isCreating = ref(false);
const hasInitialized = ref(false);

// View mode state (grid or list)
const viewMode = ref<'grid' | 'list'>('grid');

// Mobile menu state
const isMobileSidebarOpen = ref(false);
const isSearchExpanded = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// FAB menu state
const showFabMenu = ref(false);

// User menu state
const showUserMenu = ref(false);

// Delete confirmation modal
const showDeleteModal = ref(false);
const noteToDelete = ref<Note | null>(null);
const isDeleting = ref(false);

// Folder management modals
const showCreateFolderModal = ref(false);
const showRenameFolderModal = ref(false);
const showDeleteFolderModal = ref(false);
const newFolderName = ref('');
const newFolderParentId = ref<number | null>(null);
const renameFolderName = ref('');
const folderToManage = ref<number | null>(null);
const isFolderActionLoading = ref(false);

// AI generation modal
const showAiGenerateModal = ref(false);
const aiPrompt = ref('');
const isGeneratingAi = ref(false);

// Template selection modal
const showTemplateModal = ref(false);

// Save view mode preference
function setViewMode(mode: 'grid' | 'list') {
  viewMode.value = mode;
  if (process.client) {
    localStorage.setItem('notes_view_mode', mode);
  }
}

// Session key to force re-render on new sessions
const sessionKey = ref('default');

// Watch search expansion to focus input
watch(isSearchExpanded, (expanded) => {
  if (expanded) {
    // Wait for both the DOM update and the transition to start
    nextTick(() => {
      setTimeout(() => {
        searchInputRef.value?.focus();
      }, 50); // Small delay to ensure transition has started
    });
  }
});

// Close menus when clicking anywhere
if (process.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    const isUserButton = target.closest('[data-user-menu-button]');
    const isUserDropdown = target.closest('[data-user-menu-dropdown]');
    const isFabButton = target.closest('[data-fab-button]');
    const isFabMenu = target.closest('[data-fab-menu]');
    
    if (!isUserButton && !isUserDropdown) {
      showUserMenu.value = false;
    }
    
    if (!isFabButton && !isFabMenu) {
      showFabMenu.value = false;
    }
  });
}

// Fetch data on mount
// Function to load all data
async function loadData() {
  loading.value = true;
  try {
    await Promise.all([
      foldersStore.fetchFolders(),
      notesStore.fetchNotes(),
      notesStore.updatePendingChangesCount()
    ]);
    hasInitialized.value = true;
  } catch (error) {
    console.error('Failed to load data:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to load data',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (process.client) {
    // Load session version
    sessionKey.value = localStorage.getItem('session_version') || 'default';
    
    // Load view mode preference
    const savedViewMode = localStorage.getItem('notes_view_mode') as 'grid' | 'list' | null;
    if (savedViewMode) {
      viewMode.value = savedViewMode;
    }
    
    // Restore selected folder from sessionStorage
    const savedFolderId = sessionStorage.getItem('selected_folder_id');
    if (savedFolderId && savedFolderId !== 'null') {
      selectedFolderId.value = parseInt(savedFolderId);
    }
  }

  await loadData();
});

// Refresh notes when navigating back (onActivated for KeepAlive)
onActivated(async () => {
  // Only refresh if already initialized (skip first mount)
  if (hasInitialized.value) {
    try {
      await Promise.all([
        foldersStore.fetchFolders(),
        notesStore.fetchNotes(),
        notesStore.updatePendingChangesCount()
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }
});

// Watch for navigation back to dashboard (alternative to onActivated)
watch(() => route.path, async (newPath) => {
  if (newPath === '/dashboard' && hasInitialized.value) {
    // Restore selected folder from sessionStorage
    if (process.client) {
      const savedFolderId = sessionStorage.getItem('selected_folder_id');
      if (savedFolderId && savedFolderId !== 'null') {
        selectedFolderId.value = parseInt(savedFolderId);
      } else {
        selectedFolderId.value = null;
      }
    }
    
    // Refresh data when navigating back to dashboard
    try {
      await Promise.all([
        notesStore.fetchNotes(),
        foldersStore.fetchFolders(),
        notesStore.updatePendingChangesCount()
      ]);
    } catch (error) {
      console.error('Failed to refresh on navigation:', error);
    }
  }
}, { immediate: false });

// Watch for network status changes
watch(isOnline, async (online, wasOnlineValue) => {
  if (online && wasOnlineValue === false) {
    toast.add({
      title: 'Back Online',
      description: 'Syncing your notes...',
      color: 'success'
    });
    
    try {
      await notesStore.syncWithServer();
      await notesStore.updatePendingChangesCount();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  } else if (!online) {
    toast.add({
      title: 'Offline Mode',
      description: 'Changes will sync when you\'re back online',
      color: 'warning'
    });
  }
});

// Apply filters
watch([searchQuery, selectedFolderId], () => {
  notesStore.setFilters({
    search: searchQuery.value || undefined,
    folder_id: selectedFolderId.value !== null ? selectedFolderId.value : undefined
  });
});

const displayedNotes = computed(() => notesStore.filteredNotes);

const userInitial = computed(() => {
  const name = (authStore.currentUser?.name || authStore.currentUser?.email || 'User') as string;
  return name.charAt(0).toUpperCase();
});

// Breadcrumb path for current folder
const folderBreadcrumb = computed(() => {
  if (selectedFolderId.value === null) {
    return [];
  }
  
  const breadcrumb: Array<{ id: number; name: string }> = [];
  let currentId: number | null = selectedFolderId.value;
  
  // Build breadcrumb by traversing up parent folders
  while (currentId !== null) {
    const folder = foldersStore.getFolderById(currentId);
    if (!folder) break;
    
    breadcrumb.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  
  return breadcrumb;
});

// Folder selection
function selectFolder(folderId: number) {
  selectedFolderId.value = folderId;
  isMobileSidebarOpen.value = false;
  // Persist selected folder to sessionStorage
  if (process.client) {
    sessionStorage.setItem('selected_folder_id', String(folderId));
  }
}

function selectAllNotes() {
  selectedFolderId.value = null;
  isMobileSidebarOpen.value = false;
  // Clear persisted folder selection
  if (process.client) {
    sessionStorage.removeItem('selected_folder_id');
  }
}

// Folder tree handlers
function handleToggleFolder(folderId: number) {
  foldersStore.toggleFolder(folderId);
}

function handleCreateSubfolder(parentId: number) {
  newFolderParentId.value = parentId;
  openCreateFolderModal();
}

function handleRenameFolder(folderId: number) {
  const folder = foldersStore.getFolderById(folderId);
  if (folder) {
    folderToManage.value = folderId;
    renameFolderName.value = folder.name;
    showRenameFolderModal.value = true;
  }
}

function handleDeleteFolder(folderId: number) {
  folderToManage.value = folderId;
  showDeleteFolderModal.value = true;
}

// Folder CRUD operations
function openCreateFolderModal() {
  newFolderName.value = '';
  showCreateFolderModal.value = true;
  isMobileSidebarOpen.value = false;
}

async function createFolder() {
  const name = newFolderName.value.trim();
  if (!name) {
    toast.add({
      title: 'Validation Error',
      description: 'Folder name cannot be empty',
      color: 'error'
    });
    return;
  }

  isFolderActionLoading.value = true;

  try {
    const folder = await foldersStore.createFolder({
      name,
      parent_id: newFolderParentId.value
    });

    toast.add({
      title: 'Success',
      description: `Folder "${name}" created`,
      color: 'success'
    });

    showCreateFolderModal.value = false;
    newFolderParentId.value = null;
    selectedFolderId.value = folder.id;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

async function renameFolder() {
  const folderId = folderToManage.value;
  const newName = renameFolderName.value.trim();
  
  if (!folderId || !newName) return;

  const folder = foldersStore.getFolderById(folderId);
  if (newName === folder?.name) {
    showRenameFolderModal.value = false;
    return;
  }

  isFolderActionLoading.value = true;

  try {
    await foldersStore.updateFolder(folderId, { name: newName });

    toast.add({
      title: 'Success',
      description: `Folder renamed to "${newName}"`,
      color: 'success'
    });

    showRenameFolderModal.value = false;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to rename folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

async function deleteFolder() {
  const folderId = folderToManage.value;
  if (!folderId) return;

  isFolderActionLoading.value = true;

  try {
    await foldersStore.deleteFolder(folderId);

    const folder = foldersStore.getFolderById(folderId);
    toast.add({
      title: 'Success',
      description: `Folder "${folder?.name}" deleted`,
      color: 'success'
    });

    if (selectedFolderId.value === folderId) {
      selectedFolderId.value = null;
    }

    showDeleteFolderModal.value = false;
    
    // Refresh notes to update the list
    await notesStore.fetchNotes();
  } catch (error) {
    console.error('Delete folder error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to delete folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

// Note CRUD operations
async function handleCreateNote() {
  if (isCreating.value) return;
  
  showFabMenu.value = false;
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'Untitled Note',
      content: '',
      folder_id: selectedFolderId.value
    };
    
    const note = await notesStore.createNote(noteData);
    router.push(`/notes/${note.id}`);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleQuickNote() {
  if (isCreating.value) return;
  
  showFabMenu.value = false;
  isCreating.value = true;
  
  try {
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const noteData: CreateNoteDto = {
      title: `Quick Note - ${timestamp}`,
      content: '',
      folder_id: selectedFolderId.value
    };
    
    const note = await notesStore.createNote(noteData);
    router.push(`/notes/${note.id}`);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create quick note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function handleListNote() {
  if (isCreating.value) return;
  
  showFabMenu.value = false;
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'New List',
      content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      folder_id: selectedFolderId.value
    };
    
    const note = await notesStore.createNote(noteData);
    router.push(`/notes/${note.id}`);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create list note',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

function handleCreateFolderFromFab() {
  showFabMenu.value = false;
  newFolderParentId.value = selectedFolderId.value;
  openCreateFolderModal();
}

function handleAiGenerate() {
  showFabMenu.value = false;
  openAiGenerateModal();
}

function openAiGenerateModal() {
  aiPrompt.value = '';
  showAiGenerateModal.value = true;
}

function handleTemplateNote() {
  showFabMenu.value = false;
  showTemplateModal.value = true;
}

async function createNoteFromTemplate(template: NoteTemplate) {
  if (isCreating.value) return;
  
  showTemplateModal.value = false;
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: template.title,
      content: template.content,
      folder_id: selectedFolderId.value
    };
    
    const note = await notesStore.createNote(noteData);
    
    toast.add({
      title: 'Success',
      description: `Created note from ${template.title} template`,
      color: 'success'
    });
    
    router.push(`/notes/${note.id}`);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to create note from template',
      color: 'error'
    });
  } finally {
    isCreating.value = false;
  }
}

async function generateAiNote() {
  const prompt = aiPrompt.value.trim();
  if (!prompt) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter a prompt for the AI',
      color: 'error'
    });
    return;
  }

  isGeneratingAi.value = true;

  try {
    const response = await $fetch<Note>('/api/notes/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        prompt: prompt,
        folder_id: selectedFolderId.value
      }
    });

    toast.add({
      title: 'Success',
      description: 'AI-generated note created successfully',
      color: 'success'
    });

    showAiGenerateModal.value = false;
    router.push(`/notes/${response.id}`);
  } catch (error) {
    console.error('AI generation error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to generate note with AI. Please try again.',
      color: 'error'
    });
  } finally {
    isGeneratingAi.value = false;
  }
}

function handleDeleteNote(note: Note) {
  noteToDelete.value = note;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!noteToDelete.value) return;

  isDeleting.value = true;

  try {
    await notesStore.deleteNote(noteToDelete.value.id);
    toast.add({
      title: 'Success',
      description: 'Note deleted successfully',
      color: 'success'
    });
    showDeleteModal.value = false;
    noteToDelete.value = null;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to delete note',
      color: 'error'
    });
  } finally {
    isDeleting.value = false;
  }
}

function cancelDelete() {
  showDeleteModal.value = false;
  noteToDelete.value = null;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getPreview(content: string | null): string {
  if (!content) return 'No content';
  
  // Strip HTML tags to get plain text
  const text = content.replace(/<[^>]*>/g, '').trim();
  
  // Limit length
  return text.substring(0, 150) + (text.length > 150 ? '...' : '');
}

function getRenderedPreview(content: string | null): string {
  if (!content) return '<p class="text-gray-400 dark:text-gray-500">No content</p>';
  
  // Limit to first 200 characters of HTML
  const truncated = content.substring(0, 200) + (content.length > 200 ? '...' : '');
  
  return truncated;
}

function toggleFabMenu() {
  showFabMenu.value = !showFabMenu.value;
}
</script>

<template>
  <div>
    <!-- Loading screen while auth is initializing -->
    <div v-if="!authStore.currentUser || !authStore.initialized" class="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>

    <!-- Main dashboard with Notion-like layout -->
    <div v-else :key="`dashboard-${authStore.currentUser?.id}-${sessionKey}`" class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <!-- Left Sidebar (Desktop Only) -->
      <aside class="hidden md:flex md:flex-col w-64 lg:w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <!-- Sidebar Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
            </div>
            <h1 class="text-lg font-bold text-gray-900 dark:text-white">Notes</h1>
          </div>
        </div>

        <!-- Sidebar Content -->
        <div class="flex-1 overflow-y-auto p-3">
          <!-- All Notes -->
          <button
            @click="selectAllNotes"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-2"
            :class="selectedFolderId === null
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
          >
            <UIcon name="i-heroicons-document-text" class="w-5 h-5" />
            <span class="flex-1 text-left">All Notes</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
              {{ notesStore.notes.length }}
            </span>
          </button>

          <!-- Folders Section -->
          <div class="mt-4">
            <div class="flex items-center justify-between px-3 mb-2">
              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Folders
              </h3>
              <button
                @click="openCreateFolderModal"
                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="New Folder"
              >
                <UIcon name="i-heroicons-plus" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div v-if="foldersStore.folderTree.length === 0" class="px-3 py-6 text-center">
              <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No folders yet</p>
              <button
                @click="openCreateFolderModal"
                class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Create your first folder
              </button>
            </div>

            <!-- Folder Tree -->
            <div v-else class="space-y-0.5">
              <FolderTreeItem
                v-for="folder in foldersStore.folderTree"
                :key="folder.id"
                :folder="folder"
                :selected-id="selectedFolderId"
                :is-expanded="foldersStore.expandedFolderIds.has(folder.id)"
                @select="selectFolder"
                @toggle="handleToggleFolder"
                @create-subfolder="handleCreateSubfolder"
                @rename="handleRenameFolder"
                @delete="handleDeleteFolder"
              />
            </div>
          </div>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-3 border-t border-gray-200 dark:border-gray-700">
          <div class="relative">
            <button 
              type="button"
              data-user-menu-button
              @click="showUserMenu = !showUserMenu"
              class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {{ userInitial }}
              </div>
              <div class="flex-1 text-left min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ authStore.currentUser?.name || 'User' }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ authStore.currentUser?.email }}
                </p>
              </div>
              <UIcon name="i-heroicons-ellipsis-horizontal" class="w-5 h-5 text-gray-400" />
            </button>

            <!-- User Menu Dropdown -->
            <Transition name="fade">
              <div
                v-if="showUserMenu"
                data-user-menu-dropdown
                class="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2"
              >
                <button
                  type="button"
                  @click="authStore.logout()"
                  class="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                >
                  <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </aside>

      <!-- Mobile Sidebar Drawer -->
      <Teleport to="body">
        <Transition name="drawer">
          <div
            v-if="isMobileSidebarOpen"
            class="fixed inset-0 z-50 md:hidden"
          >
            <!-- Backdrop -->
            <div
              class="absolute inset-0 bg-black/50 backdrop-blur-sm"
              @click="isMobileSidebarOpen = false"
            />
            
            <!-- Drawer -->
            <div class="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl flex flex-col">
              <!-- Drawer Header -->
              <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
                    <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
                  </div>
                  <h1 class="text-lg font-bold text-gray-900 dark:text-white">Notes</h1>
                </div>
                <button
                  @click="isMobileSidebarOpen = false"
                  class="p-2 -mr-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                </button>
              </div>

              <!-- Drawer Content (Same as Desktop Sidebar) -->
              <div class="flex-1 overflow-y-auto p-3">
                <!-- All Notes -->
                <button
                  @click="selectAllNotes"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-2"
                  :class="selectedFolderId === null
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                >
                  <UIcon name="i-heroicons-document-text" class="w-5 h-5" />
                  <span class="flex-1 text-left">All Notes</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                    {{ notesStore.notes.length }}
                  </span>
                </button>

                <!-- Folders Section -->
                <div class="mt-4">
                  <div class="flex items-center justify-between px-3 mb-2">
                    <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Folders
                    </h3>
                    <button
                      @click="openCreateFolderModal"
                      class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title="New Folder"
                    >
                      <UIcon name="i-heroicons-plus" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  <div v-if="foldersStore.folderTree.length === 0" class="px-3 py-6 text-center">
                    <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No folders yet</p>
                    <button
                      @click="openCreateFolderModal"
                      class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Create your first folder
                    </button>
                  </div>

                  <!-- Folder Tree -->
                  <div v-else class="space-y-0.5">
                    <FolderTreeItem
                      v-for="folder in foldersStore.folderTree"
                      :key="folder.id"
                      :folder="folder"
                      :selected-id="selectedFolderId"
                      :is-expanded="foldersStore.expandedFolderIds.has(folder.id)"
                      @select="selectFolder"
                      @toggle="handleToggleFolder"
                      @create-subfolder="handleCreateSubfolder"
                      @rename="handleRenameFolder"
                      @delete="handleDeleteFolder"
                    />
                  </div>
                </div>
              </div>

              <!-- Drawer Footer -->
              <div class="p-3 border-t border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3 p-2 mb-2">
                  <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {{ userInitial }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ authStore.currentUser?.name || 'User' }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ authStore.currentUser?.email }}
                    </p>
                  </div>
                </div>
                <UButton
                  icon="i-heroicons-arrow-right-on-rectangle"
                  color="error"
                  variant="soft"
                  block
                  @click="authStore.logout()"
                >
                  Logout
                </UButton>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Top Bar (Simplified) -->
        <header class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex items-center justify-between h-14 px-4">
            <!-- Mobile Menu Button -->
            <button
              @click="isMobileSidebarOpen = true"
              class="md:hidden p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Open menu"
            >
              <UIcon name="i-heroicons-bars-3" class="w-6 h-6" />
            </button>

            <!-- Current Folder/Context (Mobile Only) -->
            <div class="md:hidden flex items-center gap-2 min-w-0 flex-1">
              <UIcon 
                :name="selectedFolderId === null ? 'i-heroicons-document-text' : 'i-heroicons-folder'" 
                class="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {{ selectedFolderId === null ? 'All Notes' : foldersStore.getFolderById(selectedFolderId)?.name || 'Unknown' }}
              </span>
            </div>

            <!-- Desktop: Breadcrumb + Note count -->
            <div class="hidden md:flex items-center gap-3 min-w-0 flex-1">
              <!-- Breadcrumb Trail -->
              <div v-if="folderBreadcrumb.length > 0" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-w-0">
                <UIcon name="i-heroicons-folder" class="w-4 h-4 flex-shrink-0" />
                <div class="flex items-center gap-1.5 min-w-0">
                  <button
                    v-for="(crumb, index) in folderBreadcrumb"
                    :key="crumb.id"
                    @click="selectFolder(crumb.id)"
                    class="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    <span class="truncate max-w-[150px]" :class="index === folderBreadcrumb.length - 1 ? 'font-medium text-gray-900 dark:text-white' : ''">
                      {{ crumb.name }}
                    </span>
                    <UIcon 
                      v-if="index < folderBreadcrumb.length - 1" 
                      name="i-heroicons-chevron-right" 
                      class="w-3 h-3 flex-shrink-0"
                    />
                  </button>
                </div>
              </div>
              <div v-else class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                <span class="font-medium text-gray-900 dark:text-white">All Notes</span>
              </div>
              
              <!-- Separator -->
              <div class="h-4 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
              
              <!-- Note Count -->
              <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {{ displayedNotes.length }} {{ displayedNotes.length === 1 ? 'note' : 'notes' }}
              </div>
            </div>

            <!-- Right: Actions -->
            <div class="flex items-center gap-2">
              <!-- Sync Status -->
              <div class="relative">
                <button
                  @click="() => { if (isOnline && !notesStore.syncing && notesStore.pendingChanges > 0) notesStore.syncWithServer() }"
                  :disabled="!isOnline || notesStore.syncing"
                  :title="!isOnline ? 'Offline - Changes saved locally' : notesStore.syncing ? 'Syncing...' : notesStore.pendingChanges > 0 ? 'Click to sync pending changes' : 'All synced'"
                  class="p-2 rounded-lg transition-colors relative"
                  :class="{
                    'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20': !isOnline,
                    'text-blue-600 dark:text-blue-400 cursor-wait': isOnline && notesStore.syncing,
                    'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer': isOnline && !notesStore.syncing && notesStore.pendingChanges > 0,
                    'text-green-600 dark:text-green-400': isOnline && !notesStore.syncing && notesStore.pendingChanges === 0
                  }"
                >
                  <UIcon 
                    v-if="!isOnline"
                    name="i-heroicons-wifi"
                    class="w-5 h-5"
                  />
                  <UIcon 
                    v-else-if="notesStore.syncing"
                    name="i-heroicons-arrow-path"
                    class="w-5 h-5 animate-spin"
                  />
                  <UIcon 
                    v-else-if="notesStore.pendingChanges > 0"
                    name="i-heroicons-cloud-arrow-up"
                    class="w-5 h-5"
                  />
                  <UIcon 
                    v-else
                    name="i-heroicons-check-circle"
                    class="w-5 h-5"
                  />
                  
                  <!-- Pending changes badge -->
                  <span 
                    v-if="notesStore.pendingChanges > 0 && !notesStore.syncing"
                    class="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  >
                    {{ notesStore.pendingChanges > 9 ? '9+' : notesStore.pendingChanges }}
                  </span>
                </button>
              </div>

              <!-- View Mode Toggle (Desktop Only) -->
              <div v-if="displayedNotes.length > 0 || loading" class="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                <button
                  @click="setViewMode('grid')"
                  :class="[
                    'p-2 rounded-md transition-all',
                    viewMode === 'grid' 
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  ]"
                  title="Grid view"
                >
                  <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5" />
                </button>
                <button
                  @click="setViewMode('list')"
                  :class="[
                    'p-2 rounded-md transition-all',
                    viewMode === 'list' 
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  ]"
                  title="List view"
                >
                  <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
                </button>
              </div>

              <!-- Search -->
              <div class="flex items-center gap-2">
                <transition name="search-expand">
                  <input
                    v-if="isSearchExpanded"
                    ref="searchInputRef"
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search notes..."
                    class="w-32 sm:w-48 md:w-64 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    @blur="() => { if (!searchQuery) isSearchExpanded = false }"
                  />
                </transition>
                <button
                  @click="() => { 
                    if (isSearchExpanded) {
                      searchQuery = '';
                      isSearchExpanded = false;
                    } else {
                      isSearchExpanded = true;
                    }
                  }"
                  class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600': isSearchExpanded }"
                >
                  <UIcon :name="isSearchExpanded ? 'i-heroicons-x-mark' : 'i-heroicons-magnifying-glass'" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Notes Content Area -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loading" class="text-center py-12">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>

          <div v-else-if="displayedNotes.length === 0" class="text-center py-12">
            <UIcon name="i-heroicons-document-text" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No notes found</h3>
            <p class="text-gray-500 dark:text-gray-400 mb-4">Create your first note to get started</p>
            <UButton 
              @click="handleCreateNote" 
              icon="i-heroicons-plus"
              :loading="isCreating"
              :disabled="isCreating"
            >
              Create Note
            </UButton>
          </div>

          <!-- Notes Display -->
          <div v-else>
            <!-- Grid View (Desktop Only, when grid mode) -->
            <div v-if="viewMode === 'grid'" class="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="note in displayedNotes"
                :key="note.id"
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer group"
                @click="router.push(`/notes/${note.id}`)"
              >
                <div class="p-5">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1 min-w-0">
                      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {{ note.title }}
                      </h3>
                      <div 
                        class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 prose prose-sm dark:prose-invert max-w-none"
                        v-html="getRenderedPreview(note.content)"
                      />
                    </div>
                    <div class="flex items-center gap-1 ml-4">
                      <UButton
                        icon="i-heroicons-trash"
                        color="error"
                        variant="ghost"
                        size="xs"
                        @click.stop="handleDeleteNote(note)"
                      />
                    </div>
                  </div>

                  <div class="flex items-center gap-3 mt-3">
                    <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                      {{ formatDate(note.updated_at) }}
                    </span>

                    <div v-if="note.tags && note.tags.length > 0" class="flex gap-1">
                      <UBadge
                        v-for="tag in note.tags.slice(0, 3)"
                        :key="tag"
                        color="primary"
                        variant="soft"
                        size="xs"
                      >
                        {{ tag }}
                      </UBadge>
                      <span v-if="note.tags.length > 3" class="text-xs text-gray-400">
                        +{{ note.tags.length - 3 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- List View (Always on mobile, or desktop when list mode selected) -->
            <div :class="viewMode === 'grid' ? 'md:hidden space-y-2' : 'space-y-2'">
              <div
                v-for="note in displayedNotes"
                :key="note.id"
                class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer group"
                @click="router.push(`/notes/${note.id}`)"
              >
                <div class="p-4">
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0 flex items-center gap-4">
                      <div class="flex-1 min-w-0">
                        <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-1">
                          {{ note.title }}
                        </h3>
                        <div 
                          class="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 prose prose-sm dark:prose-invert max-w-none"
                          v-html="getRenderedPreview(note.content)"
                        />
                      </div>

                      <div class="hidden md:flex items-center gap-3">
                        <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 whitespace-nowrap">
                          <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                          {{ formatDate(note.updated_at) }}
                        </span>

                        <div v-if="note.tags && note.tags.length > 0" class="flex gap-1">
                          <UBadge
                            v-for="tag in note.tags.slice(0, 2)"
                            :key="tag"
                            color="primary"
                            variant="soft"
                            size="xs"
                          >
                            {{ tag }}
                          </UBadge>
                          <span v-if="note.tags.length > 2" class="text-xs text-gray-400">
                            +{{ note.tags.length - 2 }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1 ml-4">
                      <UButton
                        icon="i-heroicons-trash"
                        color="error"
                        variant="ghost"
                        size="xs"
                        @click.stop="handleDeleteNote(note)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Floating Action Button with Menu -->
        <div class="fixed bottom-8 right-8 z-50">
          <!-- FAB Menu -->
          <Transition name="fab-menu">
            <div
              v-if="showFabMenu"
              data-fab-menu
              class="absolute bottom-20 right-0 w-56 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div class="py-2">
                <!-- New Note -->
                <button
                  @click="handleCreateNote"
                  :disabled="isCreating"
                  class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-sm">
                    <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">New Note</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Create a blank note</div>
                  </div>
                </button>

                <!-- Quick Note -->
                <button
                  @click="handleQuickNote"
                  :disabled="isCreating"
                  class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                    <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">Quick Note</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">With timestamp</div>
                  </div>
                </button>

                <!-- List Note -->
                <button
                  @click="handleListNote"
                  :disabled="isCreating"
                  class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                    <UIcon name="i-heroicons-list-bullet" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">New List</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">With checkbox ready</div>
                  </div>
                </button>

                <!-- From Template -->
                <button
                  @click="handleTemplateNote"
                  class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-3 transition-colors"
                >
                  <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                    <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">From Template</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Use a pre-made template</div>
                  </div>
                </button>

                <!-- AI Generate Note -->
                <button
                  @click="handleAiGenerate"
                  class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-3 transition-colors"
                >
                  <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                    <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">AI Generate</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Create with AI</div>
                  </div>
                </button>

                <!-- Divider -->
                <div class="my-2 border-t border-gray-200 dark:border-gray-700"></div>

                <!-- New Folder -->
                <button
                  @click="handleCreateFolderFromFab"
                  class="w-full text-left px-4 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 transition-colors"
                >
                  <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                    <UIcon name="i-heroicons-folder-plus" class="w-5 h-5 text-white" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 dark:text-white">New Folder</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Organize your notes</div>
                  </div>
                </button>
              </div>
            </div>
          </Transition>

          <!-- FAB Button -->
          <button
            data-fab-button
            @click="toggleFabMenu"
            :disabled="isCreating"
            class="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{ 'rotate-45': showFabMenu, 'scale-95': isCreating }"
          >
            <UIcon 
              :name="isCreating ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'" 
              class="w-8 h-8 transition-transform"
              :class="{ 'animate-spin': isCreating }"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="cancelDelete" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Delete Note?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Are you sure you want to delete <span class="font-semibold text-gray-900 dark:text-white">"{{ noteToDelete?.title }}"</span>? This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="cancelDelete" :disabled="isDeleting">Cancel</UButton>
              <UButton color="error" block @click="confirmDelete" :loading="isDeleting" :disabled="isDeleting">Delete</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Create Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateFolderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showCreateFolderModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <UIcon name="i-heroicons-folder-plus" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Create New Folder</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Organize your notes by creating folders</p>
            <input v-model="newFolderName" type="text" placeholder="Folder name" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6" @keyup.enter="createFolder" autofocus />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showCreateFolderModal = false" :disabled="isFolderActionLoading">Cancel</UButton>
              <UButton color="primary" block @click="createFolder" :loading="isFolderActionLoading" :disabled="isFolderActionLoading || !newFolderName.trim()">Create</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Rename Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRenameFolderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showRenameFolderModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <UIcon name="i-heroicons-pencil" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Rename Folder</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Renaming <span class="font-semibold text-gray-900 dark:text-white">"{{ folderToManage !== null ? foldersStore.getFolderById(folderToManage)?.name : '' }}"</span></p>
            <input v-model="renameFolderName" type="text" placeholder="New folder name" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6" @keyup.enter="renameFolder" autofocus />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showRenameFolderModal = false" :disabled="isFolderActionLoading">Cancel</UButton>
              <UButton color="primary" block @click="renameFolder" :loading="isFolderActionLoading" :disabled="isFolderActionLoading || !renameFolderName.trim()">Rename</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteFolderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showDeleteFolderModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Delete Folder?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Are you sure you want to delete <span class="font-semibold text-gray-900 dark:text-white">"{{ folderToManage !== null ? foldersStore.getFolderById(folderToManage)?.name : '' }}"</span>? Notes in this folder will be moved to "All Notes". This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showDeleteFolderModal = false" :disabled="isFolderActionLoading">Cancel</UButton>
              <UButton color="error" block @click="deleteFolder" :loading="isFolderActionLoading" :disabled="isFolderActionLoading">Delete</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- AI Generate Note Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAiGenerateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showAiGenerateModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-full">
              <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">Generate Note with AI</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">Describe what you want the AI to write about, and it will generate a well-formatted note for you.</p>
            <textarea v-model="aiPrompt" placeholder="E.g., 'Write a summary of the benefits of meditation' or 'Create a study guide for JavaScript promises'" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-6 resize-none" rows="5" @keydown.meta.enter="generateAiNote" @keydown.ctrl.enter="generateAiNote" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center">
              Powered by Google Gemini 2.5 Flash • Press <kbd class="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">⌘</kbd> <kbd class="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to generate
            </p>
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="showAiGenerateModal = false" :disabled="isGeneratingAi">Cancel</UButton>
              <UButton color="primary" block @click="generateAiNote" :loading="isGeneratingAi" :disabled="isGeneratingAi || !aiPrompt.trim()" icon="i-heroicons-sparkles">Generate</UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Template Selection Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showTemplateModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] border border-gray-200 dark:border-gray-700 flex flex-col">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Choose a Template</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Select a pre-made template to get started quickly</p>
              </div>
              <button @click="showTemplateModal = false" class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  v-for="template in noteTemplates"
                  :key="template.id"
                  @click="createNoteFromTemplate(template)"
                  :disabled="isCreating"
                  class="group relative bg-gradient-to-br p-[2px] rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="template.color"
                >
                  <div class="bg-white dark:bg-gray-800 rounded-xl p-5 h-full flex flex-col">
                    <div class="flex items-start gap-4 mb-3">
                      <div class="w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-110 transition-transform" :class="template.color">
                        <UIcon :name="template.icon" class="w-6 h-6 text-white" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ template.title }}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ template.description }}</p>
                      </div>
                    </div>
                    <div class="mt-auto pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Click to create</span>
                        <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div class="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <UIcon name="i-heroicons-information-circle" class="w-5 h-5" />
                  <span>{{ noteTemplates.length }} templates available</span>
                </div>
                <UButton color="neutral" variant="soft" @click="showTemplateModal = false">Cancel</UButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: all 0.3s ease;
}

.modal-enter-from > div:first-child,
.modal-leave-to > div:first-child {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

/* Search expand animation */
.search-expand-enter-active,
.search-expand-leave-active {
  transition: all 0.3s ease;
}

.search-expand-enter-from {
  opacity: 0;
  transform: translateX(20px);
  width: 0;
}

.search-expand-leave-to {
  opacity: 0;
  transform: translateX(20px);
  width: 0;
}

/* Drawer animation */
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s ease;
}

.drawer-enter-active .absolute.left-0,
.drawer-leave-active .absolute.left-0 {
  transition: transform 0.3s ease;
}

.drawer-enter-from .absolute.left-0,
.drawer-leave-to .absolute.left-0 {
  transform: translateX(-100%);
}

.drawer-enter-from .absolute.inset-0.bg-black\/50,
.drawer-leave-to .absolute.inset-0.bg-black\/50 {
  opacity: 0;
}

/* Fade animation */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

/* FAB menu animation */
.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

.fab-menu-enter-to,
.fab-menu-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}
</style>

