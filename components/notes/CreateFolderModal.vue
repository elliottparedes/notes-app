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
          v-if="modelValue"
          class="fixed inset-0 z-50 overflow-y-auto"
          @click.self="$emit('update:modelValue', false)"
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
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                @click.stop
              >
                <h3 class="text-base font-semibold mb-3 text-gray-900 dark:text-white">Create New Section</h3>
                <input
                  v-model="folderName"
                  type="text"
                  placeholder="Section Name"
                  class="mb-3 w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  autofocus
                  @keyup.enter="handleCreate"
                />
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    @click="$emit('update:modelValue', false)"
                    class="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="handleCreate"
                    :disabled="isCreating"
                    class="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <UIcon
                      v-if="isCreating"
                      name="i-heroicons-arrow-path"
                      class="w-4 h-4 animate-spin"
                    />
                    <span>Create</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  targetSpaceId?: number
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'created'): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();
const toast = useToast();

const folderName = ref('');
const isCreating = ref(false);

async function handleCreate() {
  if (!folderName.value.trim() || isCreating.value) return;

  isCreating.value = true;
  try {
    await foldersStore.createFolder({
      name: folderName.value.trim(),
      space_id: props.targetSpaceId || spacesStore.currentSpaceId || undefined
    });
    toast.success('Folder created');
    emit('created');
    emit('update:modelValue', false);
    folderName.value = '';
  } catch (error) {
    toast.error('Failed to create folder');
  } finally {
    isCreating.value = false;
  }
}

// Reset folder name when modal opens
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    folderName.value = '';
  }
});
</script>
