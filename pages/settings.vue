<script setup lang="ts">
const authStore = useAuthStore();
const toast = useToast();

// Dark mode toggle
const colorMode = useColorMode();

const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const showTempPasswordAlert = computed(() => authStore.needsPasswordReset);

// Storage quota
interface StorageQuota {
  used: number;
  limit: number;
  usedMB: string;
  limitMB: string;
  usedPercent: number;
}

const storageQuota = ref<StorageQuota | null>(null);
const loadingStorage = ref(false);

async function fetchStorageQuota() {
  if (!authStore.token) return;
  
  loadingStorage.value = true;
  try {
    const data = await $fetch<StorageQuota>('/api/user/storage', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    storageQuota.value = data;
  } catch (error: any) {
    console.error('Error fetching storage quota:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to load storage information',
      color: 'error'
    });
  } finally {
    loadingStorage.value = false;
  }
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Computed for remaining storage
const remainingStorage = computed(() => {
  if (!storageQuota.value) return null;
  return storageQuota.value.limit - storageQuota.value.used;
});

const remainingStorageMB = computed(() => {
  if (!remainingStorage.value) return null;
  return (remainingStorage.value / (1024 * 1024)).toFixed(2);
});

// Published content
interface PublishedItem {
  id: number;
  share_id: string;
  share_url: string;
  published_at: Date;
  updated_at: Date;
  title?: string;
  name?: string;
  note_id?: string;
  folder_id?: number;
  space_id?: number;
}

interface PublishedContent {
  notes: PublishedItem[];
  folders: PublishedItem[];
  spaces: PublishedItem[];
}

const publishedContent = ref<PublishedContent>({ notes: [], folders: [], spaces: [] });
const loadingPublished = ref(false);
const activeTab = ref<'notes' | 'folders' | 'spaces'>('notes');
const searchQuery = ref('');

// Unpublish modal state
const showUnpublishModal = ref(false);
const itemToUnpublish = ref<{ item: PublishedItem; type: 'note' | 'folder' | 'space' } | null>(null);
const isUnpublishing = ref(false);

// Filter published items based on search
const filteredNotes = computed(() => {
  if (!searchQuery.value.trim()) return publishedContent.value.notes;
  const query = searchQuery.value.toLowerCase();
  return publishedContent.value.notes.filter(item => 
    item.title?.toLowerCase().includes(query)
  );
});

const filteredFolders = computed(() => {
  if (!searchQuery.value.trim()) return publishedContent.value.folders;
  const query = searchQuery.value.toLowerCase();
  return publishedContent.value.folders.filter(item => 
    item.name?.toLowerCase().includes(query)
  );
});

const filteredSpaces = computed(() => {
  if (!searchQuery.value.trim()) return publishedContent.value.spaces;
  const query = searchQuery.value.toLowerCase();
  return publishedContent.value.spaces.filter(item => 
    item.name?.toLowerCase().includes(query)
  );
});

const currentItems = computed(() => {
  let items: PublishedItem[] = [];
  switch (activeTab.value) {
    case 'notes': 
      items = filteredNotes.value;
      break;
    case 'folders': 
      items = filteredFolders.value;
      break;
    case 'spaces': 
      items = filteredSpaces.value;
      break;
    default: 
      items = [];
  }
  
  // Debug: Log first item structure when switching tabs
  if (items.length > 0) {
    console.log(`Current ${activeTab.value} items:`, {
      count: items.length,
      firstItem: items[0],
      firstItemKeys: Object.keys(items[0]),
      hasFolderId: items[0].folder_id !== undefined,
      hasSpaceId: items[0].space_id !== undefined,
      hasNoteId: items[0].note_id !== undefined
    });
  }
  
  return items;
});

const totalPublished = computed(() => {
  return publishedContent.value.notes.length + 
         publishedContent.value.folders.length + 
         publishedContent.value.spaces.length;
});

// Fetch published content
async function fetchPublishedContent() {
  if (!authStore.token) return;
  
  loadingPublished.value = true;
  try {
    const data = await $fetch<PublishedContent>('/api/publish/list', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    // Debug: Log the response to verify structure
    console.log('Published content fetched:', {
      notesCount: data.notes?.length || 0,
      foldersCount: data.folders?.length || 0,
      spacesCount: data.spaces?.length || 0,
      firstFolder: data.folders?.[0],
      firstSpace: data.spaces?.[0]
    });
    
    publishedContent.value = data;
  } catch (error: any) {
    console.error('Error fetching published content:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to load published content',
      color: 'error'
    });
  } finally {
    loadingPublished.value = false;
  }
}

// Copy link
async function copyLink(url: string) {
  if (process.client && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    toast.add({
      title: 'Link Copied',
      description: 'Share link copied to clipboard',
      color: 'success'
    });
  }
}

// Show unpublish confirmation modal
function showUnpublishConfirmation(item: PublishedItem, tabType: 'notes' | 'folders' | 'spaces') {
  // Convert tab type to item type
  let type: 'note' | 'folder' | 'space' = 'note';
  if (tabType === 'folders') type = 'folder';
  else if (tabType === 'spaces') type = 'space';
  
  itemToUnpublish.value = { item, type };
  showUnpublishModal.value = true;
}

// Confirm unpublish
async function confirmUnpublish() {
  if (!itemToUnpublish.value || !authStore.token) return;
  
  const { item, type } = itemToUnpublish.value;
  isUnpublishing.value = true;
  
  try {
    let endpoint = '';
    let id: string | number | undefined;
    
    if (type === 'note') {
      id = item.note_id;
      if (id) {
        endpoint = `/api/notes/${id}/unpublish`;
      }
    } else if (type === 'folder') {
      id = item.folder_id;
      if (id) {
        endpoint = `/api/folders/${id}/unpublish`;
      }
    } else if (type === 'space') {
      id = item.space_id;
      if (id) {
        endpoint = `/api/spaces/${id}/unpublish`;
      }
    }
    
    if (!endpoint || !id) {
      console.error('Missing ID for unpublish:', { 
        item, 
        type, 
        note_id: item.note_id,
        folder_id: item.folder_id,
        space_id: item.space_id,
        allKeys: Object.keys(item)
      });
      toast.add({
        title: 'Error',
        description: `Missing required information to unpublish. ${type === 'folder' ? 'Folder ID' : type === 'space' ? 'Space ID' : 'Note ID'} not found.`,
        color: 'error'
      });
      showUnpublishModal.value = false;
      itemToUnpublish.value = null;
      return;
    }

    await $fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });

    toast.add({
      title: 'Unpublished',
      description: `${type === 'note' ? 'Note' : type === 'folder' ? 'Folder and all its contents' : 'Space and all its contents'} have been unpublished`,
      color: 'success'
    });

    // Close modal and refresh the list
    showUnpublishModal.value = false;
    itemToUnpublish.value = null;
    await fetchPublishedContent();
  } catch (error: any) {
    console.error('Error unpublishing:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || error.message || 'Failed to unpublish',
      color: 'error'
    });
  } finally {
    isUnpublishing.value = false;
  }
}

// Cancel unpublish
function cancelUnpublish() {
  showUnpublishModal.value = false;
  itemToUnpublish.value = null;
}

// Format date
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Load on mount
onMounted(() => {
  fetchPublishedContent();
  fetchStorageQuota();
});

// Computed for dark mode toggle state
const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (value: boolean) => {
    colorMode.preference = value ? 'dark' : 'light';
  }
});

async function handleChangePassword() {
  // Validation
  if (!newPassword.value || !confirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'All fields are required',
      color: 'error'
    });
    return;
  }

  if (newPassword.value.length < 6) {
    toast.add({
      title: 'Validation Error',
      description: 'New password must be at least 6 characters',
      color: 'error'
    });
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'Passwords do not match',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    await $fetch('/api/user/force-reset-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        newPassword: newPassword.value
      }
    });

    // Clear the password reset flag
    authStore.clearPasswordResetFlag();

    toast.add({
      title: 'Success',
      description: 'Password changed successfully!',
      color: 'success'
    });

    // Clear form
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to change password',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

function goBack() {
  navigateTo('/dashboard');
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <button
          @click="goBack"
          class="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </button>
        
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Manage your account settings</p>
      </div>

      <!-- Temporary Password Alert -->
      <UCard v-if="showTempPasswordAlert" class="mb-6 border-2 border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
              ⚠️ Password Reset Required
            </h3>
            <p class="text-sm text-blue-800 dark:text-blue-300">
              You logged in with a temporary password. For security, please set a new permanent password using the form below.
            </p>
          </div>
        </div>
      </UCard>

      <!-- Account Info -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Account Information</h2>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <p class="text-gray-900 dark:text-white">{{ authStore.user?.email }}</p>
          </div>
          
          <div v-if="authStore.user?.name">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <p class="text-gray-900 dark:text-white">{{ authStore.user?.name }}</p>
          </div>
        </div>
      </UCard>

      <!-- Storage Usage -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Storage Usage</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Track your file uploads and storage quota
              </p>
            </div>
            <UButton
              icon="i-heroicons-arrow-path"
              variant="ghost"
              size="sm"
              :loading="loadingStorage"
              @click="fetchStorageQuota"
              class="flex-shrink-0"
            >
              Refresh
            </UButton>
          </div>
        </template>

        <div v-if="loadingStorage && !storageQuota" class="py-8 text-center">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-600 dark:text-gray-400 animate-spin" />
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">Loading storage information...</p>
        </div>

        <div v-else-if="storageQuota" class="space-y-4">
          <!-- Progress Bar -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-gray-700 dark:text-gray-300">
                {{ storageQuota.usedMB }} MB of {{ storageQuota.limitMB }} MB used
              </span>
              <span 
                class="font-semibold"
                :class="storageQuota.usedPercent >= 90 
                  ? 'text-red-600 dark:text-red-400' 
                  : storageQuota.usedPercent >= 75 
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400'"
              >
                {{ storageQuota.usedPercent }}%
              </span>
            </div>
            
            <!-- Progress Bar -->
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="storageQuota.usedPercent >= 90 
                  ? 'bg-red-500' 
                  : storageQuota.usedPercent >= 75 
                  ? 'bg-orange-500'
                  : 'bg-primary-500'"
                :style="{ width: `${Math.min(storageQuota.usedPercent, 100)}%` }"
              />
            </div>
          </div>

          <!-- Storage Details -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {{ storageQuota.usedMB }}
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Used
              </div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {{ remainingStorageMB }}
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Remaining
              </div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {{ storageQuota.limitMB }}
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Total Limit
              </div>
            </div>
          </div>

          <!-- Warning Messages -->
          <div 
            v-if="storageQuota.usedPercent >= 90"
            class="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <div class="flex items-start gap-2">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-red-900 dark:text-red-200">
                  Storage Nearly Full
                </p>
                <p class="text-xs text-red-800 dark:text-red-300 mt-1">
                  You're running low on storage space. Consider deleting unused files to free up space.
                </p>
              </div>
            </div>
          </div>
          
          <div 
            v-else-if="storageQuota.usedPercent >= 75"
            class="mt-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
          >
            <div class="flex items-start gap-2">
              <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm font-medium text-orange-900 dark:text-orange-200">
                  Storage Warning
                </p>
                <p class="text-xs text-orange-800 dark:text-orange-300 mt-1">
                  You've used {{ storageQuota.usedPercent }}% of your storage. {{ remainingStorageMB }} MB remaining.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="py-8 text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon name="i-heroicons-server-stack" class="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Unable to load storage information
          </p>
        </div>
      </UCard>

      <!-- Published Content -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Published Content</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage your publicly shared notes, folders, and spaces
              </p>
            </div>
            <UButton
              v-if="totalPublished > 0"
              icon="i-heroicons-arrow-path"
              variant="ghost"
              size="sm"
              :loading="loadingPublished"
              @click="fetchPublishedContent"
              class="flex-shrink-0"
            >
              Refresh
            </UButton>
          </div>
        </template>

        <div v-if="loadingPublished && totalPublished === 0" class="py-12 text-center">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-600 dark:text-gray-400 animate-spin" />
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">Loading published content...</p>
        </div>

        <div v-else-if="totalPublished === 0" class="py-12 text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon name="i-heroicons-globe-alt" class="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No published content yet</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Share your notes, folders, or spaces to make them publicly accessible
          </p>
          <UButton
            to="/dashboard"
            color="primary"
            variant="soft"
          >
            Go to Dashboard
          </UButton>
        </div>

        <div v-else class="space-y-4">
          <!-- Tabs -->
          <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
            <button
              @click="activeTab = 'notes'"
              class="px-4 py-2.5 text-sm font-medium transition-colors relative"
              :class="activeTab === 'notes' 
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            >
              Notes
              <span class="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800"
                    :class="activeTab === 'notes' ? 'bg-primary-50 dark:bg-primary-900/30' : ''">
                {{ publishedContent.notes.length }}
              </span>
            </button>
            <button
              @click="activeTab = 'folders'"
              class="px-4 py-2.5 text-sm font-medium transition-colors relative"
              :class="activeTab === 'folders' 
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            >
              Folders
              <span class="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800"
                    :class="activeTab === 'folders' ? 'bg-primary-50 dark:bg-primary-900/30' : ''">
                {{ publishedContent.folders.length }}
              </span>
            </button>
            <button
              @click="activeTab = 'spaces'"
              class="px-4 py-2.5 text-sm font-medium transition-colors relative"
              :class="activeTab === 'spaces' 
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
            >
              Spaces
              <span class="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800"
                    :class="activeTab === 'spaces' ? 'bg-primary-50 dark:bg-primary-900/30' : ''">
                {{ publishedContent.spaces.length }}
              </span>
            </button>
          </div>

          <!-- Search -->
          <div class="relative">
            <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <UInput
              v-model="searchQuery"
              placeholder="Search published content..."
              class="pl-10"
              size="lg"
            />
          </div>

          <!-- Empty State for Active Tab -->
          <div v-if="currentItems.length === 0" class="py-8 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              No {{ activeTab }} match your search
            </p>
          </div>

          <!-- Items List -->
          <div v-else class="space-y-2">
            <div
              v-for="item in currentItems"
              :key="item.share_id"
              class="group flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all"
            >
              <!-- Icon -->
              <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                   :class="activeTab === 'notes' 
                     ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                     : activeTab === 'folders'
                     ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                     : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'">
                <UIcon 
                  :name="activeTab === 'notes' 
                    ? 'i-heroicons-document-text' 
                    : activeTab === 'folders'
                    ? 'i-heroicons-folder'
                    : 'i-heroicons-building-office-2'" 
                  class="w-5 h-5" 
                />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {{ item.title || item.name }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Published {{ formatDate(item.published_at) }}
                </p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <UButton
                  icon="i-heroicons-clipboard-document"
                  variant="ghost"
                  size="sm"
                  @click="copyLink(item.share_url)"
                  title="Copy link"
                />
                <UButton
                  icon="i-heroicons-x-circle"
                  variant="ghost"
                  size="sm"
                  color="error"
                  @click="showUnpublishConfirmation(item, activeTab)"
                  title="Unpublish"
                />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Appearance Settings -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </template>

        <div class="space-y-4">
          <div class="flex items-center justify-between py-2">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dark Mode
              </label>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Switch between light and dark theme
              </p>
            </div>
            <!-- Custom Toggle Switch -->
            <button
              @click="isDark = !isDark"
              type="button"
              role="switch"
              :aria-checked="isDark"
              class="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ml-4"
              :class="isDark ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span
                class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="isDark ? 'translate-x-5' : 'translate-x-0'"
              >
                <span class="absolute inset-0 flex items-center justify-center">
                  <UIcon 
                    :name="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'" 
                    class="h-4 w-4"
                    :class="isDark ? 'text-primary-600' : 'text-gray-400'"
                  />
                </span>
              </span>
            </button>
          </div>
        </div>
      </UCard>

      <!-- Change Password -->
      <UCard>
        <template #header>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ showTempPasswordAlert ? 'Set New Password' : 'Change Password' }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ showTempPasswordAlert 
                ? 'Set a permanent password to secure your account' 
                : 'Update your password to keep your account secure' 
              }}
            </p>
          </div>
        </template>

        <form @submit.prevent="handleChangePassword" class="space-y-5">
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              size="xl"
              :disabled="loading"
              class="w-full"
              icon="i-heroicons-lock-closed"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your new password"
              size="xl"
              :disabled="loading"
              class="w-full"
              icon="i-heroicons-lock-closed"
            />
          </div>

          <UButton
            type="submit"
            size="xl"
            :loading="loading"
            :disabled="loading"
            class="justify-center font-semibold"
            :color="showTempPasswordAlert ? 'warning' : 'primary'"
          >
            <span v-if="!loading">{{ showTempPasswordAlert ? 'Set New Password' : 'Change Password' }}</span>
            <span v-else>{{ showTempPasswordAlert ? 'Setting Password...' : 'Changing Password...' }}</span>
          </UButton>
        </form>
      </UCard>

      <!-- Support Unfold -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Support Unfold</h2>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Unfold is built and maintained by a small indie developer. Server costs, AI API calls, and infrastructure add up. 
            If you find Unfold useful, consider buying me a coffee to help keep it running! ☕️
          </p>
          
          <div class="flex items-center justify-center pt-2">
            <BuyMeACoffee variant="button" size="lg" />
          </div>

          <div class="pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Made with ❤️ by Elliott
            </p>
          </div>
        </div>
      </UCard>

      <!-- Unpublish Confirmation Modal -->
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
            v-if="showUnpublishModal && itemToUnpublish"
            class="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <!-- Backdrop -->
            <div
              class="absolute inset-0 bg-black/50 backdrop-blur-sm"
              @click="cancelUnpublish"
            />
            
            <!-- Modal -->
            <Transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95 translate-y-4"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 translate-y-4"
            >
              <div
                v-if="showUnpublishModal"
                class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Unpublish {{ itemToUnpublish?.type === 'note' ? 'Note' : itemToUnpublish?.type === 'folder' ? 'Folder' : 'Space' }}
                  </h3>
                  <button
                    @click="cancelUnpublish"
                    class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    :disabled="isUnpublishing"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <!-- Warning Icon -->
                <div class="flex items-center gap-3 mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <p class="text-sm text-orange-800 dark:text-orange-200">
                    <template v-if="itemToUnpublish?.type === 'folder'">
                      This will make <strong>"{{ itemToUnpublish.item.name }}"</strong> and all its contents (notes and subfolders) no longer publicly accessible.
                    </template>
                    <template v-else-if="itemToUnpublish?.type === 'space'">
                      This will make <strong>"{{ itemToUnpublish.item.name }}"</strong> and all its contents (folders, notes, and subfolders) no longer publicly accessible.
                    </template>
                    <template v-else>
                      This will make <strong>"{{ itemToUnpublish?.item.title }}"</strong> no longer publicly accessible.
                    </template>
                  </p>
                </div>

                <!-- Description -->
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  <template v-if="itemToUnpublish?.type === 'folder'">
                    Anyone with the share link will no longer be able to view this folder or any of its contents. This action cannot be undone.
                  </template>
                  <template v-else-if="itemToUnpublish?.type === 'space'">
                    Anyone with the share link will no longer be able to view this space or any of its contents. This action cannot be undone.
                  </template>
                  <template v-else>
                    Anyone with the share link will no longer be able to view this note. This action cannot be undone.
                  </template>
                </p>

                <!-- Actions -->
                <div class="flex gap-3">
                  <UButton
                    color="neutral"
                    variant="soft"
                    block
                    @click="cancelUnpublish"
                    :disabled="isUnpublishing"
                  >
                    Cancel
                  </UButton>
                  <UButton
                    color="error"
                    variant="solid"
                    block
                    @click="confirmUnpublish"
                    :loading="isUnpublishing"
                  >
                    Unpublish
                  </UButton>
                </div>
              </div>
            </Transition>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

