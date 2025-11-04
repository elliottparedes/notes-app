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
  folderOrder: string[];
  noteOrder: Record<string, string[]>; // { "folder_5": ["uuid1", "uuid2"], "root": ["uuid3"] }
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
    folderOrder: [],
    noteOrder: {},
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
    async fetchNotes(): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

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

    async fetchNote(id: string): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const response = await $fetch<Note>(`/api/notes/${id}`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });

        this.currentNote = response;
        
        // Update the note in the notes array if it exists
        const noteIndex = this.notes.findIndex(n => n.id === id);
        if (noteIndex !== -1) {
          this.notes[noteIndex] = response;
        } else {
          // If note not in array, add it (e.g., if it was just shared with user)
          this.notes.push(response);
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
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const plainData = toRaw(data);
        const response = await $fetch<Note>('/api/notes', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: plainData
        });

        this.currentNote = response;
        
        // Add note to notes array
        const noteIndex = this.notes.findIndex(n => n.id === response.id);
        if (noteIndex === -1) {
          this.notes.push(response);
        } else {
          this.notes[noteIndex] = response;
        }

        return response;
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
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const plainData = toRaw(data);
        const response = await $fetch<Note>(`/api/notes/${id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: plainData
        });

        // Update with server response
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

    async deleteNote(id: string): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

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
      // Force reactivity by creating new object reference
      this.currentNote = note ? { ...note } : null;
    },

    // Folder ordering methods
    async loadFolderOrder(): Promise<void> {
      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          return;
        }

        const response = await $fetch<{ folder_order: string[] | null }>('/api/user/folder-order', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        
        if (response.folder_order) {
          this.folderOrder = response.folder_order;
        }
      } catch (err) {
        console.error('Failed to load folder order:', err);
      }
    },

    async saveFolderOrder(): Promise<void> {
      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

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
        console.error('Failed to save folder order:', err);
        throw err;
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

    // Note ordering methods
    async loadNoteOrder(): Promise<void> {
      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          return;
        }

        const response = await $fetch<{ note_order: Record<string, string[]> | null }>('/api/user/note-order', {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        });
        
        if (response.note_order) {
          this.noteOrder = response.note_order;
        }
      } catch (err) {
        console.error('Failed to load note order:', err);
      }
    },

    async saveNoteOrder(): Promise<void> {
      try {
        const authStore = useAuthStore();
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        await $fetch('/api/user/note-order', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            note_order: this.noteOrder
          }
        });
      } catch (err) {
        console.error('Failed to save note order:', err);
        throw err;
      }
    },

    async reorderNote(noteId: string, folderId: number | null, newIndex: number): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        const response = await $fetch<{ note_order: Record<string, string[]> }>(`/api/notes/${noteId}/reorder`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            folderId,
            newIndex
          }
        });

        // Update local note order
        this.noteOrder = response.note_order;
        await this.saveNoteOrder();

        // Refresh notes to get updated state
        await this.fetchNotes();
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to reorder note';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async moveNote(noteId: string, newFolderId: number | null, newIndex?: number): Promise<void> {
      console.log('[NotesStore] moveNote called', {
        noteId,
        newFolderId,
        newIndex,
        currentNoteId: this.currentNote?.id,
        isCurrentNote: this.currentNote?.id === noteId
      });
      
      this.loading = true;
      this.error = null;

      try {
        const authStore = useAuthStore();
        
        if (!authStore.token) {
          throw new Error('Not authenticated');
        }

        // Optimistically update the note in local state first
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        const oldFolderId = noteIndex !== -1 ? this.notes[noteIndex].folder_id : null;
        
        console.log('[NotesStore] Optimistic update', {
          noteIndex,
          oldFolderId,
          newFolderId,
          noteFound: noteIndex !== -1
        });
        
        // Update note folder_id immediately for instant UI feedback
        if (noteIndex !== -1) {
          // Direct assignment triggers Vue reactivity
          this.notes[noteIndex].folder_id = newFolderId;
          // Also update updated_at to ensure reactivity
          this.notes[noteIndex].updated_at = new Date().toISOString();
          console.log('[NotesStore] Updated note in array', {
            folder_id: this.notes[noteIndex].folder_id
          });
        }

        // Optimistically update noteOrder BEFORE the API call so the note appears in the correct position immediately
        if (newIndex !== undefined) {
          const oldFolderKey = oldFolderId === null ? 'root' : `folder_${oldFolderId}`;
          const newFolderKey = newFolderId === null ? 'root' : `folder_${newFolderId}`;
          
          // Get current noteOrder (clone to avoid mutating the original)
          const optimisticNoteOrder = { ...this.noteOrder };
          
          // Remove note from old folder's order (if it's in a different folder)
          if (oldFolderKey !== newFolderKey && optimisticNoteOrder[oldFolderKey]) {
            optimisticNoteOrder[oldFolderKey] = optimisticNoteOrder[oldFolderKey].filter(id => id !== noteId);
            // Remove key if folder is now empty
            if (optimisticNoteOrder[oldFolderKey].length === 0) {
              delete optimisticNoteOrder[oldFolderKey];
            }
          }
          
          // Get notes in the new folder BEFORE updating folder_id (to get current state)
          // Filter notes that will be in the new folder after the move
          const notesInNewFolder = this.notes.filter(n => {
            // If this is the note being moved, use the new folder_id
            if (n.id === noteId) {
              return false; // Exclude the note being moved
            }
            // Otherwise check if it's already in the target folder
            return n.folder_id === newFolderId;
          });
          
          // Initialize new folder order if it doesn't exist
          if (!optimisticNoteOrder[newFolderKey]) {
            // Create initial order from existing notes in the folder
            optimisticNoteOrder[newFolderKey] = notesInNewFolder.map(n => n.id);
          }
          
          // Insert note at the correct position
          const newFolderOrder = [...optimisticNoteOrder[newFolderKey]];
          // Remove note if it's already in the array (in case of same-folder reorder)
          const existingIndex = newFolderOrder.indexOf(noteId);
          if (existingIndex !== -1) {
            newFolderOrder.splice(existingIndex, 1);
          }
          // Insert at the specified index
          newFolderOrder.splice(newIndex, 0, noteId);
          optimisticNoteOrder[newFolderKey] = newFolderOrder;
          
          // Update noteOrder immediately for instant UI feedback
          this.noteOrder = optimisticNoteOrder;
          console.log('[NotesStore] Optimistically updated noteOrder', {
            newFolderKey,
            newIndex,
            orderLength: newFolderOrder.length,
            notePosition: newFolderOrder.indexOf(noteId),
            noteId
          });
        }

        console.log('[NotesStore] Calling API /api/notes/' + noteId + '/move', {
          newFolderId,
          newIndex
        });
        
        const response = await $fetch<{ note_order: Record<string, string[]> }>(`/api/notes/${noteId}/move`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authStore.token}`
          },
          body: {
            newFolderId,
            newIndex
          }
        }).catch((err) => {
          console.error('[NotesStore] API call failed, reverting optimistic update', err);
          // Revert optimistic update on error
          if (noteIndex !== -1 && oldFolderId !== undefined) {
            this.notes[noteIndex].folder_id = oldFolderId;
          }
          throw err;
        });
        
        console.log('[NotesStore] API response received', {
          success: response.success,
          noteOrderKeys: Object.keys(response.note_order || {}),
          noteOrder: response.note_order
        });

        // Update local note order
        console.log('[NotesStore] Updating noteOrder', {
          before: Object.keys(this.noteOrder),
          after: Object.keys(response.note_order)
        });
        this.noteOrder = response.note_order;
        await this.saveNoteOrder();
        console.log('[NotesStore] noteOrder saved');

        // Also update currentNote if it's the one being moved
        if (this.currentNote && this.currentNote.id === noteId) {
          console.log('[NotesStore] Updating currentNote', {
            before: this.currentNote.folder_id,
            after: newFolderId
          });
          this.currentNote.folder_id = newFolderId;
          this.currentNote.updated_at = this.notes[noteIndex].updated_at;
          // Force reactivity by reassigning
          this.currentNote = { ...this.currentNote };
          console.log('[NotesStore] currentNote updated', {
            folder_id: this.currentNote.folder_id
          });
        }

        console.log('[NotesStore] moveNote completed successfully');
        // The API call already saved to database - no need for additional sync
        // The response confirms the database was updated successfully
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Failed to move note';
        throw err;
      } finally {
        this.loading = false;
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

    async openTab(noteId: string): Promise<void> {
      // Ensure we're working with string IDs
      const stringId = String(noteId);
      
      // Check if note exists in notes array with full content
      let note = this.notes.find(note => String(note.id) === stringId);
      
      // If note doesn't exist or might be incomplete, fetch it
      if (!note && process.client) {
        console.log('[Store] Note not found in array, fetching:', stringId);
        try {
          await this.fetchNote(stringId);
          note = this.notes.find(note => String(note.id) === stringId);
        } catch (err) {
          console.error('[Store] Failed to fetch note:', err);
          // Still open the tab even if fetch fails (might be temp ID that gets updated later)
        }
      }
      
      // On mobile, close all other tabs before opening the new one
      if (process.client && this.isMobile()) {
        // On mobile, only allow one tab open at a time
        // Set the new note as the only open tab
        this.openTabs = [stringId];
      } else {
        // On desktop, add to tabs if not already open
        if (!this.openTabs.includes(stringId)) {
          this.openTabs.push(stringId);
        }
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
    },

    // Helper to detect mobile devices (viewport width < 768px)
    isMobile(): boolean {
      if (!process.client) return false;
      return window.innerWidth < 768;
    }
  }
});
