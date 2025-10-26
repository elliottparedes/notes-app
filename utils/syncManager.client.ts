import type { Note, CreateNoteDto, UpdateNoteDto } from '~/models';
import type { SyncQueueItem } from './db.client';
import {
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncQueueItem,
  addToSyncQueue,
  getAllNotes,
  saveNotes,
  saveNote,
  deleteNote as deleteLocalNote,
  clearSyncQueue
} from './db.client';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  error: string | null;
}

const MAX_RETRIES = 3;
let syncInProgress = false;

export async function syncWithServer(token: string): Promise<SyncStatus> {
  if (syncInProgress) {
    return {
      isSyncing: true,
      lastSyncTime: null,
      pendingChanges: 0,
      error: null
    };
  }

  syncInProgress = true;
  const status: SyncStatus = {
    isSyncing: true,
    lastSyncTime: null,
    pendingChanges: 0,
    error: null
  };

  try {
    // Step 1: Process sync queue (upload local changes)
    const queue = await getSyncQueue();
    status.pendingChanges = queue.length;

    for (const item of queue) {
      try {
        await processSyncItem(item, token);
        await removeFromSyncQueue(item.id);
      } catch (error) {
        console.error('Failed to sync item:', error);
        
        // Increment retry count
        item.retries++;
        
        if (item.retries >= MAX_RETRIES) {
          // Remove from queue after max retries
          await removeFromSyncQueue(item.id);
          console.error(`Removed item from sync queue after ${MAX_RETRIES} retries:`, item);
        } else {
          // Update retry count
          await updateSyncQueueItem(item);
        }
      }
    }

    // Step 2: Fetch latest data from server
    try {
      const serverNotes = await $fetch<Note[]>('/api/notes', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Step 3: Update local database with server data (convert to plain objects)
      const plainNotes = JSON.parse(JSON.stringify(serverNotes));
      await saveNotes(plainNotes);

      // Step 4: Remove notes that no longer exist on server
      const localNotes = await getAllNotes();
      const serverNoteIds = new Set(serverNotes.map(n => n.id));
      
      for (const localNote of localNotes) {
        if (!serverNoteIds.has(localNote.id)) {
          await deleteLocalNote(localNote.id);
        }
      }

      status.lastSyncTime = new Date();
      status.pendingChanges = 0;
    } catch (error) {
      console.error('Failed to fetch from server:', error);
      status.error = 'Failed to sync with server';
    }
  } catch (error) {
    console.error('Sync error:', error);
    status.error = error instanceof Error ? error.message : 'Unknown sync error';
  } finally {
    syncInProgress = false;
    status.isSyncing = false;
  }

  return status;
}

async function processSyncItem(item: SyncQueueItem, token: string): Promise<void> {
  switch (item.type) {
    case 'create':
      if (item.data) {
        const response = await $fetch<Note>('/api/notes', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: item.data
        });
        // Update local note with server-assigned ID (convert to plain object)
        const plainResponse = JSON.parse(JSON.stringify(response));
        await saveNote(plainResponse);
      }
      break;

    case 'update':
      if (item.noteId && item.data) {
        const response = await $fetch<Note>(`/api/notes/${item.noteId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: item.data
        });
        // Update local note with server response (convert to plain object)
        const plainResponse = JSON.parse(JSON.stringify(response));
        await saveNote(plainResponse);
      }
      break;

    case 'delete':
      if (item.noteId) {
        await $fetch(`/api/notes/${item.noteId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        // Note is already deleted locally
      }
      break;
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}

export async function clearSync(): Promise<void> {
  await clearSyncQueue();
}

// Auto-sync when coming online
let autoSyncToken: string | null = null;

export function enableAutoSync(token: string) {
  autoSyncToken = token;
}

export function disableAutoSync() {
  autoSyncToken = null;
}

// Set up auto-sync listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    if (autoSyncToken) {
      console.log('Network is back online, syncing...');
      try {
        await syncWithServer(autoSyncToken);
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }
  });
}

