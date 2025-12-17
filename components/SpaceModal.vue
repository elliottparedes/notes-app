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
    } else {
      spaceName.value = '';
      spaceIcon.value = null;
    }
  }
}, { immediate: true });


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
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ space ? 'Edit Space' : 'New Space' }}
                  </h3>
                  <button
                    type="button"
                    @click="closeModal"
                    class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                  </button>
                </div>
                
                <!-- Content -->
                <form @submit.prevent="handleSubmit" class="space-y-3">
                  <!-- Icon Selection -->
                  <IconPicker
                    v-model="spaceIcon"
                    search-placeholder="Search icons..."
                    allow-upload
                  />

                  <!-- Space Name -->
                  <div>
                    <label class="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                      Space Name
                    </label>
                    <input
                      v-model="spaceName"
                      type="text"
                      placeholder="Enter space name"
                      required
                      autofocus
                      class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                      :disabled="loading"
                    />
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-2 pt-2">
                    <button
                      type="button"
                      @click="closeModal"
                      :disabled="loading"
                      class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      :disabled="loading"
                      class="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <UIcon 
                        v-if="loading" 
                        name="i-heroicons-arrow-path" 
                        class="w-4 h-4 animate-spin" 
                      />
                      <span>{{ space ? 'Update' : 'Create' }}</span>
                    </button>
                  </div>
                </form>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

