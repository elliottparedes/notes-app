<script setup lang="ts">
import type { UpdateNoteDto, Folder } from '~/models';
import { useAuthStore } from '~/stores/auth';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const toast = useToast();

// Network status
const { isOnline } = useNetworkStatus();

const noteId = computed(() => route.params.id as string);
const isSaving = ref(false);
const isLoading = ref(true);
const autoSaveTimeout = ref<NodeJS.Timeout | null>(null);
const showShortcuts = ref(false);
const showDeleteModal = ref(false);
const isDeleting = ref(false);
const isLocked = ref(false);
const showEditorToolbar = ref(true);
const showFolderDropdown = ref(false);
const folderDropdownPos = ref({ top: 0, left: 0 });
const folderButtonRef = ref<HTMLButtonElement | null>(null);
const isPolishing = ref(false);
const isPublishing = ref(false);
const publishStatus = ref<{ is_published: boolean; share_url?: string } | null>(null);
const showPublishModal = ref(false);
const attachments = ref<Array<import('~/models').Attachment>>([]);
const isLoadingAttachments = ref(false);
const isExportingPdf = ref(false);
const fileUploadInputRef = ref<HTMLInputElement | null>(null);

const editForm = reactive<UpdateNoteDto & { content: string }>({
  title: '',
  content: '',
  tags: [],
  folder: '',
  folder_id: null as number | null
});

const currentNote = computed(() => notesStore.currentNote);

// Selected folder name for display
const selectedFolderName = computed(() => {
  if (!editForm.folder_id) return null;
  
  const folder = foldersStore.getFolderById(editForm.folder_id);
  if (!folder) return null;
  
  // Build full path
  const path: string[] = [];
  let current = folder;
  while (current) {
    path.unshift(current.name);
    if (current.parent_id === null) break;
    const parent = foldersStore.getFolderById(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  
  return path.join(' › ');
});

// Function to select a folder for the note
function selectFolderForNote(folderId: number | null) {
  editForm.folder_id = folderId;
  editForm.folder = folderId ? foldersStore.getFolderById(folderId)?.name || null : null;
}

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (!showFolderDropdown.value) return;
    
    const target = event.target as HTMLElement;
    
    // Check if click is on the folder button or inside the dropdown
    if (folderButtonRef.value?.contains(target)) return;
    
    // Check if click is inside the dropdown (it's teleported to body)
    const dropdown = document.querySelector('[data-folder-dropdown]');
    if (dropdown?.contains(target)) return;
    
    showFolderDropdown.value = false;
  };
  
  document.addEventListener('click', handleClickOutside);
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
});

// Helper function to extract plain text from HTML
const getPlainText = (html: string | null | undefined): string => {
  if (!html) return '';
  // Create a temporary div to parse HTML and extract text
  if (process.client) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
  // Fallback for SSR: basic HTML tag removal
  return html.replace(/<[^>]*>/g, '').trim();
};

// Character and word count
const wordCount = computed(() => {
  const plainText = getPlainText(editForm.content);
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(word => word.length > 0).length;
});

const charCount = computed(() => {
  const plainText = getPlainText(editForm.content);
  return plainText.length;
});

// Toggle editor toolbar
function toggleEditorToolbar() {
  showEditorToolbar.value = !showEditorToolbar.value;
  // Save preference to localStorage
  if (process.client) {
    localStorage.setItem('tiptap-toolbar-visible', String(showEditorToolbar.value));
  }
}

// Position folder dropdown
watch(showFolderDropdown, (show) => {
  if (show) {
    nextTick(() => {
      const button = folderButtonRef.value;
      if (button) {
        const rect = button.getBoundingClientRect();
        folderDropdownPos.value = {
          top: rect.bottom + 4,
          left: rect.left
        };
      }
    });
  }
});

// Redirect to dashboard and open tab
onMounted(async () => {
  // Redirect to dashboard and open this note in a tab
  try {
    await notesStore.openTab(noteId.value);
    router.push('/dashboard');
    // Check publish status
    checkPublishStatus();
    // Load attachments
    loadAttachments();
  } catch (error) {
    console.error('Error opening note:', error);
    router.push('/dashboard');
  }
});

// Load attachments for the note
async function loadAttachments() {
  try {
    isLoadingAttachments.value = true;
    const authStore = useAuthStore();
    if (!authStore.token) {
      console.log('[loadAttachments] No auth token');
      return;
    }
    
    console.log('[loadAttachments] Loading attachments for note:', noteId.value);
    const atts = await $fetch<Array<import('~/models').Attachment>>(
      `/api/notes/${noteId.value}/attachments`,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    );
    
    console.log('[loadAttachments] Loaded attachments:', atts.length, atts);
    attachments.value = atts;
  } catch (error: any) {
    console.error('[loadAttachments] Failed to load attachments:', error);
    console.error('[loadAttachments] Error details:', error.data || error.message);
    toast.add({
      title: 'Failed to load attachments',
      description: error.data?.message || error.message || 'Unknown error',
      color: 'error',
    });
  } finally {
    isLoadingAttachments.value = false;
  }
}

// Handle attachment upload
function handleAttachmentUploaded(attachment: import('~/models').Attachment) {
  attachments.value = [attachment, ...attachments.value];
}

// Handle attachment deletion
function handleAttachmentDeleted(attachmentId: number) {
  attachments.value = attachments.value.filter((a) => a.id !== attachmentId);
}

// Delete attachment (inline version)
async function deleteAttachment(attachmentId: number) {
  if (isDeleting.value) return;
  
  try {
    isDeleting.value = true;
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.add({
        title: 'Error',
        description: 'Not authenticated',
        color: 'error',
      });
      return;
    }
    
    await $fetch(`/api/notes/${noteId.value}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    
    handleAttachmentDeleted(attachmentId);
    toast.add({
      title: 'Success',
      description: 'File deleted successfully',
      color: 'success',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete file',
      color: 'error',
    });
  } finally {
    isDeleting.value = false;
  }
}

// Trigger file upload from header button
function triggerFileUpload() {
  fileUploadInputRef.value?.click();
}

// Handle file selection from header button
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files || files.length === 0) return;
  
  const authStore = useAuthStore();
  if (!authStore.token) {
    toast.add({
      title: 'Error',
      description: 'Not authenticated',
      color: 'error',
    });
    return;
  }
  
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      const attachment = await $fetch<import('~/models').Attachment>(
        `/api/notes/${noteId.value}/attachments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: formData,
        }
      );
      
      handleAttachmentUploaded(attachment);
      
      // Reload attachments list to get fresh presigned URLs
      await loadAttachments();
    }
    
    // Reset input
    if (fileUploadInputRef.value) {
      fileUploadInputRef.value.value = '';
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    toast.add({
      title: 'Upload Failed',
      description: error.data?.message || 'Failed to upload file',
      color: 'error',
    });
  }
}

// Export note as PDF
async function exportAsPdf() {
  if (isExportingPdf.value) return;
  
  try {
    isExportingPdf.value = true;
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.add({
        title: 'Error',
        description: 'Not authenticated',
        color: 'error',
      });
      return;
    }
    
    // Open PDF in new tab (will trigger download)
    const url = `/api/notes/${noteId.value}/export.pdf`;
    window.open(url, '_blank');
    
    toast.add({
      title: 'PDF Export Started',
      description: 'Your PDF is being generated',
      color: 'success',
    });
  } catch (error: any) {
    console.error('PDF export error:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to export PDF',
      color: 'error',
    });
  } finally {
    isExportingPdf.value = false;
  }
}

// Check publish status
async function checkPublishStatus() {
  try {
    const authStore = useAuthStore();
    if (!authStore.token) return;
    
    const status = await $fetch<{ is_published: boolean; share_url?: string }>(`/api/notes/${noteId.value}/publish-status`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    publishStatus.value = status;
  } catch (error) {
    console.error('Error checking publish status:', error);
    publishStatus.value = { is_published: false };
  }
}

// Publish note
async function publishNote() {
  if (isPublishing.value) return;
  
  try {
    isPublishing.value = true;
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.add({ title: 'Error', description: 'Not authenticated', color: 'error' });
      return;
    }
    
    const response = await $fetch<{ share_id: string; share_url: string }>(`/api/notes/${noteId.value}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    publishStatus.value = { is_published: true, share_url: response.share_url };
    showPublishModal.value = true;
    toast.add({
      title: 'Note Published',
      description: 'Your note is now publicly accessible',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Error publishing note:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to publish note',
      color: 'error'
    });
  } finally {
    isPublishing.value = false;
  }
}

// Unpublish note
async function unpublishNote() {
  if (isPublishing.value) return;
  
  try {
    isPublishing.value = true;
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.add({ title: 'Error', description: 'Not authenticated', color: 'error' });
      return;
    }
    
    await $fetch(`/api/notes/${noteId.value}/unpublish`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    publishStatus.value = { is_published: false };
    showPublishModal.value = false;
    toast.add({
      title: 'Note Unpublished',
      description: 'Your note is no longer publicly accessible',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Error unpublishing note:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to unpublish note',
      color: 'error'
    });
  } finally {
    isPublishing.value = false;
  }
}

// Copy share URL
function copyShareUrl() {
  if (!publishStatus.value?.share_url) return;
  
  if (process.client && navigator.clipboard) {
    navigator.clipboard.writeText(publishStatus.value.share_url);
    toast.add({
      title: 'Link Copied',
      description: 'Share link copied to clipboard',
      color: 'success'
    });
  }
}

// Auto-save on content change (only when not locked)
watch([() => editForm.title, () => editForm.content, () => editForm.folder_id], () => {
  if (isLocked.value) return; // Don't auto-save when locked
  
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
  }
  
  autoSaveTimeout.value = setTimeout(() => {
    saveNote(true);
  }, 1000); // Auto-save after 1 second of inactivity
});

// Toggle lock state
function toggleLock() {
  isLocked.value = !isLocked.value;
  
  // Save lock state to localStorage
  if (process.client) {
    localStorage.setItem(`note-${noteId.value}-locked`, isLocked.value.toString());
  }
  
  if (isLocked.value) {
    toast.add({
      title: 'Note Locked',
      description: 'Read-only mode activated',
      color: 'success'
    });
  } else {
    toast.add({
      title: 'Note Unlocked',
      description: 'You can now edit this note',
      color: 'success'
    });
  }
}

async function saveNote(silent = false) {
  if (!editForm.title?.trim()) {
    if (!silent) {
      toast.add({
        title: 'Validation Error',
        description: 'Title is required',
        color: 'error'
      });
    }
    return;
  }

  isSaving.value = true;

  try {
    // Prepare the data to send
    const updateData: UpdateNoteDto = {
      title: editForm.title,
      content: editForm.content,
      tags: editForm.tags || [],
      folder: editForm.folder || null,
      folder_id: editForm.folder_id || null
    };
    
    console.log('Saving note with data:', updateData);
    
    await notesStore.updateNote(noteId.value, updateData);
    if (!silent) {
      toast.add({
        title: 'Success',
        description: 'Note saved',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Save error:', error);
    if (!silent) {
      toast.add({
        title: 'Error',
        description: 'Failed to save note',
        color: 'error'
      });
    }
  } finally {
    isSaving.value = false;
  }
}

function deleteNote() {
  showDeleteModal.value = true;
}

async function confirmDelete() {
  isDeleting.value = true;

  try {
    await notesStore.deleteNote(noteId.value);
    toast.add({
      title: 'Success',
      description: 'Note deleted',
      color: 'success'
    });
    showDeleteModal.value = false;
    router.push('/dashboard');
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
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Handle tags input
const tagInput = ref('');

function addTag() {
  const trimmedTag = tagInput.value.trim();
  if (!trimmedTag) return;
  
  // Ensure tags is an array
  if (!editForm.tags || editForm.tags === null) {
    editForm.tags = [];
  }
  
  // Check if tag already exists
  if (editForm.tags.includes(trimmedTag)) {
    tagInput.value = '';
    return;
  }
  
  // Add the tag
  editForm.tags = [...editForm.tags, trimmedTag];
  tagInput.value = '';
  
  // Save immediately
  saveNote(true);
}

function removeTag(tag: string) {
  if (editForm.tags && editForm.tags.length > 0) {
    // Create a new array to trigger reactivity
    editForm.tags = editForm.tags.filter(t => t !== tag);
    saveNote(true);
  }
}

// Polish note with AI
async function polishNote() {
  if (!editForm.title?.trim() && !editForm.content?.trim()) {
    toast.add({
      title: 'Nothing to Polish',
      description: 'Add some content to your note first',
      color: 'warning'
    });
    return;
  }

  isPolishing.value = true;

  try {
    const authStore = useAuthStore();
    const response = await $fetch<{ title: string; content: string }>('/api/notes/polish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        title: editForm.title || 'Untitled Note',
        content: editForm.content || ''
      }
    });

    // Update the note with the polished content
    editForm.title = response.title;
    editForm.content = response.content;

    toast.add({
      title: 'Note Polished! ✨',
      description: 'Your note has been cleaned and organized',
      color: 'success'
    });

    // Save the changes
    await saveNote(true);
  } catch (error: any) {
    console.error('Polish error:', error);
    toast.add({
      title: 'Polish Failed',
      description: error.data?.message || 'Failed to polish note with AI',
      color: 'error'
    });
  } finally {
    isPolishing.value = false;
  }
}

// Cleanup auto-save timeout
onUnmounted(() => {
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
  }
});
</script>

<template>
  <div class="min-h-screen" :class="isLocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'">
    <!-- Top Navigation Bar -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="flex items-center justify-between h-16 px-4 md:px-6">
        <!-- Left: Back Button & Logo -->
        <div class="flex items-center gap-3">
          <UButton
            icon="i-heroicons-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="router.push('/dashboard')"
          />
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
            </div>
            <h1 class="text-lg font-bold text-gray-900 dark:text-white hidden md:block">Notes</h1>
          </div>
        </div>

        <!-- Right: Note Actions -->
        <div class="flex items-center gap-2">
          <!-- Save Status (Client-only to prevent hydration mismatch) -->
          <ClientOnly>
            <div v-if="!isOnline" class="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
              <UIcon name="i-heroicons-wifi" class="w-4 h-4" />
              <span class="hidden sm:inline">Offline</span>
            </div>
            <div v-else-if="isSaving" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
              <span class="hidden sm:inline">Saving...</span>
            </div>
            <div v-else class="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
              <span class="hidden sm:inline">Saved</span>
            </div>
          </ClientOnly>
          
          <!-- File Upload Button -->
          <UButton
            icon="i-heroicons-paper-clip"
            color="primary"
            variant="ghost"
            size="sm"
            @click="triggerFileUpload"
            title="Upload File"
          />
          
          <!-- PDF Export Button -->
          <UButton
            icon="i-heroicons-document-arrow-down"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="isExportingPdf"
            @click="exportAsPdf"
            title="Export as PDF"
          />
          
          <!-- Publish/Unpublish Button -->
          <UButton
            :icon="publishStatus?.is_published ? 'i-heroicons-globe-alt' : 'i-heroicons-link'"
            :color="publishStatus?.is_published ? 'primary' : 'neutral'"
            variant="ghost"
            size="sm"
            :loading="isPublishing"
            @click="publishStatus?.is_published ? unpublishNote() : publishNote()"
            :title="publishStatus?.is_published ? 'Unpublish Note' : 'Publish Note'"
          />
          
          <!-- Lock/Unlock Button -->
          <UButton
            :icon="isLocked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'"
            :color="isLocked ? 'warning' : 'neutral'"
            variant="ghost"
            size="sm"
            @click="toggleLock"
            :title="isLocked ? 'Unlock Note (Enable Editing)' : 'Lock Note (Read-Only)'"
          />
          
          <!-- Keyboard Shortcuts -->
          <UButton
            icon="i-heroicons-question-mark-circle"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="showShortcuts = true"
            title="Keyboard Shortcuts"
          />
          
          <!-- Delete -->
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            @click="deleteNote"
          />
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 animate-spin mx-auto text-primary-600 mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading note...</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Please wait a moment</p>
      </div>
    </div>

    <!-- Editor Container -->
    <div v-else>
      <!-- Note Header (Title & Stats) -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-6">
        <div class="max-w-5xl mx-auto">
          <!-- Locked State: Read-only title -->
          <h1
            v-if="isLocked"
            class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3"
          >
            {{ editForm.title || 'Untitled Note' }}
          </h1>
          <!-- Unlocked State: Editable title -->
          <input
            v-else
            v-model="editForm.title"
            type="text"
            class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-400 mb-3"
            placeholder="Untitled Note"
          />
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span v-if="isLocked" class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5" />
              Read-Only Mode
            </span>
            <ClientOnly>
              <span v-if="currentNote" class="flex items-center gap-1">
                <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
                {{ formatDate(currentNote.updated_at) }}
              </span>
            </ClientOnly>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
              {{ wordCount }} words
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-chart-bar" class="w-3.5 h-3.5" />
              {{ charCount }} characters
            </span>
            <!-- Toolbar Toggle Button -->
            <button
              v-if="!isLocked"
              @click="toggleEditorToolbar"
              class="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
              :title="showEditorToolbar ? 'Hide Toolbar' : 'Show Toolbar'"
            >
              <UIcon :name="showEditorToolbar ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">{{ showEditorToolbar ? 'Hide' : 'Show' }} Toolbar</span>
            </button>
            <!-- Polish with AI Button -->
            <button
              v-if="!isLocked"
              @click="polishNote"
              :disabled="isPolishing"
              class="polish-ai-button-small group relative inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white rounded-md transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              :title="isPolishing ? 'Polishing with AI...' : 'Polish with AI'"
            >
              <UIcon 
                name="i-heroicons-sparkles" 
                :class="isPolishing ? 'animate-spin' : 'group-hover:animate-pulse'" 
                class="w-3.5 h-3.5" 
              />
              <span class="hidden sm:inline">{{ isPolishing ? 'Polishing...' : 'Polish' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Metadata Bar (Hidden when locked) -->
      <div v-if="!isLocked" class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-4 text-sm flex-wrap">
            <!-- Folder -->
            <div class="flex items-center gap-2 relative">
              <UIcon name="i-heroicons-folder" class="w-4 h-4 text-gray-400" />
              <button
                ref="folderButtonRef"
                type="button"
                @click="showFolderDropdown = !showFolderDropdown"
                class="bg-transparent text-left text-gray-600 dark:text-gray-400 placeholder-gray-400 w-48 hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-2"
              >
                <span class="truncate">{{ selectedFolderName || 'No folder' }}</span>
                <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 flex-shrink-0" />
              </button>
              
              <!-- Folder Dropdown -->
              <Teleport to="body">
                <div
                  v-if="showFolderDropdown"
                  data-folder-dropdown
                  @click.stop
                  class="fixed z-[9999] w-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl py-2 max-h-96 overflow-y-auto"
                  :style="{ top: `${folderDropdownPos.top}px`, left: `${folderDropdownPos.left}px` }"
                >
                  <button
                    type="button"
                    @click="selectFolderForNote(null); showFolderDropdown = false"
                    class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    :class="(editForm.folder_id ?? null) === null ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''"
                  >
                    <UIcon name="i-heroicons-document-text" class="w-4 h-4 inline mr-2 text-gray-500" />
                    No folder
                  </button>
                  <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <FolderSelectorItem
                    v-for="folder in foldersStore.folderTree"
                    :key="folder.id"
                    :folder="folder"
                    :selected-id="editForm.folder_id ?? null"
                    :depth="0"
                    @select="(id) => { selectFolderForNote(id); showFolderDropdown = false; }"
                  />
                </div>
              </Teleport>
            </div>

            <!-- Tags -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div class="flex items-center gap-1 flex-wrap">
                <UBadge
                  v-for="tag in editForm.tags"
                  :key="tag"
                  color="primary"
                  variant="soft"
                  size="xs"
                  class="cursor-pointer hover:bg-primary-200 dark:hover:bg-primary-800"
                  @click="removeTag(tag)"
                >
                  {{ tag }}
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1" />
                </UBadge>
                <input
                  v-model="tagInput"
                  type="text"
                  class="bg-transparent border-none outline-none text-gray-600 dark:text-gray-400 placeholder-gray-400 text-sm w-24"
                  placeholder="Add tag..."
                  @keyup.enter="addTag"
                  @blur="addTag"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Folder & Tags Display (Read-only when locked) -->
      <div v-else-if="(selectedFolderName || editForm.tags?.length)" class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-3 text-sm flex-wrap">
            <div v-if="selectedFolderName || !editForm.folder_id" class="flex items-center gap-2">
              <UIcon name="i-heroicons-folder" class="w-4 h-4 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-400">{{ selectedFolderName || 'No folder' }}</span>
            </div>
            <div v-if="editForm.tags && editForm.tags.length > 0" class="flex items-center gap-2 flex-wrap">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-400" />
              <UBadge
                v-for="tag in editForm.tags"
                :key="tag"
                color="primary"
                variant="soft"
                size="xs"
              >
                {{ tag }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- Hidden File Input for Header Button -->
      <input
        ref="fileUploadInputRef"
        type="file"
        class="hidden"
        multiple
        @change="handleFileUpload"
      />
      
      <!-- WYSIWYG Editor Area -->
      <div class="pb-20" :class="isLocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'">
        <div class="max-w-5xl mx-auto py-6 px-4 md:px-6">
          <!-- Attachments Links at Top -->
          <div v-if="attachments.length > 0" class="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div v-if="isLoadingAttachments" class="text-center py-2">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mx-auto text-gray-400" />
            </div>
            <div v-else class="flex flex-wrap items-center gap-3">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <UIcon name="i-heroicons-paper-clip" class="w-3.5 h-3.5" />
                Attachments:
              </span>
              <div
                v-for="attachment in attachments"
                :key="attachment.id"
                class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <a
                  :href="attachment.presigned_url || `/api/notes/${noteId}/attachments/${attachment.id}`"
                  target="_blank"
                  download
                  class="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1.5"
                  :title="`Download ${attachment.file_name}`"
                >
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-3.5 h-3.5" />
                  <span>{{ attachment.file_name }}</span>
                </a>
                <button
                  v-if="!isLocked"
                  @click="deleteAttachment(attachment.id)"
                  class="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  :title="`Delete ${attachment.file_name}`"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <ClientOnly>
            <TiptapEditor
              v-model="editForm.content"
              placeholder="Start writing..."
              :editable="!isLocked"
              :showToolbar="showEditorToolbar"
              :noteId="noteId"
            />
          </ClientOnly>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showShortcuts"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showShortcuts = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <button
                @click="showShortcuts = false"
                class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <!-- Shortcuts List -->
            <div class="space-y-4">
              <!-- Formatting -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Formatting</h4>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Bold</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ B</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Italic</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ I</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Code</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ E</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Link</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ K</kbd>
                  </div>
                </div>
              </div>

              <!-- Headings -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Headings</h4>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Heading 1-6</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ ⌥ 1-6</kbd>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Actions</h4>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Undo</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ Z</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Redo</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ ⇧ Z</kbd>
                  </div>
                </div>
              </div>

                <!-- Insert -->
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Insert</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">Image</span>
                      <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Image icon</kbd>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">Table</span>
                      <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Table icon</kbd>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">Add/delete columns/rows</span>
                      <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Toolbar buttons</kbd>
                    </div>
                  </div>
                </div>
              </div>

            <!-- Footer Tip -->
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                💡 Tip: Use the toolbar above the editor for formatting
              </p>
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
              <span class="font-semibold text-gray-900 dark:text-white">"{{ editForm.title }}"</span>? 
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

    <!-- Publish Modal -->
    <div
      v-if="showPublishModal && publishStatus?.is_published"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        @click="showPublishModal = false"
      />
      
      <!-- Modal -->
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Note Published
          </h3>
          <button
            @click="showPublishModal = false"
            class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <!-- Description -->
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Your note is now publicly accessible. Anyone with the link can view it.
        </p>

        <!-- Share URL -->
        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Share Link
          </label>
          <div class="flex gap-2">
            <input
              :value="publishStatus.share_url"
              readonly
              class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
            <UButton
              icon="i-heroicons-clipboard-document"
              color="primary"
              @click="copyShareUrl"
            >
              Copy
            </UButton>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <UButton
            color="neutral"
            variant="soft"
            block
            @click="showPublishModal = false"
          >
            Close
          </UButton>
          <UButton
            color="error"
            variant="soft"
            block
            @click="unpublishNote"
          >
            Unpublish
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Polish AI Button - Stunning Purple Gradient (Small Version) */
.polish-ai-button-small {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
  box-shadow: 0 2px 8px 0 rgba(102, 126, 234, 0.3);
}

.polish-ai-button-small:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #6a3f92 50%, #e082ea 100%);
  background-size: 200% 200%;
  box-shadow: 0 3px 12px 0 rgba(102, 126, 234, 0.5);
}

.polish-ai-button-small:active:not(:disabled) {
  transform: scale(0.95);
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

/* Remove input autofill background */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px white inset;
  transition: background-color 5000s ease-in-out 0s;
}

.dark input:-webkit-autofill,
.dark input:-webkit-autofill:hover,
.dark input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px #1f2937 inset;
  -webkit-text-fill-color: #f3f4f6;
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
</style>
