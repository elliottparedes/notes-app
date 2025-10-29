import type { Note, CreateNoteDto, UpdateNoteDto } from '~/models';

const DB_NAME = 'NotesDB';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const SYNC_QUEUE_STORE = 'syncQueue';

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  noteId?: string; // UUID
  data?: CreateNoteDto | UpdateNoteDto;
  timestamp: number;
  retries: number;
}

let dbInstance: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create notes store
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        notesStore.createIndex('updated_at', 'updated_at', { unique: false });
        notesStore.createIndex('folder', 'folder', { unique: false });
      }

      // Create sync queue store
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Notes operations
export async function getAllNotes(): Promise<Note[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNote(note: Note): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.put(note);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveNotes(notes: Note[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);

    let completed = 0;
    const total = notes.length;

    if (total === 0) {
      resolve();
      return;
    }

    notes.forEach(note => {
      const request = store.put(note);
      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function deleteNote(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearNotes(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const db = await initDB();
  
  // Convert to plain object to avoid DataCloneError with Proxy objects
  const plainItem = JSON.parse(JSON.stringify(item));
  
  const queueItem: SyncQueueItem = {
    ...plainItem,
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    retries: 0
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.add(queueItem);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncQueue(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_QUEUE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

