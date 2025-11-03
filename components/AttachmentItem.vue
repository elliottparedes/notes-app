<script setup lang="ts">
import type { Attachment } from '~/models';
import { useToast } from '~/composables/useToast';

const props = defineProps<{
  attachment: Attachment;
  noteId: string;
}>();

const emit = defineEmits<{
  (e: 'deleted', attachmentId: number): void;
}>();

const toast = useToast();
const isDeleting = ref(false);
const isDownloading = ref(false);

// Get file icon based on mime type
const fileIcon = computed(() => {
  if (!props.attachment.mime_type) {
    return 'i-heroicons-document';
  }
  
  if (props.attachment.mime_type.startsWith('image/')) {
    return 'i-heroicons-photo';
  } else if (props.attachment.mime_type === 'application/pdf') {
    return 'i-heroicons-document-text';
  } else if (
    props.attachment.mime_type.includes('word') ||
    props.attachment.mime_type.includes('document')
  ) {
    return 'i-heroicons-document-duplicate';
  } else if (
    props.attachment.mime_type.includes('spreadsheet') ||
    props.attachment.mime_type.includes('excel')
  ) {
    return 'i-heroicons-table-cells';
  } else if (props.attachment.mime_type.includes('video')) {
    return 'i-heroicons-video-camera';
  } else if (props.attachment.mime_type.includes('audio')) {
    return 'i-heroicons-speaker-wave';
  } else {
    return 'i-heroicons-document';
  }
});

// Format file size
const fileSize = computed(() => {
  if (!props.attachment.file_size) return '';
  const bytes = props.attachment.file_size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

async function downloadFile() {
  if (isDownloading.value) return;
  
  try {
    isDownloading.value = true;
    const authStore = useAuthStore();
    
    if (!authStore.token) {
      toast.add({
        title: 'Error',
        description: 'Not authenticated',
        color: 'error',
      });
      return;
    }
    
    // Open download URL in new tab
    const url = `/api/notes/${props.noteId}/attachments/${props.attachment.id}`;
    window.open(url, '_blank');
  } catch (error: any) {
    console.error('Download error:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to download file',
      color: 'error',
    });
  } finally {
    isDownloading.value = false;
  }
}

async function deleteFile() {
  if (isDeleting.value) return;
  
  try {
    isDeleting.value = true;
    const authStore = useAuthStore();
    
    if (!authStore.token) {
      toast.add({
        title: 'Error',
        description: 'Not authenticated',
        color: 'error',
      });
      return;
    }
    
    await $fetch(`/api/notes/${props.noteId}/attachments/${props.attachment.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    
    emit('deleted', props.attachment.id);
    toast.add({
      title: 'Success',
      description: 'File deleted successfully',
      color: 'success',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete file',
      color: 'error',
    });
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div
    class="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
  >
    <!-- File Icon -->
    <div
      class="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
    >
      <UIcon :name="fileIcon" class="w-6 h-6 text-gray-600 dark:text-gray-300" />
    </div>
    
    <!-- File Info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
        {{ attachment.file_name }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ fileSize }}
      </p>
    </div>
    
    <!-- Actions -->
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <UButton
        icon="i-heroicons-arrow-down-tray"
        color="neutral"
        variant="ghost"
        size="xs"
        :loading="isDownloading"
        @click="downloadFile"
        title="Download"
      />
      <UButton
        icon="i-heroicons-trash"
        color="error"
        variant="ghost"
        size="xs"
        :loading="isDeleting"
        @click="deleteFile"
        title="Delete"
      />
    </div>
  </div>
</template>

