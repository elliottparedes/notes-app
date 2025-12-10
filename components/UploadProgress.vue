<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="uploads.length > 0"
      class="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-arrow-up-tray" class="w-5 h-5 text-primary-500 animate-pulse" />
          <h3 class="font-semibold text-sm text-gray-900 dark:text-white">
            Uploading {{ uploads.length }} {{ uploads.length === 1 ? 'file' : 'files' }}
          </h3>
        </div>
        <button
          @click="$emit('close')"
          class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
        </button>
      </div>

      <!-- Upload List -->
      <div class="max-h-96 overflow-y-auto">
        <div
          v-for="(upload, index) in uploads"
          :key="upload.id"
          class="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
          :class="{ 'bg-gray-50 dark:bg-gray-700/30': upload.status === 'uploading' }"
        >
          <!-- File Name -->
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ upload.fileName }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ formatFileSize(upload.fileSize) }}
              </p>
            </div>
            <div class="flex-shrink-0">
              <UIcon
                v-if="upload.status === 'uploading'"
                name="i-heroicons-arrow-path"
                class="w-4 h-4 text-primary-500 animate-spin"
              />
              <UIcon
                v-else-if="upload.status === 'success'"
                name="i-heroicons-check-circle"
                class="w-4 h-4 text-green-500"
              />
              <UIcon
                v-else-if="upload.status === 'error'"
                name="i-heroicons-x-circle"
                class="w-4 h-4 text-red-500"
              />
            </div>
          </div>

          <!-- Progress Bar -->
          <div v-if="upload.status === 'uploading'" class="mt-2">
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                class="h-full bg-primary-500 transition-all duration-300 ease-out rounded-full"
                :style="{ width: `${upload.progress}%` }"
              ></div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ upload.progress }}%
            </p>
          </div>

          <!-- Error Message -->
          <p v-if="upload.status === 'error' && upload.error" class="text-xs text-red-600 dark:text-red-400 mt-1">
            {{ upload.error }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div v-if="allComplete" class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="$emit('close')"
          class="w-full text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Close
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface UploadProgress {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const props = defineProps<{
  uploads: UploadProgress[];
}>();

defineEmits<{
  close: [];
}>();

const allComplete = computed(() => {
  return props.uploads.every(u => u.status === 'success' || u.status === 'error');
});

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
</script>

