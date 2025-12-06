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
    </Teleport>
  </ClientOnly>
</template>

