import { defineStore } from 'pinia';
import type { Folder, CreateSectionDto, UpdateSectionDto } from '~/models';
import { useAuthStore } from './auth';
import { useSpacesStore } from './spaces';

interface FoldersState {
  folders: Section[]; // Flat array of all folders
  loading: boolean;
  isReordering: boolean; // Track if we're reordering (shouldn't show loading screen)
  error: string | null;
  expandedFolderIds: Set<number>; // Track which folders are expanded to show notes
}

export const useFoldersStore = defineStore('folders', {
  state: (): SectionsState => ({
    folders: [], // Flat array
    loading: false,
    isReordering: false, // Track if we're reordering (prevents loading screen)
    error: null,
    expandedFolderIds: new Set()
  }),

  getters: {
    // Get all folder IDs (flat list)
    allFolderIds: (state): number[] => {
      return state.folders.map(f => f.id);
    },

    // Get folder by ID (searches flat array for O(n) lookup)
    getFolderById: (state) => (id: number): Section | undefined => {
      return state.folders.find(f => f.id === id);
    },

    // Helper to get siblings of a folder (all folders in the same space are siblings now)
    getSiblings() {
      return (sectionId: number): Section[] => {
        const folder = this.getFolderById(sectionId);
        if (!folder) return [];

        // All folders are root-level, so get all folders in the same space
        const spacesStore = useSpacesStore();
        return this.folders.filter(f => f.notebook_id === folder.notebook_id);
      };
    },

    // Check if folder can move up
    canMoveUp() {
      return (sectionId: number): boolean => {
        const siblings = this.getSiblings(sectionId);
        const index = siblings.findIndex(f => f.id === sectionId);
        return index > 0;
      };
    },

    // Check if folder can move down
    canMoveDown() {
      return (sectionId: number): boolean => {
        const siblings = this.getSiblings(sectionId);
        const index = siblings.findIndex(f => f.id === sectionId);
        return index !== -1 && index < siblings.length - 1;
      };
    }
  },

  actions: {
    async fetchFolders(notebookId?: number | null, silent: boolean = false): Promise<void> {
      if (!silent) {
        this.loading = true;
      }
      this.error = null;

      try {
        const authStore = useAuthStore();
        const spacesStore = useSpacesStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Use provided notebookId or current space from spaces store
        // If notebookId is null, it means fetch ALL folders (ignore current space)
        let targetSpaceId: number | null = null;
        
        if (notebookId === null) {
          targetSpaceId = null;
        } else if (notebookId !== undefined) {
          targetSpaceId = notebookId;
        } else {
          targetSpaceId = spacesStore.currentSpaceId;
        }

        // Try to load from cache first (for both silent and non-silent fetches on refresh)
        // Only use cache if we're fetching for a specific space, not all folders
        if (process.client && targetSpaceId) {
          const cacheStartTime = performance.now();
          const cacheKey = `folders_cache_${targetSpaceId}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData = JSON.parse(cached);
              // Check if cache is less than 5 minutes old
              if (cachedData.timestamp && Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
                // Merge cached folders: remove old folders for this space, then add cached ones
                const cachedFolders = cachedData.folders as Section[];
                this.folders = [
                  ...this.folders.filter(f => f.notebook_id !== targetSpaceId),
                  ...cachedFolders
                ];
                const cacheDuration = performance.now() - cacheStartTime;
                console.log(`[FoldersStore] ✅ CACHE HIT: Loaded ${cachedFolders.length} folders from cache for space ${targetSpaceId} in ${cacheDuration.toFixed(2)}ms (total: ${this.folders.length} folders)`);
                
                // Sync in background
                this.syncFoldersInBackground(targetSpaceId).catch(console.error);
                
                // Load expanded state from localStorage
                if (process.client) {
                  const expanded = localStorage.getItem('expanded_folders');
                  if (expanded) {
                    try {
                      const ids = JSON.parse(expanded) as number[];
                      this.expandedFolderIds = new Set(ids);
                    } catch (err) {
                      console.error('Failed to parse expanded folders:', err);
                    }
                  }
                }
                
                // If silent, return early. Otherwise, still use cache but sync in background
                if (silent) {
                  return; // Return early with cached data
                }
                // For non-silent fetches, use cache but still fetch fresh data
                console.log(`[FoldersStore] ✅ Using cached folders, fetching fresh data...`);
              } else {
                const cacheAge = Date.now() - cachedData.timestamp;
                console.log(`[FoldersStore] ⚠️ CACHE EXPIRED: Cache is ${(cacheAge / 1000).toFixed(0)}s old (max 5min)`);
              }
            } catch (e) {
              // Cache invalid, continue to fetch
              console.warn('[FoldersStore] ⚠️ CACHE INVALID: Failed to parse cache, fetching fresh data');
            }
          } else {
            const cacheDuration = performance.now() - cacheStartTime;
            console.log(`[FoldersStore] ⚠️ CACHE MISS: No cached folders found for space ${targetSpaceId} (checked in ${cacheDuration.toFixed(2)}ms)`);
          }
        }

        // Build query params
        const queryParams: Record<string, string> = {};
        if (targetSpaceId) {
          queryParams.notebook_id = targetSpaceId.toString();
        }

        const serverStartTime = performance.now();
        console.log(`[FoldersStore] 🌐 Fetching folders from server for space ${targetSpaceId || 'all'}...`);
        const folders = await $fetch<Section[]>('/api/sections', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          query: queryParams
        });
        const serverDuration = performance.now() - serverStartTime;
        console.log(`[FoldersStore] ✅ Server response: ${folders.length} folders in ${serverDuration.toFixed(2)}ms`);

        // Merge folders logic
        if (targetSpaceId) {
          // If fetching for specific space: remove old folders for this space, then add new ones
          this.folders = [
            ...this.folders.filter(f => f.notebook_id !== targetSpaceId),
            ...folders
          ];
        } else {
          // If fetching ALL folders, replace entire list
          this.folders = folders;
        }
        
        console.log(`[FoldersStore] 📝 Merged folders in store: ${folders.length} folders for space ${targetSpaceId || 'all'} (total: ${this.folders.length} folders)`, {
          sectionIds: folders.map(f => f.id),
          notebookIds: [...new Set(this.folders.map(f => f.notebook_id))]
        });

        // Cache folders (only if specific space)
        if (process.client && targetSpaceId) {
          const cacheKey = `folders_cache_${targetSpaceId}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            folders,
            timestamp: Date.now()
          }));
          console.log(`[FoldersStore] 💾 Cached ${folders.length} folders for space ${targetSpaceId}`);
        }

        // Load expanded state from localStorage
        if (process.client) {
          const expanded = localStorage.getItem('expanded_folders');
          if (expanded) {
            try {
              const ids = JSON.parse(expanded) as number[];
              this.expandedFolderIds = new Set(ids);
            } catch (err) {
              console.error('Failed to parse expanded folders:', err);
            }
          }
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch folders';
        throw err;
      } finally {
        if (!silent) {
          this.loading = false;
        }
      }
    },

    async syncFoldersInBackground(notebookId: number): Promise<void> {
      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          return;
        }

        const folders = await $fetch<Section[]>('/api/sections', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          query: {
            notebook_id: notebookId.toString()
          }
        });

        // Update cache
        if (process.client) {
          const cacheKey = `folders_cache_${notebookId}`;
          localStorage.setItem(cacheKey, JSON.stringify({
            folders,
            timestamp: Date.now()
          }));
        }

        // Merge folders: remove old folders for this space, then add new ones
        // This preserves folders from other spaces
        this.folders = [
          ...this.folders.filter(f => f.notebook_id !== notebookId),
          ...folders
        ];
        
        console.log(`[FoldersStore] Background sync completed for space ${notebookId}: ${folders.length} folders (total: ${this.folders.length} folders)`);
      } catch (err) {
        console.error('[FoldersStore] Background sync error:', err);
      }
    },

    async createFolder(data: CreateSectionDto): Promise<Section> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        const spacesStore = useSpacesStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Automatically assign to current space if not provided
        if (!data.notebook_id && spacesStore.currentSpaceId) {
          data.notebook_id = spacesStore.currentSpaceId;
        }

        const folder = await $fetch<Section>('/api/sections', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: data
        });

        // Add to local state immediately for instant feedback
        this.folders.push(folder);

        // Invalidate cache for this space so the subsequent fetch gets fresh data
        if (process.client && folder.notebook_id) {
          const cacheKey = `folders_cache_${folder.notebook_id}`;
          localStorage.removeItem(cacheKey);
        }

        // Refresh folders to get updated structure (pass space_id to ensure we refresh the right space)
        await this.fetchFolders(folder.notebook_id);

        return folder;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to create folder';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateFolder(id: number, data: UpdateSectionDto): Promise<Section> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();

        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const folder = await $fetch<Section>(`/api/sections/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: data
        });

        // Optimistic update: immediately update the folder in the state
        const index = this.folders.findIndex(f => f.id === id);
        if (index !== -1) {
          this.folders[index] = folder;
        }

        // Refresh folders for the specific space to ensure consistency
        await this.fetchFolders(folder.notebook_id, true);

        return folder;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to update folder';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async deleteFolder(id: number): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Get folder to find its space before deleting
        const folder = this.getFolderById(id);
        const notebookId = folder?.notebook_id;

        await $fetch(`/api/sections/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        // Invalidate cache for the space
        if (process.client && notebookId) {
          const cacheKey = `folders_cache_${notebookId}`;
          localStorage.removeItem(cacheKey);
        }

        // Refresh folders - pass null to fetch ALL folders and bypass cache
        await this.fetchFolders(null, false);
      } catch (err: any) {
        // If 404, the folder is already deleted - refresh the list to remove it from UI
        if (err?.statusCode === 404 || err?.response?.status === 404) {
          // Get folder info before it's gone from local state
          const folder = this.getFolderById(id);
          const folderNotebookId = folder?.notebook_id;

          // Invalidate cache
          if (process.client && folderNotebookId) {
            const cacheKey = `folders_cache_${folderNotebookId}`;
            localStorage.removeItem(cacheKey);
          }
          // Refresh to remove stale folder from UI - fetch ALL folders to bypass cache
          await this.fetchFolders(null, false);
          // Don't throw error since the desired state (folder gone) is achieved
          return;
        }

        this.error = err instanceof Error ? err.message : 'Failed to delete folder';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async moveFolder(sectionId: number, targetSpaceId: number): Promise<void> {
      this.isReordering = true;
      this.loading = false;
      this.error = null;

      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const folder = this.getFolderById(sectionId);
        if (!folder) throw new Error('Folder not found');
        
        const oldSpaceId = folder.notebook_id;
        
        // Optimistic update
        folder.notebook_id = targetSpaceId;
        
        // Move in local array: Ensure it moves to the end of the new space's list initially
        // This prevents "jumpiness" before reorder is called
        // However, reorder will fix it shortly.
        
        // Make the API call
        await $fetch<Section>(`/api/sections/${sectionId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            notebook_id: targetSpaceId
          }
        });

        // Invalidate caches for both spaces
        if (process.client) {
          localStorage.removeItem(`folders_cache_${oldSpaceId}`);
          localStorage.removeItem(`folders_cache_${targetSpaceId}`);
        }
        
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to move folder';
        // Revert by fetching
        this.fetchFolders(undefined, true).catch(console.error);
        throw err;
      } finally {
        this.isReordering = false;
      }
    },

    async reorderFolder(sectionId: number, newIndex: number): Promise<void> {
      // Mark that we're reordering - this prevents the loading screen from showing
      // We'll update locally for instant UI feedback
      this.isReordering = true;
      this.loading = false; // Ensure loading is false
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Get the folder to find its siblings
        const folder = this.getFolderById(sectionId);
        if (!folder) {
          throw new Error('Folder not found');
        }

        // Get all folders in the same space (siblings)
        const siblings = this.folders.filter(f => f.notebook_id === folder.notebook_id);
        
        // Update locally first for instant feedback
        const currentIndex = siblings.findIndex(f => f.id === sectionId);
        if (currentIndex !== -1 && currentIndex !== newIndex) {
          const [moved] = siblings.splice(currentIndex, 1);
          siblings.splice(newIndex, 0, moved);
          
          // Update folders array with new order (maintain other folders)
          const otherFolders = this.folders.filter(f => f.notebook_id !== folder.notebook_id);
          this.folders = [...otherFolders, ...siblings];
        }

        // Make the API call
        await $fetch(`/api/sections/${sectionId}/reorder`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            newIndex
          }
        });

        // No need to refetch - we've already updated local state optimistically
        // The API call confirmed the change was saved, so we're in sync
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to reorder folder';
        // On error, revert by refetching to get correct state from server
        this.fetchFolders(undefined, true).catch(console.error);
        throw err;
      } finally {
        // Always clear the reordering flag
        this.isReordering = false;
      }
    },

    toggleFolder(sectionId: number): void {
      if (this.expandedFolderIds.has(sectionId)) {
        this.expandedFolderIds.delete(sectionId);
      } else {
        this.expandedFolderIds.add(sectionId);
      }
      this.expandedFolderIds = new Set(this.expandedFolderIds);
      this.saveExpandedState();
    },

    expandFolder(sectionId: number): void {
      this.expandedFolderIds.add(sectionId);
      this.expandedFolderIds = new Set(this.expandedFolderIds);
      this.saveExpandedState();
    },

    collapseFolder(sectionId: number): void {
      this.expandedFolderIds.delete(sectionId);
      this.expandedFolderIds = new Set(this.expandedFolderIds);
      this.saveExpandedState();
    },

    saveExpandedState(): void {
      if (process.client) {
        localStorage.setItem('expanded_folders', JSON.stringify(Array.from(this.expandedFolderIds)));
      }
    }
  }
});
