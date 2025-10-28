import { defineStore } from 'pinia';
import type { Folder, CreateFolderDto, UpdateFolderDto } from '~/models';
import { useAuthStore } from './auth';

interface FoldersState {
  folders: Folder[]; // Flat array of all folders
  folderTree: Folder[]; // Tree structure (root folders with children)
  loading: boolean;
  error: string | null;
  expandedFolderIds: Set<number>;
}

export const useFoldersStore = defineStore('folders', {
  state: (): FoldersState => ({
    folders: [], // Flat array
    folderTree: [], // Tree structure  
    loading: false,
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
    }
  },

  actions: {
    async fetchFolders(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const folderTree = await $fetch<Folder[]>('/api/folders', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        // Store tree structure
        this.folderTree = folderTree;
        
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
        this.loading = false;
      }
    },

    async createFolder(data: CreateFolderDto): Promise<Folder> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
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
    }
  }
});

