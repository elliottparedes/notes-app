import { defineStore } from 'pinia'
import type { SharedNoteWithDetails, ShareNoteDto } from '~/models'
import { useAuthStore } from './auth'

interface SharedNotesState {
  sharedNotes: SharedNoteWithDetails[];
  loading: boolean;
  error: string | null;
}

export const useSharedNotesStore = defineStore('sharedNotes', {
  state: (): SharedNotesState => ({
    sharedNotes: [],
    loading: false,
    error: null
  }),

  getters: {
    // Notes shared with me
    sharedWithMe: (state): SharedNoteWithDetails[] => {
      return state.sharedNotes.filter(share => !share.is_owned_by_me);
    },

    // Notes I've shared with others
    sharedByMe: (state): SharedNoteWithDetails[] => {
      return state.sharedNotes.filter(share => share.is_owned_by_me);
    },

    // Get shares for a specific note
    getSharesForNote: (state) => (noteId: string): SharedNoteWithDetails[] => {
      return state.sharedNotes.filter(share => share.note_id === noteId);
    },

    // Check if a note is shared
    isNoteShared: (state) => (noteId: string): boolean => {
      return state.sharedNotes.some(share => share.note_id === noteId);
    }
  },

  actions: {
    async fetchSharedNotes(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        this.sharedNotes = await $fetch<SharedNoteWithDetails[]>('/api/notes/shared', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch shared notes';
        console.error('Fetch shared notes error:', err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async shareNote(noteId: string, userEmail: string, permission: 'viewer' | 'editor' = 'editor'): Promise<void> {
      const authStore = useAuthStore();
      
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      try {
        await $fetch(`/api/notes/${noteId}/share`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            user_email: userEmail,
            permission
          } as ShareNoteDto
        });

        // Refresh the shared notes list
        await this.fetchSharedNotes();
      } catch (err: unknown) {
        console.error('Share note error:', err);
        throw err;
      }
    },

    async removeShare(shareId: number): Promise<void> {
      const authStore = useAuthStore();
      
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      try {
        await $fetch(`/api/notes/share/${shareId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        // Remove from local state
        this.sharedNotes = this.sharedNotes.filter(share => share.id !== shareId);
      } catch (err: unknown) {
        console.error('Remove share error:', err);
        throw err;
      }
    },

    async searchUsers(query: string): Promise<Array<{ id: number; email: string; name: string | null }>> {
      const authStore = useAuthStore();
      
      if (!authStore.token) {
        throw new Error('Not authenticated');
      }

      if (!query || query.length < 2) {
        return [];
      }

      try {
        const users = await $fetch<Array<{ id: number; email: string; name: string | null }>>('/api/users/search', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          params: {
            q: query
          }
        });

        return users;
      } catch (err: unknown) {
        console.error('Search users error:', err);
        return [];
      }
    }
  }
});

