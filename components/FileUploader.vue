<script setup lang="ts">
import type { Attachment } from '~/models';
import { useToast } from '~/composables/useToast';

const props = defineProps<{
  noteId: string;
  accept?: string;
  maxSize?: number; // in bytes
}>();

const emit = defineEmits<{
  (e: 'uploaded', attachment: Attachment): void;
  (e: 'error', error: string): void;
}>();

const toast = useToast();
const fileInputRef = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const isDragOver = ref(false);

// Storage quota
const storageQuota = ref<{
  used: number;
  limit: number;
  usedMB: string;
  limitMB: string;
  usedPercent: number;
} | null>(null);

onMounted(() => {
  loadStorageQuota();
});

async function loadStorageQuota() {
  try {
    const authStore = useAuthStore();
    if (!authStore.token) return;
    
    const quota = await $fetch<{
      used: number;
      limit: number;
      usedMB: string;
      limitMB: string;
      usedPercent: number;
    }>('/api/user/storage', {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    
    storageQuota.value = quota;
  } catch (error) {
    console.error('Failed to load storage quota:', error);
  }
}

function openFileDialog() {
  fileInputRef.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files || files.length === 0) return;
  
  await uploadFiles(Array.from(files));
  
  // Reset input
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

async function uploadFiles(files: File[]) {
  if (isUploading.value) return;
  
  const authStore = useAuthStore();
  if (!authStore.token) {
    toast.add({
      title: 'Error',
      description: 'Not authenticated',
      color: 'error',
    });
    return;
  }
  
  // Validate files
  for (const file of files) {
    if (props.maxSize && file.size > props.maxSize) {
      const maxMB = (props.maxSize / (1024 * 1024)).toFixed(0);
      toast.add({
        title: 'File Too Large',
        description: `${file.name} exceeds ${maxMB}MB limit`,
        color: 'error',
      });
      emit('error', `File ${file.name} exceeds size limit`);
      return;
    }
  }
  
  isUploading.value = true;
  uploadProgress.value = 0;
  
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      // Create XMLHttpRequest for progress tracking
      const attachment = await new Promise<Attachment>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            uploadProgress.value = Math.round((e.loaded / e.total) * 100);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(xhr.responseText || 'Upload failed'));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });
        
        xhr.open('POST', `/api/notes/${props.noteId}/attachments`);
        xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`);
        xhr.send(formData);
      });
      
      emit('uploaded', attachment);
      toast.add({
        title: 'File Uploaded',
        description: `${file.name} uploaded successfully`,
        color: 'success',
      });
    }
    
    // Reload storage quota
    await loadStorageQuota();
  } catch (error: any) {
    console.error('Upload error:', error);
    const errorMessage = error.message || 'Failed to upload file';
    toast.add({
      title: 'Upload Failed',
      description: errorMessage,
      color: 'error',
    });
    emit('error', errorMessage);
  } finally {
    isUploading.value = false;
    uploadProgress.value = 0;
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = true;
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;
  
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    uploadFiles(Array.from(files));
  }
}
</script>

<template>
  <div>
    <!-- Upload Button -->
    <UButton
      icon="i-heroicons-paper-clip"
      color="primary"
      variant="soft"
      size="sm"
      :loading="isUploading"
      @click="openFileDialog"
      class="file-upload-button"
    >
      <span class="hidden sm:inline">Upload</span>
    </UButton>
    
    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      :accept="accept"
      multiple
      @change="handleFileSelect"
    />
    
    <!-- Storage Quota Display -->
    <div v-if="storageQuota" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      <div class="flex items-center justify-between mb-1">
        <span>Storage: {{ storageQuota.usedMB }}MB / {{ storageQuota.limitMB }}MB</span>
        <span>{{ storageQuota.usedPercent.toFixed(1) }}%</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          class="h-1.5 rounded-full transition-all"
          :class="
            storageQuota.usedPercent > 90
              ? 'bg-red-500'
              : storageQuota.usedPercent > 75
              ? 'bg-yellow-500'
              : 'bg-primary-500'
          "
          :style="{ width: `${Math.min(storageQuota.usedPercent, 100)}%` }"
        ></div>
      </div>
    </div>
    
    <!-- Upload Progress -->
    <div v-if="isUploading" class="mt-2">
      <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
        <span>Uploading...</span>
        <span>{{ uploadProgress }}%</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          class="h-1.5 rounded-full bg-primary-500 transition-all"
          :style="{ width: `${uploadProgress}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-upload-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: all 0.2s ease;
}

.file-upload-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}
</style>

