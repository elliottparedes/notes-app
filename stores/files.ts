import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { useToast } from '~/composables/useToast';

export interface FileItem {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  folder_path: string;
  download_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface FilesState {
  files: FileItem[];
  currentFolder: string;
  loading: boolean;
  error: string | null;
  storageUsed: number;
  storageQuota: number; // 500MB default
}

export const useFilesStore = defineStore('files', {
  state: (): FilesState => ({
    files: [],
    currentFolder: '/',
    loading: false,
    error: null,
    storageUsed: 0,
    storageQuota: 500 * 1024 * 1024, // 500MB
  }),

  getters: {
    storageUsedMB: (state): number => {
      return Math.round((state.storageUsed / 1024 / 1024) * 100) / 100;
    },
    storageQuotaMB: (state): number => {
      return Math.round((state.storageQuota / 1024 / 1024) * 100) / 100;
    },
    storagePercentage: (state): number => {
      return Math.round((state.storageUsed / state.storageQuota) * 100);
    },
    filesInCurrentFolder: (state): FileItem[] => {
      return state.files.filter(file => file.folder_path === state.currentFolder);
    },
  },

  actions: {
    async fetchFiles(folderPath: string = '/') {
      const authStore = useAuthStore();
      if (!authStore.token) {
        this.error = 'Not authenticated';
        return;
      }

      this.loading = true;
      this.error = null;
      this.currentFolder = folderPath;

      try {
        const response = await $fetch<{ files: FileItem[] }>(`/api/files?folder=${encodeURIComponent(folderPath)}`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        this.files = response.files.map(file => ({
          ...file,
          created_at: new Date(file.created_at),
          updated_at: new Date(file.updated_at),
        }));

        // Fetch user storage info
        await this.fetchStorageInfo();
      } catch (error: any) {
        console.error('Failed to fetch files:', error);
        this.error = error.data?.message || 'Failed to fetch files';
        const toast = useToast();
        toast.error(this.error);
      } finally {
        this.loading = false;
      }
    },

    async uploadFile(file: File, folderPath: string = '/') {
      const authStore = useAuthStore();
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      // Check quota before upload
      if (this.storageUsed + file.size > this.storageQuota) {
        throw new Error('Storage quota exceeded');
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await $fetch<{ files: FileItem[] }>('/api/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: formData,
        });

        // Refresh files list
        await this.fetchFiles(folderPath);
        
        const toast = useToast();
        toast.success(`File "${file.name}" uploaded successfully`);
        
        return response.files[0];
      } catch (error: any) {
        console.error('Failed to upload file:', error);
        const toast = useToast();
        toast.error(error.data?.message || 'Failed to upload file');
        throw error;
      }
    },

    async deleteFile(fileId: string) {
      const authStore = useAuthStore();
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      const file = this.files.find(f => f.id === fileId);
      if (!file) {
        throw new Error('File not found');
      }

      try {
        await $fetch(`/api/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        // Remove from local state
        this.files = this.files.filter(f => f.id !== fileId);
        
        // Update storage
        this.storageUsed = Math.max(0, this.storageUsed - file.file_size);
        
        const toast = useToast();
        toast.success('File deleted successfully');
      } catch (error: any) {
        console.error('Failed to delete file:', error);
        const toast = useToast();
        toast.error(error.data?.message || 'Failed to delete file');
        throw error;
      }
    },

    async downloadFile(fileId: string) {
      const authStore = useAuthStore();
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      try {
        // Fetch the presigned URL with authentication
        const response = await $fetch<{ downloadUrl: string; fileName: string }>(`/api/files/download/${fileId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        // Fetch the file as a blob to ensure it downloads instead of opening
        const fileResponse = await fetch(response.downloadUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
        }
        
        const blob = await fileResponse.blob();
        
        // Create a blob URL and trigger download
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = response.fileName; // Set the filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL after a short delay
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } catch (error: any) {
        console.error('Failed to download file:', error);
        const toast = useToast();
        toast.error(error.data?.message || 'Failed to download file');
        throw error;
      }
    },

    async fetchStorageInfo() {
      const authStore = useAuthStore();
      if (!authStore.token) {
        return;
      }

      try {
        // Fetch user info to get storage_used
        const user = await $fetch<{ storage_used: number }>('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        if (user && typeof user.storage_used === 'number') {
          this.storageUsed = user.storage_used;
        }
      } catch (error) {
        console.error('Failed to fetch storage info:', error);
      }
    },

    async syncStorage() {
      const authStore = useAuthStore();
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await $fetch<{ storage_used: number; storage_used_mb: number }>('/api/files/sync-storage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        this.storageUsed = response.storage_used;
        return response;
      } catch (error: any) {
        console.error('Failed to sync storage:', error);
        const toast = useToast();
        toast.error('Failed to sync storage');
        throw error;
      }
    },

    navigateToFolder(folderPath: string) {
      this.currentFolder = folderPath;
      this.fetchFiles(folderPath);
    },

    async deleteFolder(folderPath: string) {
      const authStore = useAuthStore();
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await $fetch<{ deleted_count: number; total_count: number }>(
          `/api/files/folders/${encodeURIComponent(folderPath)}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${authStore.token}`,
            },
          }
        );

        // Refresh storage and files
        await this.syncStorage();
        await this.fetchFiles(this.currentFolder);
        
        const toast = useToast();
        toast.success(`Folder deleted (${response.deleted_count} files)`);
        
        return response;
      } catch (error: any) {
        console.error('Failed to delete folder:', error);
        const toast = useToast();
        toast.error(error.data?.message || 'Failed to delete folder');
        throw error;
      }
    },
  },
});

