<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useFilesStore, type FileItem } from '~/stores/files';
import { useAuthStore } from '~/stores/auth';
import { useToast } from '~/composables/useToast';

const router = useRouter();
const filesStore = useFilesStore();
const authStore = useAuthStore();
const toast = useToast();

const fileInputRef = ref<HTMLInputElement | null>(null);
const showCreateFolderModal = ref(false);
const newFolderName = ref('');
const isCreatingFolder = ref(false);
const isUploading = ref(false);
const folders = ref<Array<{ path: string; name: string }>>([]);
const foldersLoading = ref(false);
const showViewDropdown = ref(false);

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get file icon
function getFileIcon(file: FileItem): string {
  if (!file.mime_type) return 'i-heroicons-document';
  if (file.mime_type.startsWith('image/')) return 'i-heroicons-photo';
  if (file.mime_type.startsWith('video/')) return 'i-heroicons-video-camera';
  if (file.mime_type.includes('pdf')) return 'i-heroicons-document-text';
  return 'i-heroicons-document';
}

// Upload files
async function uploadFiles(files: File[]) {
  if (files.length === 0) return;
  
  isUploading.value = true;
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_path', filesStore.currentFolder);
      
      await $fetch('/api/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`
        },
        body: formData
      });
    }
    
    await filesStore.fetchFiles();
    toast.success(`Uploaded ${files.length} file(s)`);
  } catch (error: any) {
    console.error('Upload error:', error);
    toast.error(error.data?.message || 'Failed to upload files');
  } finally {
    isUploading.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}

function handleFileInput(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    uploadFiles(Array.from(target.files));
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer?.files) {
    uploadFiles(Array.from(event.dataTransfer.files));
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim() || isCreatingFolder.value) return;
  
  isCreatingFolder.value = true;
  try {
    await $fetch('/api/files/folders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        folder_name: newFolderName.value.trim(),
        parent_path: filesStore.currentFolder
      }
    });
    
    await Promise.all([
      filesStore.fetchFiles(filesStore.currentFolder),
      fetchFolders()
    ]);
    showCreateFolderModal.value = false;
    newFolderName.value = '';
    toast.success('Folder created');
  } catch (error: any) {
    toast.error(error.data?.message || 'Failed to create folder');
  } finally {
    isCreatingFolder.value = false;
  }
}

async function fetchFolders() {
  foldersLoading.value = true;
  try {
    const response = await $fetch<{ folders: Array<{ path: string; name: string }> }>(
      `/api/files/folders?parent=${encodeURIComponent(filesStore.currentFolder)}`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }
    );
    folders.value = response.folders;
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    folders.value = [];
  } finally {
    foldersLoading.value = false;
  }
}

async function navigateToFolder(folderPath: string) {
  filesStore.currentFolder = folderPath;
  await Promise.all([
    filesStore.fetchFiles(folderPath),
    fetchFolders()
  ]);
}

function getParentFolder() {
  if (filesStore.currentFolder === '/') return null;
  const parts = filesStore.currentFolder.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

async function goToParentFolder() {
  const parent = getParentFolder();
  if (parent !== null) {
    await navigateToFolder(parent);
  }
}

// Breadcrumbs
const breadcrumbs = computed(() => {
  const crumbs: Array<{ path: string; name: string }> = [{ path: '/', name: 'Storage' }]; // Always include root
  if (filesStore.currentFolder === '/') return crumbs;
  const parts = filesStore.currentFolder.split('/').filter(Boolean);
  let currentPath = '';
  parts.forEach((part) => {
    currentPath += '/' + part;
    crumbs.push({ path: currentPath, name: part });
  });
  return crumbs;
});

// Helper to check if we're on mobile (client-side only)
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 768;
});

// Responsive routing - redirect to dashboard if screen becomes desktop
watch(isMobileView, (isMobile) => {
  if (!isMobile && process.client) {
    // Screen became desktop size, redirect to dashboard with storage view
    router.replace('/dashboard?view=storage');
  }
}, { immediate: false });

// Load files on mount
onMounted(async () => {
  // Redirect if on desktop
  if (!isMobileView.value) {
    router.replace('/dashboard?view=storage');
    return;
  }

  try {
    await Promise.all([
      filesStore.fetchFiles(),
      fetchFolders()
    ]);
  } catch (error) {
    console.error('Failed to load files:', error);
    toast.error('Failed to load files');
  }

  // Listen for window resize
  const handleResize = () => {
    if (window.innerWidth >= 768) {
      // Screen became desktop, redirect to storage view
      router.replace('/dashboard?view=storage');
    }
  };

  window.addEventListener('resize', handleResize);

  // Click outside logic for dropdown
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-view-dropdown]')) {
      showViewDropdown.value = false;
    }
  };
  
  watch(() => showViewDropdown.value, (isOpen) => {
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('click', handleClickOutside); // Add this cleanup
  });
});

// Watch for folder changes
watch(() => filesStore.currentFolder, async (newFolder, oldFolder) => {
  // Only fetch if folder actually changed (not on initial mount)
  if (oldFolder !== undefined) {
    await fetchFolders();
  }
});
</script>

<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-900 md:hidden">
    <!-- Top Nav -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div class="relative" data-view-dropdown>
            <button
              @click.stop="showViewDropdown = !showViewDropdown"
              class="flex items-center gap-1.5 font-medium text-sm text-gray-900 dark:text-gray-100"
            >
              <span>Storage</span>
              <UIcon 
                name="i-heroicons-chevron-down" 
                class="w-4 h-4 transition-transform"
                :class="{ 'rotate-180': showViewDropdown }"
              />
            </button>
            
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
                @click="router.push('/mobile/home'); showViewDropdown = false"
                class="w-full text-left px-3 py-1.5 text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-book-open" class="w-4 h-4" />
                <span>Notebooks</span>
              </button>
              <button
                @click="showViewDropdown = false"
                class="w-full text-left px-3 py-1.5 text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2"
              >
                <UIcon name="i-heroicons-folder" class="w-4 h-4" />
                <span>Storage</span>
              </button>
            </div>
          </Transition>
        </div>
      
      <!-- Right Actions -->
      <div class="flex items-center gap-1">
        <button
          @click="fileInputRef?.click()"
          class="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 active:scale-95 transition"
          :disabled="isUploading"
          title="Upload file"
        >
          <UIcon 
            :name="isUploading ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'" 
            class="w-5 h-5"
            :class="{ 'animate-spin': isUploading }"
          />
        </button>
        <button
          @click="showCreateFolderModal = true"
          class="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition"
          title="New folder"
        >
          <UIcon name="i-heroicons-folder-plus" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Breadcrumbs -->
    <div v-if="breadcrumbs.length > 0" class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
          <UIcon v-if="index > 0" name="i-heroicons-chevron-right" class="w-3 h-3 text-gray-400" />
          <button
            @click="navigateToFolder(crumb.path)"
            class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap flex items-center"
          >
            <UIcon v-if="index === 0" name="i-heroicons-home" class="w-4 h-4" />
            <span v-else>{{ crumb.name }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Content -->
    <div 
      class="flex-1 overflow-y-auto pb-20"
      @drop="handleDrop"
      @dragover="handleDragOver"
    >
      <!-- Empty State -->
      <div v-if="folders.length === 0 && filesStore.files.length === 0 && !filesStore.loading && !foldersLoading" class="flex flex-col items-center justify-center h-full p-8 text-center">
        <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-folder" class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No files yet</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Upload files or create folders to get started</p>
        <button
          @click="fileInputRef?.click()"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition"
        >
          Upload Files
        </button>
      </div>

      <!-- Files List -->
      <div v-else class="p-4 space-y-2">
        <!-- Folders -->
        <button
          v-for="folder in folders"
          :key="folder.path"
          @click="navigateToFolder(folder.path)"
          class="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:scale-[0.98] transition"
        >
          <UIcon name="i-heroicons-folder" class="w-6 h-6 text-blue-500" />
          <div class="flex-1 text-left min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ folder.name }}
            </p>
          </div>
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-400" />
        </button>

        <!-- Files -->
        <button
          v-for="file in filesStore.files"
          :key="file.id"
          @click="window.open(file.download_url || file.presigned_url, '_blank')"
          class="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 active:scale-[0.98] transition"
        >
          <UIcon :name="getFileIcon(file)" class="w-6 h-6 text-gray-500" />
          <div class="flex-1 text-left min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ file.file_name }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatFileSize(file.file_size) }}
            </p>
          </div>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="filesStore.loading || foldersLoading" class="flex items-center justify-center py-20">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      class="hidden"
      @change="handleFileInput"
    />

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

