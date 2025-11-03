<script setup lang="ts">
import type { Space, CreateSpaceDto, UpdateSpaceDto } from '~/models';
import { useSpacesStore } from '~/stores/spaces';

const props = defineProps<{
  isOpen: boolean;
  space?: Space | null;
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'created', space: Space): void;
  (e: 'updated', space: Space): void;
}>();

const spacesStore = useSpacesStore();
const toast = useToast();
const authStore = useAuthStore();

const spaceName = ref('');
const spaceIcon = ref<string | null>(null);
const loading = ref(false);
const isPublishing = ref(false);
const publishStatus = ref<{ is_published: boolean; share_url?: string } | null>(null);
const showPublishModal = ref(false);
const showUnpublishModal = ref(false);

// Reset form when modal opens/closes or space changes
watch([() => props.isOpen, () => props.space?.id], async ([isOpen, spaceId], [oldIsOpen, oldSpaceId]) => {
  // Only reset when modal opens or space actually changes (by ID)
  if (isOpen && (isOpen !== oldIsOpen || spaceId !== oldSpaceId)) {
    if (props.space) {
      spaceName.value = props.space.name;
      // Only update icon if space changed or we're opening the modal
      if (spaceId !== oldSpaceId || !oldIsOpen) {
        spaceIcon.value = props.space.icon;
      }
      // Check publish status
      checkPublishStatus();
    } else {
      spaceName.value = '';
      spaceIcon.value = null;
      publishStatus.value = null;
    }
  }
}, { immediate: true });

// Check publish status
async function checkPublishStatus() {
  if (!props.space || !authStore.token) return;
  
  try {
    const status = await $fetch<{ is_published: boolean; share_url?: string }>(`/api/spaces/${props.space.id}/publish-status`, {
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

// Publish space
async function publishSpace() {
  if (!props.space || isPublishing.value || !authStore.token) return;
  
  try {
    isPublishing.value = true;
    
    const response = await $fetch<{ share_id: string; share_url: string }>(`/api/spaces/${props.space.id}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    publishStatus.value = { is_published: true, share_url: response.share_url };
    showPublishModal.value = true;
    toast.add({
      title: 'Space Published',
      description: 'All folders and notes in this space are now publicly accessible',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Error publishing space:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to publish space',
      color: 'error'
    });
  } finally {
    isPublishing.value = false;
  }
}

// Unpublish space - show confirmation modal
function unpublishSpace() {
  if (!props.space) return;
  showUnpublishModal.value = true;
}

// Confirm unpublish space
async function confirmUnpublishSpace() {
  if (!props.space || isPublishing.value || !authStore.token) return;
  
  try {
    isPublishing.value = true;
    
    await $fetch(`/api/spaces/${props.space.id}/unpublish`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    publishStatus.value = { is_published: false };
    showPublishModal.value = false;
    showUnpublishModal.value = false;
    
    toast.add({
      title: 'Space Unpublished',
      description: 'This space and all its contents are no longer publicly accessible',
      color: 'success'
    });
  } catch (error: any) {
    console.error('Error unpublishing space:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to unpublish space',
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

function closeModal() {
  emit('update:isOpen', false);
  // Reset form after closing (only if creating new space, not editing)
  if (!props.space) {
    setTimeout(() => {
      spaceName.value = '';
      spaceIcon.value = null;
    }, 300);
  }
}

async function handleSubmit() {
  if (!spaceName.value.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter a space name',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    if (props.space) {
      // Update existing space - always include icon to prevent it from being reset
      const updateData: UpdateSpaceDto = {
        name: spaceName.value.trim()
      };
      
      // Explicitly include icon (even if null) to preserve user's choice
      if (spaceIcon.value !== undefined) {
        updateData.icon = spaceIcon.value;
      }
      
      const updatedSpace = await spacesStore.updateSpace(props.space.id, updateData);
      
      toast.add({
        title: 'Success',
        description: 'Space updated successfully',
        color: 'success'
      });
      
      emit('updated', updatedSpace);
    } else {
      // Create new space
      const newSpace = await spacesStore.createSpace({
        name: spaceName.value.trim(),
        icon: spaceIcon.value || null
      });
      
      toast.add({
        title: 'Success',
        description: 'Space created successfully',
        color: 'success'
      });
      
      emit('created', newSpace);
    }
    
    closeModal();
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || error.message || 'Failed to save space. Please try again.',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

// Handle Escape key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen) {
      closeModal();
    }
  };
  document.addEventListener('keydown', handleEscape);
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleEscape);
  });
});
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
          <div class="flex min-h-full items-center justify-center p-4">
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
                class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                    {{ space ? 'Edit Space' : 'New Space' }}
                  </h3>
                  <button
                    type="button"
                    @click="closeModal"
                    class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                  </button>
                </div>
                
                <!-- Content -->
                <form @submit.prevent="handleSubmit" class="space-y-4">
                  <!-- Icon Selection -->
                  <IconPicker
                    v-model="spaceIcon"
                    search-placeholder="Search icons..."
                  />

                  <!-- Space Name -->
                  <div>
                    <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      Space Name
                    </label>
                    <input
                      v-model="spaceName"
                      type="text"
                      placeholder="Enter space name"
                      required
                      autofocus
                      class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      :disabled="loading"
                    />
                  </div>

                  <!-- Publish Section (only for existing spaces) -->
                  <div v-if="space" class="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-between mb-3">
                      <div>
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">Publishing</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          Make this space and all its contents publicly accessible
                        </p>
                      </div>
                      <UButton
                        v-if="!publishStatus?.is_published"
                        color="neutral"
                        variant="soft"
                        icon="i-heroicons-link"
                        :loading="isPublishing"
                        @click="publishSpace()"
                      >
                        Publish
                      </UButton>
                      <UButton
                        v-else
                        color="error"
                        variant="solid"
                        icon="i-heroicons-x-circle"
                        :loading="isPublishing"
                        @click="unpublishSpace()"
                      >
                        Unpublish
                      </UButton>
                    </div>
                    <div v-if="publishStatus?.is_published && publishStatus.share_url" class="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <p class="text-xs font-medium text-primary-900 dark:text-primary-100 mb-2">Share Link</p>
                      <div class="flex gap-2">
                        <input
                          :value="publishStatus.share_url"
                          readonly
                          class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-800 rounded text-xs text-gray-900 dark:text-white"
                        />
                        <UButton
                          icon="i-heroicons-clipboard-document"
                          size="xs"
                          @click="copyShareUrl"
                        >
                          Copy
                        </UButton>
                      </div>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-3 pt-4">
                    <UButton
                      color="neutral"
                      variant="soft"
                      block
                      @click="closeModal"
                      :disabled="loading"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      color="primary"
                      block
                      type="submit"
                      :loading="loading"
                    >
                      {{ space ? 'Update' : 'Create' }}
                    </UButton>
                  </div>
                </form>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Unpublish Space Confirmation Modal -->
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
            v-if="showUnpublishModal && space"
            class="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <!-- Backdrop -->
            <div
              class="absolute inset-0 bg-black/50 backdrop-blur-sm"
              @click="showUnpublishModal = false"
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
                    Unpublish Space
                  </h3>
                  <button
                    @click="showUnpublishModal = false"
                    class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <!-- Warning Icon -->
                <div class="flex items-center gap-3 mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <p class="text-sm text-orange-800 dark:text-orange-200">
                    This will make <strong>"{{ space?.name }}"</strong> and all its contents (folders, notes, and subfolders) no longer publicly accessible.
                  </p>
                </div>

                <!-- Description -->
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Anyone with the share link will no longer be able to view this space or any of its contents. This action cannot be undone.
                </p>

                <!-- Actions -->
                <div class="flex gap-3">
                  <UButton
                    color="neutral"
                    variant="soft"
                    block
                    @click="showUnpublishModal = false"
                    :disabled="isPublishing"
                  >
                    Cancel
                  </UButton>
                  <UButton
                    color="error"
                    variant="solid"
                    block
                    @click="confirmUnpublishSpace"
                    :loading="isPublishing"
                  >
                    Unpublish Space
                  </UButton>
                </div>
              </div>
            </Transition>
          </div>
        </Transition>
      </Teleport>
    </Teleport>
  </ClientOnly>
</template>

