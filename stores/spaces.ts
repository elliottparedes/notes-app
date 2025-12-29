import { defineStore } from 'pinia';
import type { Space, CreateNotebookDto, UpdateNotebookDto } from '~/models';
import { useAuthStore } from './auth';

interface SpacesState {
  spaces: Notebook[];
  currentSpaceId: number | null;
  expandedSpaceIds: Set<number>;
  loading: boolean;
  error: string | null;
}

export const useSpacesStore = defineStore('spaces', {
  state: (): NotebooksState => ({
    spaces: [],
    currentSpaceId: null,
    expandedSpaceIds: new Set(),
    loading: false,
    error: null
  }),

  getters: {
    currentSpace: (state): Notebook | null => {
      if (!state.currentSpaceId) return null;
      return state.spaces.find(s => s.id === state.currentSpaceId) || null;
    },

    hasSpaces: (state): boolean => {
      return state.spaces.length > 0;
    }
  },

  actions: {
    async fetchSpaces(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const spaces = await $fetch<Notebook[]>('/api/notebooks', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        // Update spaces array while preserving reactivity
        // If space already exists, merge properties to keep reactivity
        spaces.forEach((newSpace) => {
          const existingIndex = this.spaces.findIndex(s => s.id === newSpace.id);
          if (existingIndex !== -1) {
            // Update existing space in place to preserve reactivity
            Object.assign(this.spaces[existingIndex], newSpace);
          } else {
            // Add new space
            this.spaces.push(newSpace);
          }
        });
        
        // Remove spaces that no longer exist
        this.spaces = this.spaces.filter(s => spaces.some(ns => ns.id === s.id));

        // Sort local spaces to match server order if they differ
        // (Server returns sorted, so we can just replace if we trust full replace, 
        // but we did merge logic above. Let's assume server returns correct order and re-sort local array based on that)
        const orderMap = new Map(spaces.map((s, i) => [s.id, i]));
        this.spaces.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

        // Load current space from localStorage or set to first space
        if (process.client) {
          const savedSpaceId = localStorage.getItem('current_space_id');
          if (savedSpaceId) {
            const notebookId = parseInt(savedSpaceId);
            // Verify the saved space still exists
            if (this.spaces.find(s => s.id === notebookId)) {
              this.currentSpaceId = notebookId;
            } else {
              // Saved space no longer exists, use first space
              this.currentSpaceId = spaces.length > 0 ? spaces[0].id : null;
              if (this.currentSpaceId) {
                localStorage.setItem('current_space_id', this.currentSpaceId.toString());
              } else {
                localStorage.removeItem('current_space_id');
              }
            }
          } else if (spaces.length > 0) {
            // No saved space, use first space
            this.currentSpaceId = spaces[0].id;
            localStorage.setItem('current_space_id', this.currentSpaceId.toString());
          }

          // Load expanded spaces
          const expanded = localStorage.getItem('expanded_spaces');
          if (expanded) {
            try {
              const ids = JSON.parse(expanded) as number[];
              this.expandedSpaceIds = new Set(ids);
            } catch (err) {
              console.error('Failed to parse expanded spaces:', err);
            }
          }
        } else if (spaces.length > 0) {
          // SSR: just use first space
          this.currentSpaceId = spaces[0].id;
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch spaces';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async createSpace(data: CreateNotebookDto): Promise<Notebook> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const space = await $fetch<Notebook>('/api/notebooks', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: data
        });

        this.spaces.push(space);

        // If this is the first space, set it as current
        if (!this.currentSpaceId) {
          this.setCurrentSpace(space.id);
        }

        return space;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to create space';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateSpace(id: number, data: UpdateNotebookDto): Promise<Notebook> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const space = await $fetch<Notebook>(`/api/notebooks/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: data
        });

        // Update in local state - preserve reactivity by updating the object in place
        const index = this.spaces.findIndex(s => s.id === id);
        if (index !== -1) {
          // Update properties in place to preserve reactivity
          Object.assign(this.spaces[index], space);
        }

        return space;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to update space';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async deleteSpace(id: number): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        await $fetch(`/api/notebooks/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        // Remove from local state
        this.spaces = this.spaces.filter(s => s.id !== id);

        // If deleted space was current, switch to first remaining space
        if (this.currentSpaceId === id) {
          if (this.spaces.length > 0) {
            this.setCurrentSpace(this.spaces[0].id);
          } else {
            this.currentSpaceId = null;
            if (process.client) {
              localStorage.removeItem('current_space_id');
            }
          }
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to delete space';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async reorderSpace(notebookId: number, newIndex: number): Promise<void> {
      this.loading = false; // Optimistic update
      this.error = null;

      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Optimistic update locally
        const currentIndex = this.spaces.findIndex(s => s.id === notebookId);
        if (currentIndex !== -1 && currentIndex !== newIndex) {
          const [movedSpace] = this.spaces.splice(currentIndex, 1);
          this.spaces.splice(newIndex, 0, movedSpace);
        }

        // API call
        await $fetch(`/api/notebooks/${notebookId}/reorder`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            newIndex
          }
        });
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to reorder space';
        // Revert by refetching
        await this.fetchSpaces();
        throw err;
      }
    },

    setCurrentSpace(notebookId: number | null): void {
      if (notebookId === null) {
        this.currentSpaceId = null;
        if (process.client) {
          localStorage.removeItem('current_space_id');
        }
        return;
      }

      // Verify space exists
      if (!this.spaces.find(s => s.id === notebookId)) {
        throw new Error('Space not found');
      }

      this.currentSpaceId = notebookId;

      // Persist to localStorage
      if (process.client) {
        localStorage.setItem('current_space_id', notebookId.toString());
      }
    },

    toggleSpace(notebookId: number): void {
      if (this.expandedSpaceIds.has(notebookId)) {
        this.expandedSpaceIds.delete(notebookId);
      } else {
        this.expandedSpaceIds.add(notebookId);
      }
      this.expandedSpaceIds = new Set(this.expandedSpaceIds);
      this.saveExpandedState();
    },

    expandSpace(notebookId: number): void {
      this.expandedSpaceIds.add(notebookId);
      this.expandedSpaceIds = new Set(this.expandedSpaceIds);
      this.saveExpandedState();
    },

    collapseSpace(notebookId: number): void {
      this.expandedSpaceIds.delete(notebookId);
      this.expandedSpaceIds = new Set(this.expandedSpaceIds);
      this.saveExpandedState();
    },

    saveExpandedState(): void {
      if (process.client) {
        localStorage.setItem('expanded_spaces', JSON.stringify(Array.from(this.expandedSpaceIds)));
      }
    }
  }
});
