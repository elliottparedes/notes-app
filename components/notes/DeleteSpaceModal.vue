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
          @click.self="$emit('cancel')"
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
                v-if="modelValue"
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center gap-3 mb-3">
                  <div class="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div class="flex-1">
                    <h3 class="text-base font-bold text-gray-900 dark:text-white">
                      Delete Space
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      This action cannot be undone
                    </p>
                  </div>
                  <button
                    type="button"
                    @click="$emit('cancel')"
                    class="flex-shrink-0 text-gray-400 md:hover:text-gray-500 md:dark:hover:text-gray-300 active:text-gray-500 dark:active:text-gray-300 transition-colors"
                    :disabled="isDeleting"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                  </button>
                </div>

                <!-- Warning Content -->
                <div class="mb-4">
                  <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3 mb-3">
                    <p class="text-xs font-medium text-red-800 dark:text-red-300 mb-1.5">
                      ⚠️ Warning: Permanent Data Loss
                    </p>
                    <ul class="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                      <li>All <strong>folders</strong> in this space will be permanently deleted</li>
                      <li>All <strong>notes</strong> in those folders will be permanently deleted</li>
                      <li>Any shared notes from this space will be removed</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>

                  <p class="text-xs text-gray-700 dark:text-gray-300">
                    Are you absolutely sure you want to delete <strong class="text-gray-900 dark:text-white">"{{ spaceName }}"</strong>?
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="$emit('cancel')"
                    :disabled="isDeleting"
                    class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="$emit('confirm')"
                    :disabled="isDeleting"
                    class="flex-1 px-3 py-2 bg-red-600 dark:bg-red-500 text-white text-sm font-normal border border-red-700 dark:border-red-600 hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800 dark:active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <UIcon
                      v-if="isDeleting"
                      name="i-heroicons-arrow-path"
                      class="w-4 h-4 animate-spin"
                    />
                    <UIcon
                      v-else
                      name="i-heroicons-trash"
                      class="w-4 h-4"
                    />
                    <span>Delete Forever</span>
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
  spaceId: number | null
  isDeleting?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  isDeleting: false
});

const emit = defineEmits<Emits>();

const spacesStore = useSpacesStore();

const spaceName = computed(() => {
  if (!props.spaceId) return '';
  return spacesStore.spaces.find(s => s.id === props.spaceId)?.name || '';
});
</script>
