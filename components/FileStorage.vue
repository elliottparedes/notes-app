<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import { useFilesStore, type FileItem } from '~/stores/files';
import { useAuthStore } from '~/stores/auth';
import { useToast } from '~/composables/useToast';

const filesStore = useFilesStore();
const authStore = useAuthStore();
const toast = useToast();

// Get view switching functions from parent
const viewSwitcher = inject<{ switchToNotebooks: () => void; switchToStorage: () => void } | null>('switchView', null);

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const selectedFiles = ref<Set<string>>(new Set());
const selectedFolders = ref<Set<string>>(new Set());
const lastSelectedFileIndex = ref<number | null>(null);
const isShiftPressed = ref(false);
const showCreateFolderModal = ref(false);
const newFolderName = ref('');
const folders = ref<Array<{ path: string; name: string }>>([]);
const foldersLoading = ref(false);
const folderContextMenu = ref<{ path: string; name: string } | null>(null);
const folderMenuPosition = ref({ x: 0, y: 0 });
const showViewDropdown = ref(false);
const viewMode = ref<'grid' | 'list'>('grid');
const showDeleteFolderModal = ref(false);
const folderToDelete = ref<{ path: string; name: string; fileCount: number } | null>(null);
const fileContextMenu = ref<{ id: string; name: string } | null>(null);
const fileMenuPosition = ref({ x: 0, y: 0 });
const showDeleteFilesModal = ref(false);
const filesToDelete = ref<string[]>([]);
const foldersToDelete = ref<string[]>([]);

// Drag selection state
const isSelecting = ref(false);
const selectionStart = ref<{ x: number; y: number } | null>(null);
const selectionEnd = ref<{ x: number; y: number } | null>(null);
const contentAreaRef = ref<HTMLElement | null>(null);

// Upload progress tracking
interface UploadProgress {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}
const uploadProgress = ref<UploadProgress[]>([]);

// Breadcrumb navigation
const breadcrumbs = computed(() => {
  const crumbs: Array<{ path: string; name: string }> = [{ path: '/', name: 'Storage' }];
  
  if (filesStore.currentFolder !== '/') {
    const parts = filesStore.currentFolder.split('/').filter(Boolean);
    let currentPath = '';
    parts.forEach((part) => {
      currentPath += '/' + part;
      crumbs.push({ path: currentPath, name: part });
    });
  }
  
  return crumbs;
});

// Get parent folder path for back button
const parentFolderPath = computed(() => {
  if (filesStore.currentFolder === '/') return null;
  
  const parts = filesStore.currentFolder.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  
  // Remove the last part to get parent path
  return '/' + parts.slice(0, -1).join('/');
});

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get file icon
function getFileIcon(file: FileItem): string {
  if (!file.mime_type) return 'i-heroicons-document';
  if (file.mime_type.startsWith('image/')) return 'i-heroicons-photo';
  if (file.mime_type.startsWith('video/')) return 'i-heroicons-video-camera';
  if (file.mime_type.includes('pdf')) return 'i-heroicons-document-text';
  return 'i-heroicons-document';
}

// Upload files with progress tracking
async function uploadFiles(files: File[]) {
  if (files.length === 0) return;
  
  // Initialize upload progress for all files - use reactive array
  const uploads: UploadProgress[] = files.map(file => ({
    id: `${Date.now()}-${Math.random()}`,
    fileName: file.name,
    fileSize: file.size,
    progress: 0,
    status: 'uploading' as const,
  }));
  
  uploadProgress.value = uploads;
  
  // Check total quota for all files
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (filesStore.storageUsed + totalSize > filesStore.storageQuota) {
    uploadProgress.value = uploads.map(upload => ({
      ...upload,
      status: 'error' as const,
      error: 'Storage quota exceeded'
    }));
    return;
  }
  
  // Upload each file with progress tracking (in parallel for better UX)
  const uploadPromises = files.map(async (file, index) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Include current folder path
      formData.append('folder_path', filesStore.currentFolder);

      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastProgress = 0;
        let progressInterval: ReturnType<typeof setInterval> | null = null;
        
        // Set initial progress to show something is happening
        const initial = uploadProgress.value[index]!;
        uploadProgress.value[index] = {
          id: initial.id,
          fileName: initial.fileName,
          fileSize: initial.fileSize,
          progress: 1,
          status: initial.status
        };
        
        // For very fast uploads, simulate progress if no events fire
        const startTime = Date.now();
        progressInterval = setInterval(() => {
          // If upload is still in progress and no progress events have fired in 100ms
          // gradually increase progress to show activity
          if (uploadProgress.value[index]?.status === 'uploading' && lastProgress < 90) {
            const elapsed = Date.now() - startTime;
            // After 200ms, start showing simulated progress if real progress hasn't updated
            if (elapsed > 200 && lastProgress < 10) {
              const simulatedProgress = Math.min(10, Math.floor(elapsed / 50));
              if (simulatedProgress > lastProgress) {
                lastProgress = simulatedProgress;
                const current = uploadProgress.value[index]!;
                uploadProgress.value[index] = {
                  id: current.id,
                  fileName: current.fileName,
                  fileSize: current.fileSize,
                  progress: simulatedProgress,
                  status: current.status
                };
              }
            }
          }
        }, 50);
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percentComplete = Math.max(1, Math.round((e.loaded / e.total) * 100));
            // Only update if progress actually changed (avoid unnecessary re-renders)
            if (percentComplete !== lastProgress) {
              lastProgress = percentComplete;
              // Clear interval once real progress starts
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
              }
              // Update the specific upload in the reactive array
              const current = uploadProgress.value[index]!;
              uploadProgress.value[index] = {
                id: current.id,
                fileName: current.fileName,
                fileSize: current.fileSize,
                progress: percentComplete,
                status: current.status
              };
            }
          }
        });
        
        xhr.addEventListener('loadstart', () => {
          // Ensure we show at least 1% when upload starts
          const current = uploadProgress.value[index]!;
          uploadProgress.value[index] = {
            id: current.id,
            fileName: current.fileName,
            fileSize: current.fileSize,
            progress: 1,
            status: current.status
          };
        });
        
        xhr.addEventListener('load', async () => {
          // Clear progress interval
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            const current = uploadProgress.value[index]!;
            uploadProgress.value[index] = {
              id: current.id,
              fileName: current.fileName,
              fileSize: current.fileSize,
              progress: 100,
              status: 'success' as const
            };
            
            // Refresh files list immediately after this file uploads successfully
            // This allows files to appear in the UI as they complete
            try {
              await filesStore.fetchFiles(filesStore.currentFolder);
              await filesStore.syncStorage();
            } catch (error) {
              console.error('Failed to refresh files after upload:', error);
            }
            
            resolve();
          } else {
            let errorMessage = 'Upload failed';
            try {
              const error = JSON.parse(xhr.responseText || '{}');
              errorMessage = error.message || errorMessage;
            } catch {
              errorMessage = `Server error: ${xhr.status}`;
            }
            const current = uploadProgress.value[index]!;
            uploadProgress.value[index] = {
              id: current.id,
              fileName: current.fileName,
              fileSize: current.fileSize,
              progress: current.progress,
              status: 'error' as const,
              error: errorMessage
            };
            reject(new Error(errorMessage));
          }
        });
        
        xhr.addEventListener('error', () => {
          // Clear progress interval
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          
          const current = uploadProgress.value[index]!;
          uploadProgress.value[index] = {
            id: current.id,
            fileName: current.fileName,
            fileSize: current.fileSize,
            progress: current.progress,
            status: 'error' as const,
            error: 'Network error'
          };
          reject(new Error('Network error'));
        });
        
        xhr.addEventListener('abort', () => {
          // Clear progress interval
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          
          const current = uploadProgress.value[index]!;
          uploadProgress.value[index] = {
            id: current.id,
            fileName: current.fileName,
            fileSize: current.fileSize,
            progress: current.progress,
            status: 'error' as const,
            error: 'Upload cancelled'
          };
          reject(new Error('Upload cancelled'));
        });
        
        xhr.open('POST', '/api/files');
        xhr.setRequestHeader('Authorization', `Bearer ${authStore.token}`);
        xhr.send(formData);
      });
      
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      const current = uploadProgress.value[index]!;
      uploadProgress.value[index] = {
        id: current.id,
        fileName: current.fileName,
        fileSize: current.fileSize,
        progress: current.progress,
        status: 'error' as const,
        error: error.message || 'Failed to upload file'
      };
    }
  });
  
  // Wait for all uploads to complete
  // Note: Files are already being refreshed individually as they complete
  await Promise.allSettled(uploadPromises);
  
  // Final refresh to ensure everything is up to date (in case of any race conditions)
  await filesStore.fetchFiles(filesStore.currentFolder);
  await filesStore.syncStorage();
  
  // Clear selection
  selectedFiles.value.clear();
  
  // Auto-close progress after 3 seconds if all successful
  const allSuccessful = uploadProgress.value.every(u => u.status === 'success');
  if (allSuccessful) {
    setTimeout(() => {
      uploadProgress.value = [];
    }, 3000);
  }
}

function closeUploadProgress() {
  uploadProgress.value = [];
}

function handleFileSelect() {
  const input = fileInputRef.value;
  if (!input || !input.files) return;
  uploadFiles(Array.from(input.files));
  input.value = '';
}

// Drag and drop
let dragCounter = 0;

function handleDragEnter(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragCounter++;
  if (event.dataTransfer?.types.includes('Files')) {
    isDragging.value = true;
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragCounter--;
  // Only hide drag state when we've left the entire dropzone
  if (dragCounter === 0) {
    isDragging.value = false;
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragCounter = 0;
  isDragging.value = false;
  
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    // Filter out directories (they have no size and webkitRelativePath)
    const fileArray = Array.from(files).filter(file => file.size > 0);
    if (fileArray.length > 0) {
      uploadFiles(fileArray);
    } else {
      toast.warning('Folders cannot be uploaded directly. Please upload individual files.');
    }
  }
}

// Folder operations
async function fetchFolders() {
  foldersLoading.value = true;
  try {
    const response = await $fetch<{ folders: Array<{ path: string; name: string }> }>(
      `/api/files/folders?parent=${encodeURIComponent(filesStore.currentFolder)}`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }
    );
    folders.value = response.folders;
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    folders.value = [];
  } finally {
    foldersLoading.value = false;
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) return;
  
  try {
    const authStore = useAuthStore();
    await $fetch('/api/files/folders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: {
        folder_name: newFolderName.value.trim(),
        parent_path: filesStore.currentFolder,
      },
    });
    
    showCreateFolderModal.value = false;
    newFolderName.value = '';
    // Refresh folders and files
    await Promise.all([
      fetchFolders(),
      filesStore.fetchFiles(filesStore.currentFolder)
    ]);
    toast.success('Folder created');
  } catch (error: any) {
    toast.error(error.data?.message || 'Failed to create folder');
  }
}

function navigateToFolder(path: string) {
  filesStore.navigateToFolder(path);
  selectedFiles.value.clear();
  selectedFolders.value.clear();
}

// File operations
function handleDelete(fileId: string) {
  filesToDelete.value = [fileId];
  showDeleteFilesModal.value = true;
}

async function confirmDeleteFiles() {
  const fileCount = filesToDelete.value.length;
  const folderCount = foldersToDelete.value.length;
  const totalCount = fileCount + folderCount;
  
  if (totalCount === 0) return;
  
  try {
    // Delete files
    for (const fileId of filesToDelete.value) {
      await filesStore.deleteFile(fileId);
      selectedFiles.value.delete(fileId);
    }
    
    // Delete folders
    for (const folderPath of foldersToDelete.value) {
      try {
        await $fetch(`/api/files/folders/${encodeURIComponent(folderPath)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authStore.token}` },
        });
        selectedFolders.value.delete(folderPath);
      } catch (error: any) {
        console.error(`Failed to delete folder ${folderPath}:`, error);
        toast.error(`Failed to delete folder: ${error.data?.message || 'Unknown error'}`);
      }
    }
    
    // Refresh files list, folders, and sync storage
    await Promise.all([
      filesStore.fetchFiles(filesStore.currentFolder),
      fetchFolders(),
      filesStore.syncStorage()
    ]);
    
    filesToDelete.value = [];
    foldersToDelete.value = [];
    showDeleteFilesModal.value = false;
    selectedFiles.value.clear();
    selectedFolders.value.clear();
    
    // Show success message
    const messages = [];
    if (fileCount > 0) messages.push(`${fileCount} file${fileCount > 1 ? 's' : ''}`);
    if (folderCount > 0) messages.push(`${folderCount} folder${folderCount > 1 ? 's' : ''}`);
    toast.success(`${messages.join(' and ')} deleted`);
  } catch (error: any) {
    console.error('Delete error:', error);
    toast.error(error.data?.message || 'Failed to delete items');
  }
}

function cancelDeleteFiles() {
  showDeleteFilesModal.value = false;
  filesToDelete.value = [];
  foldersToDelete.value = [];
}

async function handleOpenFile(fileId: string) {
  try {
    const authStore = useAuthStore();
    if (!authStore.token) {
      toast.error('Not authenticated');
      return;
    }

    // Fetch the presigned URL with authentication
    const response = await $fetch<{ downloadUrl: string; fileName: string }>(`/api/files/download/${fileId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });

    // Open in new tab
    window.open(response.downloadUrl, '_blank');
  } catch (error: any) {
    console.error('Failed to open file:', error);
    toast.error(error.data?.message || 'Failed to open file');
  }
}

function handleDownload(fileId: string) {
  filesStore.downloadFile(fileId);
}

async function downloadSelectedFiles() {
  const filesToDownload = Array.from(selectedFiles.value);
  if (filesToDownload.length === 0) return;
  
  try {
    // If only one file, use the regular download
    const fileId = filesToDownload[0];
    if (filesToDownload.length === 1 && typeof fileId === 'string') {
      await filesStore.downloadFile(fileId);
      toast.success('File downloaded');
      return;
    }

    // For multiple files, create a zip on the server
    toast.info('Creating zip file...');
    
    const response = await $fetch<{ downloadUrl: string; fileName: string; fileCount: number }>(
      '/api/files/download-zip',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        body: {
          fileIds: filesToDownload,
        },
      }
    );

    // Download the zip file
    const fileResponse = await fetch(response.downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch zip file: ${fileResponse.statusText}`);
    }
    
    const blob = await fileResponse.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = response.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

    toast.success(`Downloaded ${response.fileCount} file(s) as zip`);
  } catch (error: any) {
    console.error('Download error:', error);
    toast.error(error.data?.message || 'Failed to download files');
  }
}

async function downloadFolder(folder: { path: string; name: string }) {
  hideFolderMenu();
  
  try {
    toast.info('Creating zip file...');
    
    const response = await $fetch<{ downloadUrl: string; fileName: string; fileCount: number }>(
      '/api/files/download-folder-zip',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        body: {
          folderPath: folder.path,
        },
      }
    );

    // Download the zip file
    const fileResponse = await fetch(response.downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch zip file: ${fileResponse.statusText}`);
    }
    
    const blob = await fileResponse.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = response.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

    toast.success(`Downloaded folder with ${response.fileCount} file(s)`);
  } catch (error: any) {
    console.error('Download folder error:', error);
    toast.error(error.data?.message || 'Failed to download folder');
  }
}

function showFileMenu(event: MouseEvent, file: FileItem) {
  event.stopPropagation();
  event.preventDefault();
  
  fileContextMenu.value = { id: file.id, name: file.file_name };
  
  // Adjust position to keep menu within viewport
  const menuWidth = 180;
  const menuHeight = 100;
  let x = event.clientX;
  let y = event.clientY;
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  fileMenuPosition.value = { x, y };
}

function hideFileMenu() {
  fileContextMenu.value = null;
}

function toggleSelection(fileId: string, event?: Event) {
  // Handle shift-click for range selection
  if (isShiftPressed.value && lastSelectedFileIndex.value !== null) {
    const currentIndex = filesStore.filesInCurrentFolder.findIndex(f => f.id === fileId);
    if (currentIndex !== -1) {
      const startIndex = Math.min(lastSelectedFileIndex.value, currentIndex);
      const endIndex = Math.max(lastSelectedFileIndex.value, currentIndex);
      
      // Select all files in the range
      for (let i = startIndex; i <= endIndex; i++) {
        const file = filesStore.filesInCurrentFolder[i];
        if (file) {
          selectedFiles.value.add(file.id);
        }
      }
      lastSelectedFileIndex.value = currentIndex;
      isShiftPressed.value = false;
      return;
    }
  }
  
  // Normal toggle
  if (selectedFiles.value.has(fileId)) {
    selectedFiles.value.delete(fileId);
    lastSelectedFileIndex.value = null;
  } else {
    selectedFiles.value.add(fileId);
    const index = filesStore.filesInCurrentFolder.findIndex(f => f.id === fileId);
    lastSelectedFileIndex.value = index !== -1 ? index : null;
  }
  isShiftPressed.value = false;
}

function handleFileClick(fileId: string, event: MouseEvent) {
  // If there are already selected items, clicking should toggle selection instead of opening
  if (selectedFiles.value.size > 0 || selectedFolders.value.size > 0) {
    event.preventDefault();
    event.stopPropagation();
    toggleSelection(fileId, event);
  } else {
    // If no items are selected, open the file
    handleOpenFile(fileId);
  }
}

function handleFolderClick(folderPath: string, event: MouseEvent) {
  // If there are already selected items, clicking should toggle selection instead of navigating
  if (selectedFiles.value.size > 0 || selectedFolders.value.size > 0) {
    event.preventDefault();
    event.stopPropagation();
    toggleFolderSelection(folderPath);
  } else {
    // If no items are selected, navigate to folder
    navigateToFolder(folderPath);
  }
}

function toggleFolderSelection(folderPath: string) {
  if (selectedFolders.value.has(folderPath)) {
    selectedFolders.value.delete(folderPath);
  } else {
    selectedFolders.value.add(folderPath);
  }
}

// Drag selection handlers
function handleSelectionStart(event: MouseEvent) {
  // Don't start selection if clicking on interactive elements
  const target = event.target as HTMLElement;
  if (target.closest('button, a, input, [role="button"], [data-view-dropdown]')) {
    return;
  }
  
  // Don't start if clicking on a file/folder directly (they have their own click handlers)
  // But allow if holding Ctrl/Cmd for multi-select
  if (target.closest('[data-file-item], [data-folder-item]') && !event.ctrlKey && !event.metaKey) {
    return;
  }
  
  // If clicking on empty space, clear selections unless holding Shift
  if (!target.closest('[data-file-item], [data-folder-item]') && !event.shiftKey) {
    selectedFiles.value.clear();
    selectedFolders.value.clear();
  }
  
  isSelecting.value = true;
  const rect = contentAreaRef.value?.getBoundingClientRect();
  if (rect) {
    selectionStart.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    selectionEnd.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}

function handleSelectionMove(event: MouseEvent) {
  if (!isSelecting.value || !selectionStart.value || !contentAreaRef.value) return;
  
  const rect = contentAreaRef.value.getBoundingClientRect();
  selectionEnd.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  
  // Update selections based on selection box
  updateSelectionsFromBox();
}

function handleSelectionEnd() {
  if (!isSelecting.value) return;
  isSelecting.value = false;
  selectionStart.value = null;
  selectionEnd.value = null;
}

function updateSelectionsFromBox() {
  if (!selectionStart.value || !selectionEnd.value || !contentAreaRef.value) return;
  
  const box = {
    left: Math.min(selectionStart.value.x, selectionEnd.value.x),
    top: Math.min(selectionStart.value.y, selectionEnd.value.y),
    right: Math.max(selectionStart.value.x, selectionEnd.value.x),
    bottom: Math.max(selectionStart.value.y, selectionEnd.value.y)
  };
  
  // Select files in grid view
  if (viewMode.value === 'grid') {
    const fileElements = contentAreaRef.value.querySelectorAll('[data-file-item]');
    fileElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const contentRect = contentAreaRef.value!.getBoundingClientRect();
      const itemBox = {
        left: rect.left - contentRect.left,
        top: rect.top - contentRect.top,
        right: rect.right - contentRect.left,
        bottom: rect.bottom - contentRect.top
      };
      
      const intersects = !(
        box.right < itemBox.left ||
        box.left > itemBox.right ||
        box.bottom < itemBox.top ||
        box.top > itemBox.bottom
      );
      
      if (intersects) {
        const fileId = (el as HTMLElement).dataset.fileItem;
        if (fileId) {
          selectedFiles.value.add(fileId);
        }
      }
    });
    
    // Select folders in grid view
    const folderElements = contentAreaRef.value.querySelectorAll('[data-folder-item]');
    folderElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const contentRect = contentAreaRef.value!.getBoundingClientRect();
      const itemBox = {
        left: rect.left - contentRect.left,
        top: rect.top - contentRect.top,
        right: rect.right - contentRect.left,
        bottom: rect.bottom - contentRect.top
      };
      
      const intersects = !(
        box.right < itemBox.left ||
        box.left > itemBox.right ||
        box.bottom < itemBox.top ||
        box.top > itemBox.bottom
      );
      
      if (intersects) {
        const folderPath = (el as HTMLElement).dataset.folderItem;
        if (folderPath) {
          selectedFolders.value.add(folderPath);
        }
      }
    });
  } else {
    // List view
    const fileElements = contentAreaRef.value.querySelectorAll('[data-file-item]');
    fileElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const contentRect = contentAreaRef.value!.getBoundingClientRect();
      const itemBox = {
        left: rect.left - contentRect.left,
        top: rect.top - contentRect.top,
        right: rect.right - contentRect.left,
        bottom: rect.bottom - contentRect.top
      };
      
      const intersects = !(
        box.right < itemBox.left ||
        box.left > itemBox.right ||
        box.bottom < itemBox.top ||
        box.top > itemBox.bottom
      );
      
      if (intersects) {
        const fileId = (el as HTMLElement).dataset.fileItem;
        if (fileId) {
          selectedFiles.value.add(fileId);
        }
      }
    });
    
    const folderElements = contentAreaRef.value.querySelectorAll('[data-folder-item]');
    folderElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const contentRect = contentAreaRef.value!.getBoundingClientRect();
      const itemBox = {
        left: rect.left - contentRect.left,
        top: rect.top - contentRect.top,
        right: rect.right - contentRect.left,
        bottom: rect.bottom - contentRect.top
      };
      
      const intersects = !(
        box.right < itemBox.left ||
        box.left > itemBox.right ||
        box.bottom < itemBox.top ||
        box.top > itemBox.bottom
      );
      
      if (intersects) {
        const folderPath = (el as HTMLElement).dataset.folderItem;
        if (folderPath) {
          selectedFolders.value.add(folderPath);
        }
      }
    });
  }
}

function deleteSelected() {
  const totalSelected = selectedFiles.value.size + selectedFolders.value.size;
  if (totalSelected === 0) return;
  
  // Set both files and folders to delete
  filesToDelete.value = Array.from(selectedFiles.value);
  foldersToDelete.value = Array.from(selectedFolders.value);
  showDeleteFilesModal.value = true;
}

// Folder context menu
function showFolderMenu(event: MouseEvent, folder: { path: string; name: string }) {
  event.stopPropagation();
  event.preventDefault();
  
  folderContextMenu.value = folder;
  folderMenuPosition.value = { x: event.clientX, y: event.clientY };
}

function hideFolderMenu() {
  folderContextMenu.value = null;
}

async function confirmDeleteFolder() {
  if (!folderToDelete.value) return;
  
  hideFolderMenu();
  
  try {
    // Delete folder via API
    await $fetch(`/api/files/folders/${encodeURIComponent(folderToDelete.value.path)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    
    // Refresh everything
    await Promise.all([
      filesStore.syncStorage(),
      filesStore.fetchFiles(filesStore.currentFolder),
      fetchFolders()
    ]);
    
    showDeleteFolderModal.value = false;
    folderToDelete.value = null;
    toast.success('Folder deleted');
  } catch (error: any) {
    console.error('Delete folder error:', error);
    toast.error(error.data?.message || 'Failed to delete folder');
  }
}

function cancelDeleteFolder() {
  showDeleteFolderModal.value = false;
  folderToDelete.value = null;
  hideFolderMenu();
}

async function deleteFolder(folder: { path: string; name: string }) {
  hideFolderMenu();
  
  // Count files in folder first
  try {
    const filesResponse = await $fetch<{ files: FileItem[] }>(
      `/api/files?folder=${encodeURIComponent(folder.path)}`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
      }
    );
    
    const fileCount = filesResponse.files.length;
    
    // Show modal instead of alert
    folderToDelete.value = {
      path: folder.path,
      name: folder.name,
      fileCount: fileCount,
    };
    showDeleteFolderModal.value = true;
  } catch (error: any) {
    console.error('Failed to count files:', error);
    toast.error('Failed to load folder information');
  }
}

onMounted(async () => {
  // Set initial loading state
  foldersLoading.value = true;
  
  await filesStore.syncStorage();
  await filesStore.fetchFiles();
  await fetchFolders();
  
  // Add global mouse event listeners for drag selection
  document.addEventListener('mousemove', handleSelectionMove);
  document.addEventListener('mouseup', handleSelectionEnd);
});

onUnmounted(() => {
  // Clean up mouse event listeners
  document.removeEventListener('mousemove', handleSelectionMove);
  document.removeEventListener('mouseup', handleSelectionEnd);
});

// Watch for folder changes
watch(() => filesStore.currentFolder, async (newFolder, oldFolder) => {
  // Only fetch if folder actually changed (not on initial mount)
  if (oldFolder !== undefined) {
    await fetchFolders();
  }
});

// Close dropdown when clicking outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-view-dropdown]')) {
      showViewDropdown.value = false;
    }
  };
  
  watch(() => showViewDropdown.value, (isOpen) => {
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
});
</script>

<template>
  <div 
    class="flex flex-col h-full bg-white dark:bg-gray-900"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- Header - Matching Notebooks style -->
    <div class="h-12 flex items-center justify-between px-3 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div class="flex items-center gap-2 relative">
        <!-- View Switcher Dropdown -->
        <div class="relative" data-view-dropdown>
            <button
              @click.stop="showViewDropdown = !showViewDropdown"
              class="flex items-center gap-1.5 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 transition-colors"
            >
              <span>Storage</span>
              <UIcon 
                name="i-heroicons-chevron-down" 
                class="w-3.5 h-3.5 transition-transform"
                :class="{ 'rotate-180': showViewDropdown }"
              />
            </button>
            
            <!-- Dropdown Menu -->
            <Transition
              enter-active-class="transition-opacity duration-100"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-opacity duration-100"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div
                v-if="showViewDropdown"
                class="absolute top-full left-0 mt-0.5 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 z-50"
                @click.stop
              >
              <button
                @click="viewSwitcher?.switchToNotebooks(); showViewDropdown = false"
                class="w-full text-left px-3 py-1.5 text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-book-open" class="w-4 h-4" />
                <span>Notebooks</span>
              </button>
              <button
                @click="showViewDropdown = false"
                class="w-full text-left px-3 py-1.5 text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2"
              >
                <UIcon name="i-heroicons-folder" class="w-4 h-4" />
                <span>Storage</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
      
      <!-- Right side actions -->
      <div class="flex items-center gap-2">
        <!-- View mode toggle -->
        <div class="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800">
          <button
            @click="viewMode = 'grid'"
            class="p-1.5 transition-colors"
            :class="viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
            title="Grid view"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
          </button>
          <button
            @click="viewMode = 'list'"
            class="p-1.5 transition-colors"
            :class="viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
            title="List view"
          >
            <UIcon name="i-heroicons-bars-3" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Breadcrumbs Bar -->
    <div class="px-3 py-3 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center gap-2">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
          <UIcon v-if="index > 0" name="i-heroicons-chevron-right" class="w-3 h-3 text-gray-400" />
          <button
            @click="navigateToFolder(crumb.path)"
            class="flex items-center gap-1 text-sm transition-colors"
            :class="index === breadcrumbs.length - 1 
              ? 'text-gray-900 dark:text-white font-medium' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            <UIcon v-if="index === 0" name="i-heroicons-home" class="w-4 h-4" />
            <span v-else>{{ crumb.name }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Actions Toolbar -->
    <div class="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />
        <!-- Back Button - Subtle icon button -->
        <button
          v-if="parentFolderPath !== null"
          @click="navigateToFolder(parentFolderPath!)"
          class="flex items-center justify-center w-8 h-8 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-lg"
          title="Go back"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        </button>
        <button
          @click="fileInputRef?.click()"
          :disabled="filesStore.storagePercentage >= 100"
          class="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 rounded-lg"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          Upload
        </button>
        <button
          @click="showCreateFolderModal = true"
          class="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors flex items-center gap-1.5 rounded-lg"
        >
          <UIcon name="i-heroicons-folder-plus" class="w-4 h-4" />
          New Folder
        </button>
        
        <!-- Divider if selection actions exist -->
        <div v-if="selectedFiles.size > 0 || selectedFolders.size > 0" class="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

        <button
          v-if="selectedFiles.size > 0"
          @click.stop="downloadSelectedFiles"
          class="px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors flex items-center gap-1.5 rounded-lg"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
          Download ({{ selectedFiles.size }})
        </button>
        <button
          v-if="selectedFiles.size > 0 || selectedFolders.size > 0"
          @click="deleteSelected"
          class="px-3 py-1.5 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors flex items-center gap-1.5 rounded-lg"
        >
          <UIcon name="i-heroicons-trash" class="w-4 h-4" />
          Delete ({{ selectedFiles.size + selectedFolders.size }})
        </button>
      </div>
      
      <!-- Storage quota -->
      <div class="text-sm text-gray-500 dark:text-gray-400">
        {{ filesStore.storageUsedMB }} MB / {{ filesStore.storageQuotaMB }} MB
      </div>
    </div>

    <!-- Content Area -->
    <div
      ref="contentAreaRef"
      class="flex-1 overflow-y-auto p-8 relative select-none"
      :class="{ 
        'bg-blue-50/30 dark:bg-blue-900/10': isDragging,
        'cursor-crosshair': isSelecting
      }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @mousedown="handleSelectionStart"
    >
      <!-- Selection Box -->
      <div
        v-if="isSelecting && selectionStart && selectionEnd"
        class="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-40"
        :style="{
          left: `${Math.min(selectionStart.x, selectionEnd.x)}px`,
          top: `${Math.min(selectionStart.y, selectionEnd.y)}px`,
          width: `${Math.abs(selectionEnd.x - selectionStart.x)}px`,
          height: `${Math.abs(selectionEnd.y - selectionStart.y)}px`
        }"
      />
      <!-- Drag overlay -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isDragging"
          class="fixed inset-0 z-50 flex items-center justify-center bg-blue-500/20 dark:bg-blue-600/20"
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <div class="text-center bg-white dark:bg-gray-800 border border-dashed border-blue-500 dark:border-blue-400 p-12">
            <UIcon name="i-heroicons-cloud-arrow-up" class="w-16 h-16 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
            <p class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Drop files here to upload</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Files will be uploaded to: <span class="font-medium text-blue-600 dark:text-blue-400">{{ filesStore.currentFolder === '/' ? 'Storage' : filesStore.currentFolder }}</span></p>
          </div>
        </div>
      </Transition>

      <!-- Loading -->
      <div v-if="filesStore.loading || foldersLoading" class="flex items-center justify-center py-20">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <!-- Empty state -->
      <div v-else-if="!filesStore.loading && !foldersLoading && filesStore.filesInCurrentFolder.length === 0 && folders.length === 0" 
           class="flex flex-col items-center justify-center py-20">
        <UIcon name="i-heroicons-folder-open" class="w-20 h-20 text-gray-300 dark:text-gray-600 mb-4" />
        <p class="text-gray-500 dark:text-gray-400 text-lg">
          {{ filesStore.currentFolder === '/' ? 'Your storage is empty' : 'This folder is empty' }}
        </p>
      </div>

      <!-- Files and Folders - Grid View -->
      <TransitionGroup
        v-else-if="viewMode === 'grid'"
        name="folder-grid"
        tag="div"
        class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
      >
        <!-- Folders -->
          <div
            v-for="(folder, index) in folders"
            :key="`folder-${folder.path}`"
            :data-folder-item="folder.path"
            class="relative group flex flex-col items-center p-4 border border-gray-300 dark:border-gray-600 transition-colors cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            :class="{
              'ring-2 ring-blue-500 border-blue-500': selectedFolders.has(folder.path)
            }"
            :style="{ '--delay': `${index * 30}ms` }"
            @click="handleFolderClick(folder.path, $event)"
          >
          <!-- Checkbox -->
          <input
            type="checkbox"
            :checked="selectedFolders.has(folder.path)"
            @change.stop="toggleFolderSelection(folder.path)"
            @click.stop
            class="absolute top-2 left-2 w-4 h-4 text-blue-600 z-10"
          />
          
          <div
            class="flex flex-col items-center w-full"
          >
            <UIcon name="i-heroicons-folder" class="w-10 h-10 text-blue-600 dark:text-blue-400 mb-2" />
            <p class="text-xs font-normal text-gray-900 dark:text-white truncate w-full text-center">
              {{ folder.name }}
            </p>
          </div>
          
          <!-- Folder menu button -->
          <button
            @click.stop="showFolderMenu($event, folder)"
            class="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 z-10"
            title="Folder options"
          >
            <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <!-- Files -->
        <div
          v-for="(file, index) in filesStore.filesInCurrentFolder"
          :key="`file-${file.id}`"
          :data-file-item="file.id"
          class="relative group flex flex-col items-center p-4 border border-gray-300 dark:border-gray-600 transition-colors cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          :class="{
            'ring-2 ring-blue-500 border-blue-500': selectedFiles.has(file.id)
          }"
          :style="{ '--delay': `${(folders.length + index) * 30}ms` }"
          @click="handleFileClick(file.id, $event)"
        >
          <!-- Checkbox -->
          <input
            type="checkbox"
            :checked="selectedFiles.has(file.id)"
            @mousedown.stop="isShiftPressed = $event.shiftKey"
            @change.stop="toggleSelection(file.id, $event)"
            @click.stop
            class="absolute top-2 left-2 w-4 h-4 text-primary-600 rounded z-10 cursor-pointer"
          />
          
          <UIcon :name="getFileIcon(file)" class="w-10 h-10 text-gray-500 dark:text-gray-400 mb-2" />
          <p class="text-xs font-normal text-gray-900 dark:text-white truncate w-full text-center mb-1">
            {{ file.file_name }}
          </p>
          <p class="text-[10px] text-gray-500 dark:text-gray-400">
            {{ formatFileSize(file.file_size) }}
          </p>
          
          <!-- Three-dot menu button -->
          <button
            @click.stop="showFileMenu($event, file)"
            class="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 z-10"
            title="File options"
          >
            <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </TransitionGroup>

      <!-- Files and Folders - List View -->
      <TransitionGroup
        v-else
        name="folder-list"
        tag="div"
        class="space-y-2"
      >
        <!-- Folders in list view -->
        <div
          v-for="(folder, index) in folders"
          :key="`folder-${folder.path}`"
          :data-folder-item="folder.path"
          class="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700 transition-colors group cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          :class="{
            'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-600 dark:border-l-blue-400': selectedFolders.has(folder.path)
          }"
          :style="{ '--delay': `${index * 30}ms` }"
          @click="handleFolderClick(folder.path, $event)"
        >
          <!-- Checkbox -->
          <input
            type="checkbox"
            :checked="selectedFolders.has(folder.path)"
            @change.stop="toggleFolderSelection(folder.path)"
            @click.stop
            class="w-4 h-4 text-blue-600 flex-shrink-0"
          />
          
          <div
            class="flex items-center gap-3 flex-1 min-w-0"
          >
            <UIcon name="i-heroicons-folder" class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="font-normal text-sm text-gray-900 dark:text-white truncate">{{ folder.name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Folder</p>
            </div>
          </div>
          
          <!-- Folder menu button -->
          <button
            @click.stop="showFolderMenu($event, folder)"
            class="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Folder options"
          >
            <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <!-- Files in list view -->
        <div
          v-for="(file, index) in filesStore.filesInCurrentFolder"
          :key="`file-${file.id}`"
          :data-file-item="file.id"
          class="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700 transition-colors group cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          :class="{
            'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-600 dark:border-l-blue-400': selectedFiles.has(file.id)
          }"
          :style="{ '--delay': `${(folders.length + index) * 30}ms` }"
          @click="handleFileClick(file.id, $event)"
        >
          <input
            type="checkbox"
            :checked="selectedFiles.has(file.id)"
            @mousedown.stop="isShiftPressed = $event.shiftKey"
            @change.stop="toggleSelection(file.id, $event)"
            @click.stop
            class="w-4 h-4 text-primary-600 rounded flex-shrink-0 cursor-pointer"
          />
          <UIcon :name="getFileIcon(file)" class="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-normal text-sm text-gray-900 dark:text-white truncate">{{ file.file_name }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatFileSize(file.file_size) }} • {{ new Date(file.created_at).toLocaleDateString() }}
            </p>
          </div>
          <!-- Three-dot menu button -->
          <button
            @click.stop="showFileMenu($event, file)"
            class="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700"
            title="File options"
          >
            <UIcon name="i-heroicons-ellipsis-vertical" class="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- Folder Context Menu -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-150 ease"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150 ease"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="folderContextMenu"
            class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg py-1 min-w-[160px]"
            :style="{ left: `${folderMenuPosition.x}px`, top: `${folderMenuPosition.y}px` }"
            @click.stop
          >
            <button
              @click="downloadFolder(folderContextMenu)"
              class="w-full text-left px-4 py-2 text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
            >
              <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
              <span>Download folder</span>
            </button>
            <button
              @click="deleteFolder(folderContextMenu)"
              class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              <span>Delete folder</span>
            </button>
          </div>
        </Transition>
        
        <!-- Backdrop to close menu -->
        <div
          v-if="folderContextMenu"
          class="fixed inset-0 z-40"
          @click="hideFolderMenu"
        />
      </Teleport>
    </ClientOnly>

    <!-- File Context Menu -->
    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-150 ease"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150 ease"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="fileContextMenu"
            class="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
            :style="{ left: `${fileMenuPosition.x}px`, top: `${fileMenuPosition.y}px` }"
            @click.stop
          >
            <div class="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              {{ fileContextMenu.name }}
            </div>
            <div class="py-1">
              <button
                @click="handleDownload(fileContextMenu.id); hideFileMenu()"
                class="w-full text-left px-4 py-2 text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
                <span>Download</span>
              </button>
              <button
                @click="handleDelete(fileContextMenu.id); hideFileMenu()"
                class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </Transition>
        
        <!-- Backdrop to close menu -->
        <div
          v-if="fileContextMenu"
          class="fixed inset-0 z-40"
          @click="hideFileMenu"
        />
      </Teleport>
    </ClientOnly>

    <!-- Create Folder Modal -->
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
            v-if="showCreateFolderModal"
            class="fixed inset-0 z-50 overflow-y-auto"
            @click.self="showCreateFolderModal = false"
          >
            <div class="fixed inset-0 bg-black/50"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                @click.stop
              >
                <h3 class="text-base font-semibold mb-3 text-gray-900 dark:text-white">New Folder</h3>
                <input
                  v-model="newFolderName"
                  type="text"
                  placeholder="Folder name"
                  class="mb-3 w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  autofocus
                  @keyup.enter="createFolder"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="showCreateFolderModal = false"
                    class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="createFolder"
                    class="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Delete Folder Confirmation Modal -->
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
            v-if="showDeleteFolderModal && folderToDelete"
            class="fixed inset-0 z-50 overflow-y-auto"
            @click.self="cancelDeleteFolder"
          >
            <div class="fixed inset-0 bg-black/50"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-md w-full p-5"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center gap-3 mb-3">
                  <div class="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                      Delete Folder
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <!-- Warning Content -->
                <div class="mb-4">
                  <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3 mb-3">
                    <p class="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                      ⚠️ Warning: Permanent Deletion
                    </p>
                    <ul class="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                      <li v-if="folderToDelete.fileCount > 0">
                        All <strong>{{ folderToDelete.fileCount }}</strong> file(s) in this folder will be permanently deleted
                      </li>
                      <li v-else>
                        This empty folder will be permanently deleted
                      </li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>
                  
                  <p class="text-sm text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete the folder <strong class="text-gray-900 dark:text-white">"{{ folderToDelete.name }}"</strong>?
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="cancelDeleteFolder"
                    class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteFolder"
                    class="flex-1 px-3 py-2 bg-red-600 dark:bg-red-500 text-white text-sm font-normal border border-red-700 dark:border-red-600 hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800 dark:active:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Delete Files Confirmation Modal -->
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
            v-if="showDeleteFilesModal && (filesToDelete.length > 0 || foldersToDelete.length > 0)"
            class="fixed inset-0 z-50 overflow-y-auto"
            @click.self="cancelDeleteFiles"
          >
            <div class="fixed inset-0 bg-black/50"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-md w-full p-5"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center gap-3 mb-3">
                  <div class="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                      Delete {{ filesToDelete.length + foldersToDelete.length }} {{ (filesToDelete.length + foldersToDelete.length) === 1 ? 'Item' : 'Items' }}
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <!-- Warning Content -->
                <div class="mb-4">
                  <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3 mb-3">
                    <p class="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                      ⚠️ Warning: Permanent Deletion
                    </p>
                    <ul class="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                      <li v-if="filesToDelete.length > 0">
                        <strong>{{ filesToDelete.length }}</strong> file{{ filesToDelete.length === 1 ? '' : 's' }} will be permanently deleted
                      </li>
                      <li v-if="foldersToDelete.length > 0">
                        <strong>{{ foldersToDelete.length }}</strong> folder{{ foldersToDelete.length === 1 ? '' : 's' }} and all their contents will be permanently deleted
                      </li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </div>
                  
                  <p class="text-sm text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete {{ (filesToDelete.length + foldersToDelete.length) === 1 ? 'this item' : 'these items' }}?
                  </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="cancelDeleteFiles"
                    class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteFiles"
                    class="flex-1 px-3 py-2 bg-red-600 dark:bg-red-500 text-white text-sm font-normal border border-red-700 dark:border-red-600 hover:bg-red-700 dark:hover:bg-red-600 active:bg-red-800 dark:active:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- Upload Progress Toast -->
    <UploadProgress :uploads="uploadProgress" @close="closeUploadProgress" />
  </div>
</template>

<style scoped>
/* Folder Grid Animations */
.folder-grid-enter-active,
.file-grid-enter-active,
.folder-list-enter-active,
.file-list-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: var(--delay, 0ms);
}

.folder-grid-enter-from,
.file-grid-enter-from,
.folder-list-enter-from,
.file-list-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.folder-grid-enter-to,
.file-grid-enter-to,
.folder-list-enter-to,
.file-list-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Leave animations (for when items are removed) */
.folder-grid-leave-active,
.file-grid-leave-active,
.folder-list-leave-active,
.file-list-leave-active {
  transition: all 0.3s ease-in;
}

.folder-grid-leave-from,
.file-grid-leave-from,
.folder-list-leave-from,
.file-list-leave-from {
  opacity: 1;
  transform: scale(1);
}

.folder-grid-leave-to,
.file-grid-leave-to,
.folder-list-leave-to,
.file-list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* Move animations (for reordering) */
.folder-grid-move,
.file-grid-move,
.folder-list-move,
.file-list-move {
  transition: transform 0.3s ease;
}
</style>
