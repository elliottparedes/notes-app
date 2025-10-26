import { defineStore } from 'pinia';
import type { Note, CreateNoteDto, UpdateNoteDto, NoteFilters } from '~/models';
import { useAuthStore } from './auth';

interface NotesState {
  notes: Note[];
  currentNote: Note | null;
  loading: boolean;
  error: string | null;
  filters: NoteFilters;
}

export const useNotesStore = defineStore('notes', {
  state: (): NotesState => ({
    notes: [],
    currentNote: null,
    loading: false,
    error: null,
    filters: {}
  }),

  getters: {
    filteredNotes: (state): Note[] => {
      let filtered = [...state.notes];

      if (state.filters.search) {
        const search = state.filters.search.toLowerCase();
        filtered = filtered.filter(note =>
          note.title.toLowerCase().includes(search) ||
          (note.content && note.content.toLowerCase().includes(search)) ||
          (note.tags && note.tags.some(tag => tag.toLowerCase().includes(search)))
        );
      }

      if (state.filters.folder) {
        filtered = filtered.filter(note => note.folder === state.filters.folder);
      }

      if (state.filters.tags && state.filters.tags.length > 0) {
        filtered = filtered.filter(note =>
          note.tags && state.filters.tags!.some(tag => note.tags!.includes(tag))
        );
      }

      return filtered.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    },

    folders: (state): string[] => {
      const folderSet = new Set<string>();
      state.notes.forEach(note => {
        if (note.folder) {
          folderSet.add(note.folder);
        }
      });
      return Array.from(folderSet).sort();
    },

    allTags: (state): string[] => {
      const tagSet = new Set<string>();
      state.notes.forEach(note => {
        if (note.tags) {
          note.tags.forEach(tag => tagSet.add(tag));
        }
      });
      return Array.from(tagSet).sort();
    }
  },

  actions: {
    async fetchNotes(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        const response = await $fetch<Note[]>('/api/notes', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        this.notes = response;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch notes';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchNote(id: number): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        const response = await $fetch<Note>(`/api/notes/${id}`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        this.currentNote = response;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch note';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async createNote(data: CreateNoteDto): Promise<Note> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        const response = await $fetch<Note>('/api/notes', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: data
        });

        this.notes.push(response);
        this.currentNote = response;
        return response;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to create note';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateNote(id: number, data: UpdateNoteDto): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        const response = await $fetch<Note>(`/api/notes/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: data
        });

        const index = this.notes.findIndex(n => n.id === id);
        if (index !== -1) {
          this.notes[index] = response;
        }

        if (this.currentNote?.id === id) {
          this.currentNote = response;
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to update note';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async deleteNote(id: number): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        await $fetch(`/api/notes/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        this.notes = this.notes.filter(n => n.id !== id);
        
        if (this.currentNote?.id === id) {
          this.currentNote = null;
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to delete note';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    setFilters(filters: NoteFilters): void {
      this.filters = { ...this.filters, ...filters };
    },

    clearFilters(): void {
      this.filters = {};
    },

    setCurrentNote(note: Note | null): void {
      this.currentNote = note;
    }
  }
});

