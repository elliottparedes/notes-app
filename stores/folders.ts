import { defineStore } from 'pinia';
import type { Folder, CreateFolderDto, UpdateFolderDto } from '~/models';
import { useAuthStore } from './auth';
import { useSpacesStore } from './spaces';

interface FoldersState {
  folders: Folder[]; // Flat array of all folders
  folderTree: Folder[]; // Tree structure (root folders with children)
  loading: boolean;
  isReordering: boolean; // Track if we're reordering (shouldn't show loading screen)
  error: string | null;
  expandedFolderIds: Set<number>;
}

export const useFoldersStore = defineStore('folders', {
  state: (): FoldersState => ({
    folders: [], // Flat array
    folderTree: [], // Tree structure
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
    getFolderById: (state) => (id: number): Folder | undefined => {
      return state.folders.find(f => f.id === id);
    },

    // Get all descendants of a folder (including the folder itself)
    getDescendants() {
      return (folderId: number): number[] => {
        const descendants: number[] = [folderId];
        const folder = this.folders.find(f => f.id === folderId);
        
        if (folder?.children) {
          folder.children.forEach(child => {
            descendants.push(...this.getDescendants(child.id));
          });
        }
        
        return descendants;
      };
    },

    // Helper to get siblings of a folder (for determining move up/down availability)
    getSiblings() {
      return (folderId: number): Folder[] => {
        const folder = this.getFolderById(folderId);
        if (!folder) return [];

        // If it's a root folder, get all root folders
        if (folder.parent_id === null) {
          return this.folderTree;
        }

        // Otherwise, get children of the parent from the tree (not flat array)
        // We need to search the tree because the flat array doesn't have children
        const findInTree = (folders: Folder[], targetId: number): Folder | undefined => {
          for (const f of folders) {
            if (f.id === targetId) return f;
            if (f.children) {
              const found = findInTree(f.children, targetId);
              if (found) return found;
            }
          }
          return undefined;
        };

        const parent = findInTree(this.folderTree, folder.parent_id);
        return parent?.children || [];
      };
    },

    // Check if folder can move up
    canMoveUp() {
      return (folderId: number): boolean => {
        const siblings = this.getSiblings(folderId);
        const index = siblings.findIndex(f => f.id === folderId);
        return index > 0;
      };
    },

    // Check if folder can move down
    canMoveDown() {
      return (folderId: number): boolean => {
        const siblings = this.getSiblings(folderId);
        const index = siblings.findIndex(f => f.id === folderId);
        return index !== -1 && index < siblings.length - 1;
      };
    }
  },

  actions: {
    async fetchFolders(spaceId?: number | null, silent: boolean = false): Promise<void> {
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

        // Use provided spaceId or current space from spaces store
        const targetSpaceId = spaceId !== undefined ? spaceId : spacesStore.currentSpaceId;

        // Build query params
        const queryParams: Record<string, string> = {};
        if (targetSpaceId) {
          queryParams.space_id = targetSpaceId.toString();
        }

        const folderTree = await $fetch<Folder[]>('/api/folders', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          query: queryParams
        });

        // Store tree structure - create new array to ensure reactivity
        this.folderTree = [...folderTree];
        
        // Flatten tree into array for fast lookups by ID
        const flattenFolders = (folders: Folder[]): Folder[] => {
          const result: Folder[] = [];
          folders.forEach(folder => {
            // Store the folder (without nested children in flat array)
            result.push({ ...folder, children: undefined });
            if (folder.children && folder.children.length > 0) {
              result.push(...flattenFolders(folder.children));
            }
          });
          return result;
        };
        
        this.folders = flattenFolders(folderTree);

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

    async createFolder(data: CreateFolderDto): Promise<Folder> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        const spacesStore = useSpacesStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Automatically assign to current space if not provided
        if (!data.space_id && spacesStore.currentSpaceId) {
          data.space_id = spacesStore.currentSpaceId;
        }

        const folder = await $fetch<Folder>('/api/folders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: data
        });

        // Refresh folder tree to get updated structure
        await this.fetchFolders();

        // Auto-expand parent folder if exists
        if (folder.parent_id) {
          this.expandedFolderIds.add(folder.parent_id);
          this.saveExpandedState();
        }

        return folder;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to create folder';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateFolder(id: number, data: UpdateFolderDto): Promise<Folder> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const folder = await $fetch<Folder>(`/api/folders/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: data
        });

        // Refresh folder tree to get updated structure
        await this.fetchFolders();

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

        await $fetch(`/api/folders/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        // Remove from expanded state
        this.expandedFolderIds.delete(id);
        this.saveExpandedState();

        // Refresh folder tree
        await this.fetchFolders();
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to delete folder';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    toggleFolder(folderId: number): void {
      if (this.expandedFolderIds.has(folderId)) {
        this.expandedFolderIds.delete(folderId);
      } else {
        this.expandedFolderIds.add(folderId);
      }
      this.saveExpandedState();
    },

    expandFolder(folderId: number): void {
      this.expandedFolderIds.add(folderId);
      this.saveExpandedState();
    },

    collapseFolder(folderId: number): void {
      this.expandedFolderIds.delete(folderId);
      this.saveExpandedState();
    },

    saveExpandedState(): void {
      if (process.client) {
        localStorage.setItem('expanded_folders', JSON.stringify(Array.from(this.expandedFolderIds)));
      }
    },

    async reorderFolder(folderId: number, newIndex: number): Promise<void> {
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

        // Get the folder to find its parent and siblings
        const folder = this.getFolderById(folderId);
        if (!folder) {
          throw new Error('Folder not found');
        }

        // Update locally first for instant feedback
        const updateFolderOrder = (folders: Folder[]): Folder[] => {
          if (folder.parent_id === null) {
            // Root level - reorder in folderTree
            const siblings = [...folders];
            const currentIndex = siblings.findIndex(f => f.id === folderId);
            if (currentIndex !== -1 && currentIndex !== newIndex) {
              const [moved] = siblings.splice(currentIndex, 1);
              siblings.splice(newIndex, 0, moved);
              return siblings;
            }
            return folders;
          } else {
            // Nested folder - find parent and update its children
            return folders.map(f => {
              if (f.id === folder.parent_id && f.children) {
                const siblings = [...f.children];
                const currentIndex = siblings.findIndex(child => child.id === folderId);
                if (currentIndex !== -1 && currentIndex !== newIndex) {
                  const [moved] = siblings.splice(currentIndex, 1);
                  siblings.splice(newIndex, 0, moved);
                  return { ...f, children: siblings };
                }
                return f;
              }
              if (f.children) {
                return { ...f, children: updateFolderOrder(f.children) };
              }
              return f;
            });
          }
        };

        // Update folderTree optimistically for instant UI feedback
        this.folderTree = updateFolderOrder(this.folderTree);

        // Update flat folders array by regenerating from tree (simple and reliable)
        const flattenFolders = (folders: Folder[]): Folder[] => {
          const result: Folder[] = [];
          folders.forEach(folder => {
            result.push({ ...folder, children: undefined });
            if (folder.children && folder.children.length > 0) {
              result.push(...flattenFolders(folder.children));
            }
          });
          return result;
        };
        this.folders = flattenFolders(this.folderTree);

        // Make the API call
        await $fetch(`/api/folders/${folderId}/reorder`, {
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
    }
  }
});

