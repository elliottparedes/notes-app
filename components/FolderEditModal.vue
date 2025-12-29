<script setup lang="ts">
import type { Folder } from '~/models';

const props = defineProps<{
  modelValue: boolean;
  folder: Section;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const foldersStore = useFoldersStore();
const name = ref(props.folder.name);
const icon = ref(props.folder.icon || 'folder');
const loading = ref(false);

watch(() => props.folder, (newFolder) => {
  if (newFolder) {
    name.value = newFolder.name;
    icon.value = newFolder.icon || 'folder';
  }
}, { immediate: true });

async function save() {
  if (!name.value.trim()) return;

  loading.value = true;
  try {
    await foldersStore.updateFolder(props.folder.id, {
      name: name.value,
      icon: icon.value
    });
    emit('saved');
    emit('update:modelValue', false);
  } catch (error) {
    console.error('Failed to update folder:', error);
  } finally {
    loading.value = false;
  }
}

function closeModal() {
  emit('update:modelValue', false);
}
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
          v-if="modelValue" 
          class="fixed inset-0 z-[60] overflow-y-auto"
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
                v-if="modelValue"
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    Edit Section
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
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                      Section Name
                    </label>
                    <input
                      v-model="name"
                      type="text"
                      placeholder="Section name"
                      autofocus
                      class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                      @keyup.enter="save"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                      Icon
                    </label>
                    <IconPicker v-model="icon" allow-upload />
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2 pt-4">
                  <button
                    type="button"
                    @click="closeModal"
                    :disabled="loading"
                    class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="save"
                    :disabled="loading"
                    class="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <UIcon 
                      v-if="loading" 
                      name="i-heroicons-arrow-path" 
                      class="w-4 h-4 animate-spin" 
                    />
                    <span>Save</span>
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
