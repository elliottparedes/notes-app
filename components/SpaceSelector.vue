<script setup lang="ts">
import { useSpacesStore } from '~/stores/spaces';
import { useFoldersStore } from '~/stores/folders';

const spacesStore = useSpacesStore();
const foldersStore = useFoldersStore();
const toast = useToast();

const isDropdownOpen = ref(false);
const showSpaceModal = ref(false);
const editingSpace = ref<{ id: number; name: string } | null>(null);
const showDeleteModal = ref(false);
const deletingSpace = ref<{ id: number; name: string } | null>(null);
const isDeleting = ref(false);

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.space-selector-container')) {
      isDropdownOpen.value = false;
    }
  };
  
  document.addEventListener('click', handleClickOutside);
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
});

async function handleSelectSpace(spaceId: number) {
  if (spacesStore.currentSpaceId === spaceId) {
    isDropdownOpen.value = false;
    return;
  }

  spacesStore.setCurrentSpace(spaceId);
  
  // Refetch folders for the new space
  await foldersStore.fetchFolders();
  
  isDropdownOpen.value = false;
}

function handleNewSpace() {
  editingSpace.value = null;
  showSpaceModal.value = true;
  isDropdownOpen.value = false;
}

function handleEditSpace(space: { id: number; name: string }, e: MouseEvent) {
  e.stopPropagation();
  editingSpace.value = space;
  showSpaceModal.value = true;
  isDropdownOpen.value = false;
}

function handleDeleteSpace(spaceId: number, e: MouseEvent) {
  e.stopPropagation();
  
  // Check if this is the last space
  if (spacesStore.spaces.length <= 1) {
    toast.add({
      title: 'Cannot Delete',
      description: 'You cannot delete the last remaining space',
      color: 'error'
    });
    return;
  }

  const space = spacesStore.spaces.find(s => s.id === spaceId);
  if (space) {
    deletingSpace.value = { id: space.id, name: space.name };
    showDeleteModal.value = true;
    isDropdownOpen.value = false;
  }
}

async function confirmDelete() {
  if (!deletingSpace.value) return;

  isDeleting.value = true;

  try {
    await spacesStore.deleteSpace(deletingSpace.value.id);
    
    // Refetch folders if we deleted the current space
    if (spacesStore.currentSpaceId) {
      await foldersStore.fetchFolders();
    }
    
    toast.add({
      title: 'Success',
      description: 'Space deleted successfully',
      color: 'success'
    });
    
    showDeleteModal.value = false;
    deletingSpace.value = null;
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || error.message || 'Failed to delete space. Please try again.',
      color: 'error'
    });
  } finally {
    isDeleting.value = false;
  }
}

function cancelDelete() {
  showDeleteModal.value = false;
  deletingSpace.value = null;
}

function handleSpaceCreated(space: any) {
  showSpaceModal.value = false;
  editingSpace.value = null;
}

function handleSpaceUpdated(space: any) {
  showSpaceModal.value = false;
  editingSpace.value = null;
}


const currentSpace = computed(() => spacesStore.currentSpace);
</script>

<template>
  <div class="space-selector-container relative mb-4">
    <!-- Space Selector Button -->
    <button
      @click="isDropdownOpen = !isDropdownOpen"
      class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left border border-gray-200 dark:border-gray-700"
      :class="isDropdownOpen ? 'bg-gray-100 dark:bg-gray-700/50 border-primary-300 dark:border-primary-700' : 'border-transparent'"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="relative">
          <UIcon 
            :name="currentSpace?.icon ? `i-lucide-${currentSpace.icon}` : 'i-heroicons-building-office-2'" 
            class="w-4 h-4 flex-shrink-0 text-primary-600 dark:text-primary-400" 
          />
          <!-- Current Space Indicator Dot -->
          <span 
            v-if="currentSpace"
            class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary-500 rounded-full border-2 border-white dark:border-gray-800"
            title="Current Space"
          ></span>
        </div>
        <span class="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">
          {{ currentSpace?.name || 'Select Space' }}
        </span>
      </div>
      <UIcon 
        name="i-heroicons-chevron-down" 
        class="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200"
        :class="isDropdownOpen ? 'rotate-180' : ''"
      />
    </button>

    <!-- Dropdown Menu -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-1"
    >
      <div
        v-if="isDropdownOpen"
        class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
      >
        <!-- Spaces List -->
        <div class="py-1">
          <div
            v-for="space in spacesStore.spaces"
            :key="space.id"
            class="group flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
            :class="space.id === spacesStore.currentSpaceId ? 'bg-primary-50 dark:bg-primary-900/20' : ''"
            @click="handleSelectSpace(space.id)"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <div class="relative">
                <UIcon 
                  :name="space.icon ? `i-lucide-${space.icon}` : 'i-heroicons-building-office-2'" 
                  class="w-4 h-4 flex-shrink-0"
                  :class="space.id === spacesStore.currentSpaceId ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'"
                />
                <!-- Checkmark for current space -->
                <div
                  v-if="space.id === spacesStore.currentSpaceId"
                  class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary-500 rounded-full flex items-center justify-center border border-white dark:border-gray-800"
                >
                  <UIcon name="i-heroicons-check" class="w-2 h-2 text-white" />
                </div>
              </div>
              <span 
                class="text-sm truncate flex-1"
                :class="space.id === spacesStore.currentSpaceId ? 'text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-700 dark:text-gray-300'"
              >
                {{ space.name }}
              </span>
            </div>
            
            <!-- Action Buttons (on hover) -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="handleEditSpace({ id: space.id, name: space.name }, $event)"
                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Edit space"
              >
                <UIcon name="i-heroicons-pencil" class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                v-if="spacesStore.spaces.length > 1"
                @click="handleDeleteSpace(space.id, $event)"
                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                title="Delete space"
              >
                <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>

        <!-- New Space Button -->
        <button
          @click="handleNewSpace"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span>New Space</span>
        </button>
      </div>
    </Transition>

    <!-- Space Modal -->
    <SpaceModal
      :is-open="showSpaceModal"
      :space="editingSpace ? spacesStore.spaces.find(s => s.id === editingSpace.id) || null : null"
      @update:is-open="showSpaceModal = $event"
      @created="handleSpaceCreated"
      @updated="handleSpaceUpdated"
    />

    <!-- Delete Confirmation Modal -->
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
            v-if="showDeleteModal" 
            class="fixed inset-0 z-[60] overflow-y-auto"
            @click.self="cancelDelete"
          >
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/60 transition-opacity"></div>
            
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
                  v-if="showDeleteModal"
                  class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-red-200 dark:border-red-900"
                  @click.stop
                >
                  <!-- Header -->
                  <div class="flex items-center gap-3 mb-4">
                    <div class="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div class="flex-1">
                      <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                        Delete Space
                      </h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        This action cannot be undone
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="cancelDelete"
                      class="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                      :disabled="isDeleting"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                    </button>
                  </div>
                  
                  <!-- Warning Content -->
                  <div class="mb-6">
                    <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                      <p class="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                        ⚠️ Warning: Permanent Data Loss
                      </p>
                      <ul class="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                        <li>All <strong>folders</strong> in this space will be permanently deleted</li>
                        <li>All <strong>notes</strong> in those folders will be permanently deleted</li>
                        <li>Any shared notes from this space will be removed</li>
                        <li>This action cannot be undone</li>
                      </ul>
                    </div>
                    
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                      Are you absolutely sure you want to delete <strong class="text-gray-900 dark:text-white">"{{ deletingSpace?.name }}"</strong>?
                    </p>
                  </div>

                  <!-- Action Buttons -->
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
                      <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-2" />
                      Delete Forever
                    </UButton>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

