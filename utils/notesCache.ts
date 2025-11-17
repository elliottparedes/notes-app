// utils/notesCache.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Note } from '~/models';

// Define the database schema type
interface NotesDB {
  notes: {
    key: string; // note.id
    value: Note;
    indexes: { 'by-updated': Date };
  };
  metadata: {
    key: string;
    value: {
      lastSync: number; // timestamp
      version: number;
    };
  };
}

let db: IDBPDatabase<NotesDB> | null = null;

export async function initNotesCache(): Promise<void> {
  if (!process.client) {
    console.log('[NotesCache] Skipping init (server-side)');
    return;
  }
  
  const startTime = performance.now();
  try {
    db = await openDB<NotesDB>('notes-cache', 1, {
      upgrade(db) {
        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('by-updated', 'updated_at');
        }
        
        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      }
    });
    const duration = performance.now() - startTime;
    console.log(`[NotesCache] ✅ IndexedDB initialized in ${duration.toFixed(2)}ms`);
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[NotesCache] ❌ Failed to initialize IndexedDB after ${duration.toFixed(2)}ms:`, error);
  }
}

export async function saveNotesToCache(notes: Note[]): Promise<void> {
  if (!db || !process.client) {
    console.log('[NotesCache] ⚠️ Cache save skipped (server-side or DB not initialized)');
    return;
  }
  
  const startTime = performance.now();
  try {
    const tx = db.transaction('notes', 'readwrite');
    await Promise.all(notes.map(note => tx.store.put(note)));
    await tx.done;
    
    // Update last sync timestamp
    const metaTx = db.transaction('metadata', 'readwrite');
    await metaTx.store.put({ lastSync: Date.now(), version: 1 }, 'sync');
    await metaTx.done;
    
    const duration = performance.now() - startTime;
    console.log(`[NotesCache] ✅ Saved ${notes.length} notes to cache in ${duration.toFixed(2)}ms`);
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[NotesCache] ❌ Failed to save notes to cache after ${duration.toFixed(2)}ms:`, error);
  }
}

export async function getNotesFromCache(): Promise<Note[]> {
  if (!db || !process.client) {
    console.log('[NotesCache] ⚠️ Cache read skipped (server-side or DB not initialized)');
    return [];
  }
  
  const startTime = performance.now();
  try {
    const tx = db.transaction('notes', 'readonly');
    const notes = await tx.store.getAll();
    await tx.done;
    
    const duration = performance.now() - startTime;
    console.log(`[NotesCache] ✅ Loaded ${notes.length} notes from cache in ${duration.toFixed(2)}ms`);
    return notes;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[NotesCache] ❌ Failed to get notes from cache after ${duration.toFixed(2)}ms:`, error);
    return [];
  }
}

export async function getCachedNote(id: string): Promise<Note | undefined> {
  if (!db || !process.client) return undefined;
  
  try {
    const tx = db.transaction('notes', 'readonly');
    const note = await tx.store.get(id);
    await tx.done;
    
    return note;
  } catch (error) {
    console.error('[NotesCache] Failed to get cached note:', error);
    return undefined;
  }
}

export async function updateCachedNote(note: Note): Promise<void> {
  if (!db || !process.client) return;
  
  try {
    const tx = db.transaction('notes', 'readwrite');
    await tx.store.put(note);
    await tx.done;
  } catch (error) {
    console.error('[NotesCache] Failed to update cached note:', error);
  }
}

export async function deleteCachedNote(id: string): Promise<void> {
  if (!db || !process.client) return;
  
  try {
    const tx = db.transaction('notes', 'readwrite');
    await tx.store.delete(id);
    await tx.done;
  } catch (error) {
    console.error('[NotesCache] Failed to delete cached note:', error);
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  if (!db || !process.client) return null;
  
  try {
    const tx = db.transaction('metadata', 'readonly');
    const meta = await tx.store.get('sync');
    await tx.done;
    
    return meta?.lastSync || null;
  } catch (error) {
    console.error('[NotesCache] Failed to get last sync time:', error);
    return null;
  }
}

export async function clearNotesCache(): Promise<void> {
  if (!db || !process.client) return;
  
  try {
    const tx = db.transaction('notes', 'readwrite');
    await tx.store.clear();
    await tx.done;
    
    const metaTx = db.transaction('metadata', 'readwrite');
    await metaTx.store.delete('sync');
    await metaTx.done;
    
    console.log('[NotesCache] Cache cleared');
  } catch (error) {
    console.error('[NotesCache] Failed to clear cache:', error);
  }
}


