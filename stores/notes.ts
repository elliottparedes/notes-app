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
  // Tab management
  openTabs: string[]; // Array of note IDs (UUIDs) that are open in tabs
  activeTabId: string | null; // Currently active tab
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
    folderOrder: [],
    openTabs: [],
    activeTabId: null
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

      // Support both legacy folder string and new folder_id
      if (state.filters.folder_id !== undefined) {
        if (state.filters.folder_id === null) {
          // Show notes with no folder
          filtered = filtered.filter(note => note.folder_id === null);
        } else {
          filtered = filtered.filter(note => note.folder_id === state.filters.folder_id);
        }
      } else if (state.filters.folder) {
        // Legacy support
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

    // Legacy getter - keeping for backward compatibility
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
    },

    // Get notes for open tabs
    tabNotes: (state): Note[] => {
      return state.openTabs
        .map(id => state.notes.find(note => String(note.id) === String(id)))
        .filter((note): note is Note => note !== undefined);
    },

    // Get the active note (from active tab)
    activeNote: (state): Note | null => {
      if (!state.activeTabId) return null;
      return state.notes.find(note => String(note.id) === String(state.activeTabId)) || null;
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

    async fetchNote(id: string): Promise<void> {
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

          // Create a temporary note with a temp UUID (will be replaced by server)
          // Use toRaw to convert any reactive data to plain objects
          const plainData = toRaw(data);
          const tempNote: Note = {
            id: `temp-${Date.now()}`, // Temporary ID to distinguish from server IDs
            user_id: 0, // Will be set by server
            ...plainData,
            content: plainData.content || null,
            tags: plainData.tags ? JSON.parse(JSON.stringify(plainData.tags)) : null,
            is_favorite: plainData.is_favorite || false,
            folder: plainData.folder || null,
            folder_id: plainData.folder_id ?? null,
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

    async updateNote(id: string, data: UpdateNoteDto): Promise<void> {
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

    async deleteNote(id: string): Promise<void> {
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
    },

    // Tab management actions
    async loadTabsFromStorage(): Promise<void> {
      if (process.client) {
        try {
          const savedTabs = localStorage.getItem('open_tabs');
          const savedActiveTab = localStorage.getItem('active_tab');
          
          console.log('[Store] Loading tabs from storage:', savedTabs);
          
          if (savedTabs) {
            const parsedTabs = JSON.parse(savedTabs);
            
            // Clean up: only keep tabs for notes that actually exist
            // Convert to string to handle both number and string IDs
            const validTabIds = parsedTabs
              .map((id: any) => String(id))
              .filter((id: string) => this.notes.some(note => String(note.id) === id));
            
            this.openTabs = validTabIds;
            console.log('[Store] Cleaned openTabs from', parsedTabs.length, 'to', validTabIds.length, ':', this.openTabs);
          }
          
          if (savedActiveTab) {
            // Ensure active tab is in the valid tabs list
            if (this.openTabs.includes(String(savedActiveTab))) {
              this.activeTabId = String(savedActiveTab);
              console.log('[Store] Loaded activeTabId:', this.activeTabId);
            } else {
              // If saved active tab doesn't exist, use first tab or null
              this.activeTabId = this.openTabs[0] || null;
              console.log('[Store] Active tab not valid, using first tab:', this.activeTabId);
            }
          }
          
          // Save cleaned tabs back to storage
          if (savedTabs) {
            this.saveTabsToStorage();
          }
        } catch (err) {
          console.error('Failed to load tabs from storage:', err);
        }
      }
    },

    saveTabsToStorage(): void {
      if (process.client) {
        console.log('[Store] Saving tabs to storage:', this.openTabs);
        localStorage.setItem('open_tabs', JSON.stringify(this.openTabs));
        if (this.activeTabId !== null) {
          localStorage.setItem('active_tab', this.activeTabId);
        } else {
          localStorage.removeItem('active_tab');
        }
      }
    },

    openTab(noteId: string): void {
      // Ensure we're working with string IDs
      const stringId = String(noteId);
      
      // Add to tabs if not already open
      if (!this.openTabs.includes(stringId)) {
        this.openTabs.push(stringId);
      }
      // Set as active tab
      this.activeTabId = stringId;
      this.saveTabsToStorage();
    },

    closeTab(noteId: string): void {
      const stringId = String(noteId);
      const index = this.openTabs.indexOf(stringId);
      if (index === -1) return;

      // Remove from tabs
      this.openTabs.splice(index, 1);

      // If closing the active tab, switch to another tab
      if (this.activeTabId === stringId) {
        if (this.openTabs.length > 0) {
          // Switch to the tab to the left, or the first tab if we closed the first one
          this.activeTabId = this.openTabs[Math.max(0, index - 1)] || null;
        } else {
          this.activeTabId = null;
        }
      }

      this.saveTabsToStorage();
    },

    setActiveTab(noteId: string): void {
      const stringId = String(noteId);
      if (this.openTabs.includes(stringId)) {
        this.activeTabId = stringId;
        this.saveTabsToStorage();
      }
    },

    reorderTabs(fromIndex: number, toIndex: number): void {
      console.log('[Store] reorderTabs called:', { fromIndex, toIndex, currentOrder: [...this.openTabs] });
      
      if (fromIndex < 0 || fromIndex >= this.openTabs.length || 
          toIndex < 0 || toIndex >= this.openTabs.length) {
        console.warn('[Store] Invalid indices for reorderTabs');
        return;
      }

      const [movedTab] = this.openTabs.splice(fromIndex, 1);
      if (!movedTab) {
        console.warn('[Store] No tab found at fromIndex');
        return;
      }
      
      this.openTabs.splice(toIndex, 0, movedTab);
      console.log('[Store] New order:', [...this.openTabs]);
      this.saveTabsToStorage();
    },

    closeAllTabs(): void {
      this.openTabs = [];
      this.activeTabId = null;
      this.saveTabsToStorage();
    }
  }
});
