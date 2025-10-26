<script setup lang="ts">
import type { Note, CreateNoteDto } from '~/models';
import { marked } from 'marked';

const authStore = useAuthStore();
const notesStore = useNotesStore();
const toast = useToast();
const router = useRouter();

const searchQuery = ref('');
const selectedFolder = ref<string | null>(null);
const loading = ref(false);
const isCreating = ref(false);

// Session key to force re-render on new sessions
const sessionKey = ref('');
if (process.client) {
  sessionKey.value = localStorage.getItem('session_version') || 'default';
}

// Mobile menu and search states
const isMobileMenuOpen = ref(false);
const isSearchExpanded = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// FAB menu state
const showFabMenu = ref(false);

// Folder menu state
const activeFolderMenu = ref<string | null>(null);
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
const renameFolderName = ref('');
const folderToManage = ref<string | null>(null);
const isFolderActionLoading = ref(false);

// AI generation modal
const showAiGenerateModal = ref(false);
const aiPrompt = ref('');
const isGeneratingAi = ref(false);

// Folder colors for visual distinction
const folderColors = [
  'text-blue-600 dark:text-blue-400',
  'text-purple-600 dark:text-purple-400',
  'text-green-600 dark:text-green-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
  'text-indigo-600 dark:text-indigo-400',
  'text-teal-600 dark:text-teal-400',
  'text-rose-600 dark:text-rose-400'
];

// Watch search expansion to focus input
watch(isSearchExpanded, (expanded) => {
  if (expanded && searchInputRef.value) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
});

// Close menus when clicking anywhere - but not on the buttons themselves!
if (process.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // Don't close if clicking the three dots button or inside the menu
    const isMenuButton = target.closest('[data-folder-menu-button]');
    const isMenuDropdown = target.closest('[data-folder-menu-dropdown]');
    const isUserButton = target.closest('[data-user-menu-button]');
    const isUserDropdown = target.closest('[data-user-menu-dropdown]');
    const isFabButton = target.closest('[data-fab-button]');
    const isFabMenu = target.closest('[data-fab-menu]');
    
    if (!isMenuButton && !isMenuDropdown) {
      activeFolderMenu.value = null;
    }
    
    if (!isUserButton && !isUserDropdown) {
      showUserMenu.value = false;
    }
    
    if (!isFabButton && !isFabMenu) {
      showFabMenu.value = false;
    }
  });
}

// Fetch notes on mount
onMounted(async () => {
  console.log('📱 Dashboard mounted');
  console.log('👤 Current user:', authStore.currentUser?.name || authStore.currentUser?.email);
  console.log('🔑 Session key:', sessionKey.value);
  console.log('📦 LocalStorage keys:', Object.keys(localStorage));
  
  loading.value = true;
  try {
    await notesStore.fetchNotes();
    console.log('📝 Notes loaded:', notesStore.notes.length);
  } catch (error) {
    console.error('❌ Failed to load notes:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to load notes',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }

});

// Log when component unmounts
onUnmounted(() => {
  console.log('🗑️ Dashboard unmounted');
});

// Apply filters
watch([searchQuery, selectedFolder], () => {
  notesStore.setFilters({
    search: searchQuery.value || undefined,
    folder: selectedFolder.value || undefined
  });
});

const displayedNotes = computed(() => notesStore.filteredNotes);
const folders = computed(() => notesStore.folders);

const userInitial = computed(() => {
  const name = (authStore.currentUser?.name || authStore.currentUser?.email || 'User') as string;
  return name.charAt(0).toUpperCase();
});

// Get folder color based on folder name hash
function getFolderColor(folderName: string | null | undefined): string {
  if (!folderName) return folderColors[0] || 'text-blue-600 dark:text-blue-400';
  const hash = folderName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return folderColors[hash % folderColors.length] || 'text-blue-600 dark:text-blue-400';
}

// Get note count for a folder
function getFolderNoteCount(folderName: string): number {
  return notesStore.notes.filter(note => note.folder === folderName).length;
}

// Get menu position based on button location
function getFolderMenuPosition(folderName: string): string {
  if (process.client) {
    const button = document.getElementById(`folder-menu-btn-${folderName}`);
    if (button) {
      const rect = button.getBoundingClientRect();
      return `top: ${rect.bottom + 8}px; left: ${rect.left}px;`;
    }
  }
  return 'top: 0; left: 0;';
}

// Toggle folder menu - simplified
function toggleFolderMenu(folderName: string, event?: Event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  console.log('🔵 Clicked folder menu for:', folderName);
  console.log('📍 Current activeFolderMenu:', activeFolderMenu.value);
  
  // Toggle: if same folder, close; otherwise open new one
  activeFolderMenu.value = activeFolderMenu.value === folderName ? null : folderName;
  
  console.log('🟢 NEW Menu state:', activeFolderMenu.value);
  console.log('✅ Should show menu:', activeFolderMenu.value === folderName);
  
  // Force next tick to ensure reactivity and check DOM
  nextTick(() => {
    console.log('⏭️ After nextTick, menu state:', activeFolderMenu.value);
    
    if (activeFolderMenu.value) {
      const button = document.getElementById(`folder-menu-btn-${folderName}`);
      const menu = document.querySelector(`[data-folder-menu-dropdown]`);
      console.log('🎯 Button found:', !!button);
      console.log('📋 Menu element found:', !!menu);
      console.log('🔍 Menu position:', getFolderMenuPosition(folderName));
      
      if (menu) {
        console.log('🎨 Menu is visible in DOM!');
        console.log('📏 Menu dimensions:', menu.getBoundingClientRect());
      }
    }
  });
}

function toggleFabMenu() {
  showFabMenu.value = !showFabMenu.value;
}

async function handleCreateNote() {
  if (isCreating.value) return;
  
  showFabMenu.value = false;
  isCreating.value = true;
  
  try {
    const noteData: CreateNoteDto = {
      title: 'Untitled Note',
      content: '',
      folder: selectedFolder.value || null
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
      folder: selectedFolder.value || null
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

function handleCreateFolderFromFab() {
  showFabMenu.value = false;
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
        folder: selectedFolder.value || null
      }
    });

    toast.add({
      title: 'Success',
      description: 'AI-generated note created successfully',
      color: 'success'
    });

    showAiGenerateModal.value = false;
    
    // Refresh notes and navigate to the new note
    await notesStore.fetchNotes();
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

// Folder management functions
function openCreateFolderModal() {
  newFolderName.value = '';
  showCreateFolderModal.value = true;
  isMobileMenuOpen.value = false;
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

  if (folders.value.includes(name)) {
    toast.add({
      title: 'Validation Error',
      description: 'Folder already exists',
      color: 'error'
    });
    return;
  }

  isFolderActionLoading.value = true;

  try {
    // Create a note in the new folder (folders are implicit)
    await notesStore.createNote({
      title: `Welcome to ${name}`,
      content: `This is your new folder: **${name}**\n\nStart organizing your notes here!`,
      folder: name
    });

    toast.add({
      title: 'Success',
      description: `Folder "${name}" created`,
      color: 'success'
    });

    showCreateFolderModal.value = false;
    selectedFolder.value = name;
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

function openRenameFolderModal(folderName: string) {
  folderToManage.value = folderName;
  renameFolderName.value = folderName;
  showRenameFolderModal.value = true;
  isMobileMenuOpen.value = false;
}

async function renameFolder() {
  const oldName = folderToManage.value;
  const newName = renameFolderName.value.trim();
  
  if (!oldName || !newName) return;

  if (newName === oldName) {
    showRenameFolderModal.value = false;
    return;
  }

  if (folders.value.includes(newName)) {
    toast.add({
      title: 'Validation Error',
      description: 'Folder already exists',
      color: 'error'
    });
    return;
  }

  isFolderActionLoading.value = true;

  try {
    // Update all notes in this folder
    const notesToUpdate = notesStore.notes.filter(note => note.folder === oldName);
    await Promise.all(
      notesToUpdate.map(note => 
        notesStore.updateNote(note.id, { folder: newName })
      )
    );

    toast.add({
      title: 'Success',
      description: `Folder renamed to "${newName}"`,
      color: 'success'
    });

    if (selectedFolder.value === oldName) {
      selectedFolder.value = newName;
    }

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

function openDeleteFolderModal(folderName: string) {
  folderToManage.value = folderName;
  showDeleteFolderModal.value = true;
  isMobileMenuOpen.value = false;
}

async function deleteFolder() {
  const folderName = folderToManage.value;
  if (!folderName) return;

  isFolderActionLoading.value = true;

  try {
    // Move all notes to "No folder" (set folder to null)
    const notesToUpdate = notesStore.notes.filter(note => note.folder === folderName);
    
    console.log(`🗑️ Deleting folder "${folderName}" with ${notesToUpdate.length} notes`);
    
    // Update each note to remove folder (use null, not undefined)
    await Promise.all(
      notesToUpdate.map(note => {
        console.log(`  📝 Updating note ${note.id}: "${note.title}"`);
        return notesStore.updateNote(note.id, { folder: null });
      })
    );

    console.log('✅ All notes updated successfully');

    toast.add({
      title: 'Success',
      description: `Folder "${folderName}" deleted. ${notesToUpdate.length} note(s) moved to "All Notes"`,
      color: 'success'
    });

    if (selectedFolder.value === folderName) {
      selectedFolder.value = null;
    }

    showDeleteFolderModal.value = false;
  } catch (error) {
    console.error('❌ Delete folder error:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to delete folder',
      color: 'error'
    });
  } finally {
    isFolderActionLoading.value = false;
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true
});

function getPreview(content: string | null): string {
  if (!content) return 'No content';
  
  // Render markdown to HTML
  const html = marked(content) as string;
  
  // Strip HTML tags to get plain text
  const text = html.replace(/<[^>]*>/g, '').trim();
  
  // Limit length
  return text.substring(0, 150) + (text.length > 150 ? '...' : '');
}

function getRenderedPreview(content: string | null): string {
  if (!content) return '<p class="text-gray-400 dark:text-gray-500">No content</p>';
  
  // Render markdown to HTML
  const html = marked(content) as string;
  
  // Limit to first 200 characters of HTML
  const truncated = html.substring(0, 200) + (html.length > 200 ? '...' : '');
  
  return truncated;
}
</script>

<template>
  <!-- Loading screen while auth is initializing (prevents layout flash) -->
  <div v-if="!authStore.currentUser" class="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <div class="w-16 h-16 mx-auto mb-4 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>

  <!-- Main dashboard (only render when user is loaded) -->
  <div v-else :key="`dashboard-${authStore.currentUser?.id}-${sessionKey}`" class="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
    <!-- Top Navigation Bar -->
    <header class="sticky top-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="flex items-center justify-between h-16 px-4 md:px-6">
        <!-- Left: Logo & Note Count -->
        <div class="flex items-center gap-4">
          <!-- Mobile Menu Toggle -->
          <button
            @click="isMobileMenuOpen = true"
            class="md:hidden p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Open menu"
          >
            <UIcon name="i-heroicons-bars-3" class="w-6 h-6" />
          </button>

          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 class="text-lg font-bold text-gray-900 dark:text-white">Notes</h1>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {{ displayedNotes.length }} {{ displayedNotes.length === 1 ? 'note' : 'notes' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Center: Folder Pills (Desktop Only) -->
        <div class="hidden md:flex items-center gap-3 flex-1 max-w-3xl mx-6">
          <!-- Scrollable Folder Container -->
          <div class="relative flex-1 group">
            <!-- Scroll Indicator Left -->
            <div class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 dark:from-gray-900 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start z-10">
              <UIcon name="i-heroicons-chevron-left" class="w-4 h-4 text-gray-400" />
            </div>
            
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              <!-- All Notes Pill -->
              <button
                @click="selectedFolder = null"
                class="flex items-center gap-2 pl-4 pr-1 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
                :class="!selectedFolder 
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
              >
                <UIcon name="i-heroicons-document-text" class="w-4 h-4 flex-shrink-0" />
                <span class="truncate">All Notes</span>
                <span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0">
                  {{ notesStore.notes.length }}
                </span>
                <!-- Invisible spacer to match folder button width -->
                <div class="ml-1 p-1.5 w-3.5 h-3.5 flex-shrink-0"></div>
              </button>

              <!-- Folder Pills with Context Menu -->
              <div
                v-for="folder in folders"
                :key="folder"
                class="relative group/folder flex items-center gap-1"
                :data-folder-id="folder"
              >
                <!-- Folder Button -->
                <button
                  @click="selectedFolder = folder"
                  class="flex items-center gap-2 pl-4 pr-3 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
                  :class="selectedFolder === folder 
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
                >
                  <UIcon name="i-heroicons-folder" class="w-4 h-4 flex-shrink-0" :class="getFolderColor(folder)" />
                  <span class="truncate">{{ folder }}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {{ getFolderNoteCount(folder) }}
                  </span>
                </button>
                
                <!-- Three Vertical Dots - Shows on hover (separate button) -->
                <button
                  type="button"
                  :id="`folder-menu-btn-${folder}`"
                  data-folder-menu-button
                  @click="(e) => toggleFolderMenu(folder, e)"
                  class="p-1.5 rounded-md opacity-0 group-hover/folder:opacity-100 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 transition-opacity flex-shrink-0 -ml-2"
                  :class="activeFolderMenu === folder ? 'opacity-100 bg-gray-200 dark:bg-gray-600' : ''"
                >
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <circle cx="8" cy="2" r="1.5"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="8" cy="14" r="1.5"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Scroll Indicator Right -->
            <div class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 dark:from-gray-900 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end z-10">
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        <!-- Right: Search & User Menu -->
        <div class="flex items-center gap-2">
          <!-- Expandable Search -->
          <div class="flex items-center gap-2">
            <transition name="search-expand">
              <input
                v-if="isSearchExpanded"
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Search notes..."
                class="w-48 md:w-64 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                @blur="() => { if (!searchQuery) isSearchExpanded = false }"
              />
            </transition>
            <button
              @click="isSearchExpanded = !isSearchExpanded"
              class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600': isSearchExpanded }"
              aria-label="Toggle search"
            >
              <UIcon :name="isSearchExpanded ? 'i-heroicons-x-mark' : 'i-heroicons-magnifying-glass'" class="w-5 h-5" />
            </button>
          </div>

          <!-- User Menu -->
          <div class="relative">
            <button 
              type="button"
              data-user-menu-button
              @click="showUserMenu = !showUserMenu"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {{ userInitial }}
              </div>
            </button>

            <!-- User Menu Dropdown -->
            <div
              v-if="showUserMenu"
              data-user-menu-dropdown
              class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[100]"
            >
              <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ authStore.currentUser?.name || authStore.currentUser?.email }}
                </p>
              </div>
              <button
                type="button"
                @click="authStore.logout()"
                class="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 mt-1"
              >
                <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Folder Dropdown Menus (Teleported to body to avoid overflow clipping) - Desktop Only -->
    <Teleport to="body">
      <div
        v-for="folder in folders"
        v-show="activeFolderMenu === folder"
        :key="`menu-${folder}`"
        data-folder-menu-dropdown
        class="hidden md:block fixed bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-[99999]"
        :style="getFolderMenuPosition(folder)"
      >
        <button
          type="button"
          @click="openRenameFolderModal(folder); activeFolderMenu = null"
          class="w-48 text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
        >
          <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-blue-500" />
          <span>Rename Folder</span>
        </button>
        <button
          type="button"
          @click="openDeleteFolderModal(folder); activeFolderMenu = null"
          class="w-48 text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
        >
          <UIcon name="i-heroicons-trash" class="w-5 h-5" />
          <span>Delete Folder</span>
        </button>
      </div>
    </Teleport>

    <!-- Mobile Drawer Menu -->
    <Teleport to="body">
      <Transition name="drawer">
        <div
          v-if="isMobileMenuOpen"
          class="fixed inset-0 z-50 md:hidden"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="isMobileMenuOpen = false"
          />
          
          <!-- Drawer -->
          <div class="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-xl flex flex-col">
            <!-- Drawer Header -->
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
              <button
                @click="isMobileMenuOpen = false"
                class="p-2 -mr-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
              </button>
            </div>

            <!-- Filters & Folders -->
            <div class="flex-1 overflow-y-auto p-4">
              <div class="space-y-1">
                <!-- All Notes -->
                <button
                  @click="selectedFolder = null; isMobileMenuOpen = false"
                  class="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between"
                  :class="!selectedFolder 
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                >
                  <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-document-text" class="w-5 h-5" />
                  All Notes
                  </div>
                  <span class="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-600">
                    {{ notesStore.notes.length }}
                  </span>
                </button>

                <!-- Folders Section -->
                <div class="pt-4">
                  <div class="flex items-center justify-between px-4 mb-2">
                    <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Folders
                    </div>
                <button
                      @click="openCreateFolderModal"
                      class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UIcon name="i-heroicons-plus" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                  </div>

                  <div v-if="folders.length === 0" class="px-4 py-6 text-center">
                    <UIcon name="i-heroicons-folder-open" class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">No folders yet</p>
                  <button
                      @click="openCreateFolderModal"
                      class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Create your first folder
                    </button>
                  </div>

                  <div v-else class="space-y-1">
                    <div
                    v-for="folder in folders"
                    :key="folder"
                      class="relative group/folder-mobile flex items-center gap-2"
                    >
                      <!-- Folder Button -->
                      <button
                        @click="selectedFolder = folder; isMobileMenuOpen = false; activeFolderMenu = null"
                        class="flex-1 text-left pl-4 pr-3 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3"
                        :class="selectedFolder === folder 
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                      >
                        <UIcon name="i-heroicons-folder" class="w-5 h-5 flex-shrink-0" :class="getFolderColor(folder)" />
                        <span class="truncate flex-1">{{ folder }}</span>
                        <span class="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                          {{ getFolderNoteCount(folder) }}
                        </span>
                      </button>
                      
                      <!-- Three Vertical Dots - Always visible on mobile, highlighted when active -->
                      <button
                        type="button"
                        data-folder-menu-button
                        @click="(e) => toggleFolderMenu(folder, e)"
                        class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                        :class="activeFolderMenu === folder ? 'bg-gray-200 dark:bg-gray-600' : ''"
                      >
                        <svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
                          <circle cx="8" cy="2" r="1.5"/>
                          <circle cx="8" cy="8" r="1.5"/>
                          <circle cx="8" cy="14" r="1.5"/>
                        </svg>
                      </button>
                      
                      <!-- Dropdown Menu (Mobile) - Overlays on top -->
                      <Transition name="slide-down">
                        <div
                          v-if="activeFolderMenu === folder"
                          data-folder-menu-dropdown
                          class="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-2 z-50"
                        >
                          <button
                            type="button"
                            @click="openRenameFolderModal(folder); activeFolderMenu = null; isMobileMenuOpen = false"
                            class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                          >
                            <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-blue-500" />
                            <span>Rename Folder</span>
                          </button>
                          <button
                            type="button"
                            @click="openDeleteFolderModal(folder); activeFolderMenu = null; isMobileMenuOpen = false"
                            class="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                          >
                            <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                            <span>Delete Folder</span>
                          </button>
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Drawer Footer -->
            <div class="p-4 border-t border-gray-200 dark:border-gray-700">
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

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelDelete"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Delete Note?
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Are you sure you want to delete 
              <span class="font-semibold text-gray-900 dark:text-white">"{{ noteToDelete?.title }}"</span>? 
              This action cannot be undone.
            </p>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="cancelDelete"
                :disabled="isDeleting"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                block
                @click="confirmDelete"
                :loading="isDeleting"
                :disabled="isDeleting"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Create Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCreateFolderModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showCreateFolderModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full">
              <UIcon name="i-heroicons-folder-plus" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Create New Folder
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Organize your notes by creating folders
            </p>

            <!-- Input -->
            <input
              v-model="newFolderName"
              type="text"
              placeholder="Folder name"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6"
              @keyup.enter="createFolder"
              autofocus
            />

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showCreateFolderModal = false"
                :disabled="isFolderActionLoading"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                block
                @click="createFolder"
                :loading="isFolderActionLoading"
                :disabled="isFolderActionLoading || !newFolderName.trim()"
              >
                Create
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Rename Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showRenameFolderModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showRenameFolderModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <UIcon name="i-heroicons-pencil" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Rename Folder
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Renaming <span class="font-semibold text-gray-900 dark:text-white">"{{ folderToManage }}"</span>
            </p>

            <!-- Input -->
            <input
              v-model="renameFolderName"
              type="text"
              placeholder="New folder name"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
              @keyup.enter="renameFolder"
              autofocus
            />

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showRenameFolderModal = false"
                :disabled="isFolderActionLoading"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                block
                @click="renameFolder"
                :loading="isFolderActionLoading"
                :disabled="isFolderActionLoading || !renameFolderName.trim()"
              >
                Rename
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Folder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteFolderModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showDeleteFolderModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Delete Folder?
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Are you sure you want to delete 
              <span class="font-semibold text-gray-900 dark:text-white">"{{ folderToManage }}"</span>? 
              Notes in this folder will be moved to "All Notes". This action cannot be undone.
            </p>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showDeleteFolderModal = false"
                :disabled="isFolderActionLoading"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                block
                @click="deleteFolder"
                :loading="isFolderActionLoading"
                :disabled="isFolderActionLoading"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- AI Generate Note Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showAiGenerateModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showAiGenerateModal = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-full">
              <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Generate Note with AI
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Describe what you want the AI to write about, and it will generate a well-formatted note for you.
            </p>

            <!-- Textarea -->
            <textarea
              v-model="aiPrompt"
              placeholder="E.g., 'Write a summary of the benefits of meditation' or 'Create a study guide for JavaScript promises'"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-6 resize-none"
              rows="5"
              @keydown.meta.enter="generateAiNote"
              @keydown.ctrl.enter="generateAiNote"
            />

            <!-- Helper Text -->
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center">
              Powered by Google Gemini 2.5 Flash • Press 
              <kbd class="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">⌘</kbd>
              <kbd class="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd>
              to generate
            </p>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="showAiGenerateModal = false"
                :disabled="isGeneratingAi"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                block
                @click="generateAiNote"
                :loading="isGeneratingAi"
                :disabled="isGeneratingAi || !aiPrompt.trim()"
                icon="i-heroicons-sparkles"
              >
                Generate
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden relative">
      <!-- Notes List -->
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

        <div v-else class="grid gap-4">
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
                
                <span v-if="note.folder" class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <UIcon name="i-heroicons-folder" class="w-3 h-3" />
                  {{ note.folder }}
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
            <!-- Menu Items -->
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
</template>

<style scoped>
/* Hide scrollbar for filter pills */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
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

/* Fade animation for three dots button */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Slide down animation for mobile menu */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
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
