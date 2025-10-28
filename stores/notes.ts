import { defineStore } from 'pinia';
import { toRaw } from 'vue';
import type { Note, CreateNoteDto, UpdateNoteDto, NoteFilters } from '~/models';
import { useAuthStore } from './auth';

interface NotesState {
  notes: Note[];
  currentNote: Note | null;
  loading: boolean;
  error: string | null;
  filters: NoteFilters;
  syncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  folderOrder: string[];
}

export const useNotesStore = defineStore('notes', {
  state: (): NotesState => ({
    notes: [],
    currentNote: null,
    loading: false,
    error: null,
    filters: {},
    syncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    folderOrder: []
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
      const allFolders = Array.from(folderSet);
      
      // If no custom order, use alphabetical sort
      if (state.folderOrder.length === 0) {
        return allFolders.sort();
      }
      
      // Sort by custom order, putting new folders at the end
      const ordered = state.folderOrder.filter(folder => allFolders.includes(folder));
      const newFolders = allFolders.filter(folder => !state.folderOrder.includes(folder)).sort();
      
      return [...ordered, ...newFolders];
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
    async initializeFromLocal(): Promise<void> {
      // Load notes from IndexedDB on startup
      if (process.client) {
        try {
          const { getAllNotes, initDB } = await import('~/utils/db.client');
          await initDB();
          this.notes = await getAllNotes();
        } catch (err) {
          console.error('Failed to load from local storage:', err);
        }
      }
    },

    async fetchNotes(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        if (process.client) {
          // First, load from local storage
          const { getAllNotes } = await import('~/utils/db.client');
          this.notes = await getAllNotes();

          // Then try to sync with server if online
          if (navigator.onLine) {
            await this.syncWithServer();
          }
        }
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
        if (process.client) {
          // First try local storage
          const { getNote } = await import('~/utils/db.client');
          const localNote = await getNote(id);

          if (localNote) {
            this.currentNote = localNote;
          }

          // Then try to sync with server if online
          if (navigator.onLine) {
            const authStore = useAuthStore();
            try {
              const response = await $fetch<Note>(`/api/notes/${id}`, {
                headers: {
                  Authorization: `Bearer ${authStore.token}`
                }
              });

              this.currentNote = response;
              
              // Update local storage (convert to plain object)
              const { saveNote } = await import('~/utils/db.client');
              const plainResponse = JSON.parse(JSON.stringify(response));
              await saveNote(plainResponse);
            } catch (err) {
              // If server fetch fails but we have local data, that's okay
              if (!localNote) {
                throw err;
              }
            }
          }
        }
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
        if (process.client) {
          const { saveNote, addToSyncQueue } = await import('~/utils/db.client');

          // Create a temporary note with a negative ID (will be replaced by server)
          // Use toRaw to convert any reactive data to plain objects
          const plainData = toRaw(data);
          const tempNote: Note = {
            id: -Date.now(), // Negative ID to distinguish from server IDs
            user_id: 0, // Will be set by server
            ...plainData,
            content: plainData.content || null,
            tags: plainData.tags ? JSON.parse(JSON.stringify(plainData.tags)) : null,
            is_favorite: plainData.is_favorite || false,
            folder: plainData.folder || null,
            created_at: new Date(),
            updated_at: new Date()
          };

          // Save to local storage immediately
          await saveNote(tempNote);
          // Don't add to notes array yet - let it appear when user navigates back
          this.currentNote = tempNote;

          // If online, try to sync immediately
          if (navigator.onLine) {
            try {
              const authStore = useAuthStore();
              const response = await $fetch<Note>('/api/notes', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${authStore.token}`
                },
                body: data
              });

              // Update current note with server response
              this.currentNote = response;

              // Update local storage with real note (convert to plain object)
              const plainResponse = JSON.parse(JSON.stringify(response));
              await saveNote(plainResponse);
              
              // Remove temp note from local storage
              const { deleteNote } = await import('~/utils/db.client');
              await deleteNote(tempNote.id);
            } catch (err) {
              // If sync fails, add to sync queue
              await addToSyncQueue({
                type: 'create',
                data
              });
              this.pendingChanges++;
            }
          } else {
            // If offline, add to sync queue
            await addToSyncQueue({
              type: 'create',
              data
            });
            this.pendingChanges++;
          }

          return this.currentNote;
        }

        // Fallback for SSR (shouldn't happen in practice)
        throw new Error('Client-side only operation');
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
        if (process.client) {
          const { saveNote, addToSyncQueue, getNote } = await import('~/utils/db.client');

          // Update local note immediately
          const localNote = await getNote(id);
          if (localNote) {
            // Convert to plain object to avoid Vue reactivity issues with IndexedDB
            const updatedNote: Note = {
              ...localNote,
              ...toRaw(data),
              // Ensure tags is always an array or null, never undefined
              tags: data.tags !== undefined ? JSON.parse(JSON.stringify(data.tags || [])) : localNote.tags,
              updated_at: new Date()
            };

            console.log('Saving to IndexedDB:', updatedNote);
            await saveNote(updatedNote);

            const index = this.notes.findIndex(n => n.id === id);
            if (index !== -1) {
              this.notes[index] = updatedNote;
            }

            if (this.currentNote?.id === id) {
              this.currentNote = updatedNote;
            }
          }

          // If online, try to sync immediately
          if (navigator.onLine) {
            try {
              const authStore = useAuthStore();
              const response = await $fetch<Note>(`/api/notes/${id}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${authStore.token}`
                },
                body: data
              });

              // Update with server response
              const index = this.notes.findIndex(n => n.id === id);
              if (index !== -1) {
                this.notes[index] = response;
              }

              if (this.currentNote?.id === id) {
                this.currentNote = response;
              }

              // Save to IndexedDB (convert to plain object)
              const plainResponse = JSON.parse(JSON.stringify(response));
              await saveNote(plainResponse);
            } catch (err) {
              // If sync fails, add to sync queue
              await addToSyncQueue({
                type: 'update',
                noteId: id,
                data
              });
              this.pendingChanges++;
            }
          } else {
            // If offline, add to sync queue
            await addToSyncQueue({
              type: 'update',
              noteId: id,
              data
            });
            this.pendingChanges++;
          }
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
        if (process.client) {
          const { deleteNote: deleteLocalNote, addToSyncQueue } = await import('~/utils/db.client');

          // Delete from local storage immediately
          await deleteLocalNote(id);
          this.notes = this.notes.filter(n => n.id !== id);

          if (this.currentNote?.id === id) {
            this.currentNote = null;
          }

          // If online, try to sync immediately
          if (navigator.onLine) {
            try {
              const authStore = useAuthStore();
              await $fetch(`/api/notes/${id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${authStore.token}`
                }
              });
            } catch (err) {
              // If sync fails, add to sync queue
              await addToSyncQueue({
                type: 'delete',
                noteId: id
              });
              this.pendingChanges++;
            }
          } else {
            // If offline, add to sync queue
            await addToSyncQueue({
              type: 'delete',
              noteId: id
            });
            this.pendingChanges++;
          }
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to delete note';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async syncWithServer(): Promise<void> {
      if (process.client && navigator.onLine) {
        this.syncing = true;
        try {
          const authStore = useAuthStore();
          const { syncWithServer, getPendingSyncCount } = await import('~/utils/syncManager.client');
          
          const status = await syncWithServer(authStore.token!);
          
          this.lastSyncTime = status.lastSyncTime;
          this.pendingChanges = await getPendingSyncCount();
          
          // Reload notes from local storage after sync
          const { getAllNotes } = await import('~/utils/db.client');
          this.notes = await getAllNotes();
        } catch (err) {
          console.error('Sync failed:', err);
        } finally {
          this.syncing = false;
        }
      }
    },

    async updatePendingChangesCount(): Promise<void> {
      if (process.client) {
        try {
          const { getPendingSyncCount } = await import('~/utils/syncManager.client');
          this.pendingChanges = await getPendingSyncCount();
        } catch (err) {
          console.error('Failed to get pending changes count:', err);
        }
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
    },

    // Folder ordering methods
    async loadFolderOrder(): Promise<void> {
      if (process.client) {
        try {
          // First, try to load from server if online
          if (navigator.onLine) {
            const authStore = useAuthStore();
            if (authStore.token) {
              try {
                const response = await $fetch<{ folder_order: string[] | null }>('/api/user/folder-order', {
                  headers: {
                    Authorization: `Bearer ${authStore.token}`
                  }
                });
                
                if (response.folder_order) {
                  this.folderOrder = response.folder_order;
                  // Save to localStorage as cache
                  localStorage.setItem('folder_order', JSON.stringify(this.folderOrder));
                  return;
                }
              } catch (err) {
                console.error('Failed to load folder order from server:', err);
              }
            }
          }
          
          // Fallback to localStorage
          const stored = localStorage.getItem('folder_order');
          if (stored) {
            try {
              this.folderOrder = JSON.parse(stored);
            } catch (err) {
              console.error('Failed to parse folder order:', err);
              this.folderOrder = [];
            }
          }
        } catch (err) {
          console.error('Error loading folder order:', err);
        }
      }
    },

    async saveFolderOrder(): Promise<void> {
      if (process.client) {
        // Always save to localStorage for offline access
        localStorage.setItem('folder_order', JSON.stringify(this.folderOrder));
        
        // Try to sync with server if online
        if (navigator.onLine) {
          const authStore = useAuthStore();
          if (authStore.token) {
            try {
              await $fetch('/api/user/folder-order', {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${authStore.token}`
                },
                body: {
                  folder_order: this.folderOrder
                }
              });
            } catch (err) {
              console.error('Failed to save folder order to server:', err);
              // Silently fail - localStorage will serve as backup
            }
          }
        }
      }
    },

    moveFolderLeft(folderName: string): void {
      // Ensure folder order is initialized with all current folders
      const currentFolders = this.folders;
      if (this.folderOrder.length === 0) {
        this.folderOrder = [...currentFolders];
      }

      const index = this.folderOrder.indexOf(folderName);
      if (index > 0) {
        // Swap with previous folder
        const temp = this.folderOrder[index - 1];
        if (temp !== undefined) {
          this.folderOrder[index - 1] = folderName;
          this.folderOrder[index] = temp;
          this.saveFolderOrder();
        }
      }
    },

    moveFolderRight(folderName: string): void {
      // Ensure folder order is initialized with all current folders
      const currentFolders = this.folders;
      if (this.folderOrder.length === 0) {
        this.folderOrder = [...currentFolders];
      }

      const index = this.folderOrder.indexOf(folderName);
      if (index !== -1 && index < this.folderOrder.length - 1) {
        // Swap with next folder
        const temp = this.folderOrder[index + 1];
        if (temp !== undefined) {
          this.folderOrder[index + 1] = folderName;
          this.folderOrder[index] = temp;
          this.saveFolderOrder();
        }
      }
    }
  }
});
