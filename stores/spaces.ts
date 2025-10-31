import { defineStore } from 'pinia';
import type { Space, CreateSpaceDto, UpdateSpaceDto } from '~/models';
import { useAuthStore } from './auth';

interface SpacesState {
  spaces: Space[];
  currentSpaceId: number | null;
  loading: boolean;
  error: string | null;
}

export const useSpacesStore = defineStore('spaces', {
  state: (): SpacesState => ({
    spaces: [],
    currentSpaceId: null,
    loading: false,
    error: null
  }),

  getters: {
    currentSpace: (state): Space | null => {
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

        const spaces = await $fetch<Space[]>('/api/spaces', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        this.spaces = spaces;

        // Load current space from localStorage or set to first space
        if (process.client) {
          const savedSpaceId = localStorage.getItem('current_space_id');
          if (savedSpaceId) {
            const spaceId = parseInt(savedSpaceId);
            // Verify the saved space still exists
            if (this.spaces.find(s => s.id === spaceId)) {
              this.currentSpaceId = spaceId;
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

    async createSpace(data: CreateSpaceDto): Promise<Space> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const space = await $fetch<Space>('/api/spaces', {
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

    async updateSpace(id: number, data: UpdateSpaceDto): Promise<Space> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const space = await $fetch<Space>(`/api/spaces/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
            'Content-Type': 'application/json'
          },
          body: data
        });

        // Update in local state
        const index = this.spaces.findIndex(s => s.id === id);
        if (index !== -1) {
          this.spaces[index] = space;
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

        await $fetch(`/api/spaces/${id}`, {
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

    setCurrentSpace(spaceId: number): void {
      // Verify space exists
      if (!this.spaces.find(s => s.id === spaceId)) {
        throw new Error('Space not found');
      }

      this.currentSpaceId = spaceId;

      // Persist to localStorage
      if (process.client) {
        localStorage.setItem('current_space_id', spaceId.toString());
      }
    }
  }
});

