// utils/profilePictureCache.ts
import { openDB, type IDBPDatabase } from 'idb';

interface ProfilePictureDB {
  pictures: {
    key: string; // user ID
    value: {
      userId: string;
      url: string;
      blob: Blob;
      cachedAt: number;
    };
  };
}

let db: IDBPDatabase<ProfilePictureDB> | null = null;

export async function initProfilePictureCache(): Promise<void> {
  if (!process.client) {
    console.log('[ProfilePictureCache] Skipping init (server-side)');
    return;
  }

  const startTime = performance.now();
  try {
    db = await openDB<ProfilePictureDB>('profile-pictures-cache', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pictures')) {
          db.createObjectStore('pictures', { keyPath: 'userId' });
        }
      }
    });
    const duration = performance.now() - startTime;
    console.log(`[ProfilePictureCache] ✅ IndexedDB initialized in ${duration.toFixed(2)}ms`);
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[ProfilePictureCache] ❌ Failed to initialize IndexedDB after ${duration.toFixed(2)}ms:`, error);
  }
}

export async function getCachedProfilePicture(userId: string | number, url: string): Promise<string | null> {
  if (!db || !process.client) return null;

  try {
    const userIdStr = String(userId);
    const cached = await db.get('pictures', userIdStr);

    // Check if cached entry exists and URL matches
    if (cached && cached.url === url) {
      // Create object URL from cached blob
      const objectUrl = URL.createObjectURL(cached.blob);
      console.log(`[ProfilePictureCache] ✅ Cache hit for user ${userIdStr}`);
      return objectUrl;
    }

    console.log(`[ProfilePictureCache] ⚠️ Cache miss for user ${userIdStr}`);
    return null;
  } catch (error) {
    console.error('[ProfilePictureCache] Failed to get cached picture:', error);
    return null;
  }
}

export async function cacheProfilePicture(userId: string | number, url: string): Promise<string | null> {
  if (!db || !process.client) return null;

  try {
    const userIdStr = String(userId);
    const startTime = performance.now();

    // Fetch the image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Store in IndexedDB
    await db.put('pictures', {
      userId: userIdStr,
      url,
      blob,
      cachedAt: Date.now()
    });

    const duration = performance.now() - startTime;
    console.log(`[ProfilePictureCache] ✅ Cached profile picture for user ${userIdStr} in ${duration.toFixed(2)}ms`);

    // Return object URL
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('[ProfilePictureCache] Failed to cache picture:', error);
    return null;
  }
}

export async function invalidateProfilePictureCache(userId: string | number): Promise<void> {
  if (!db || !process.client) return;

  try {
    const userIdStr = String(userId);
    await db.delete('pictures', userIdStr);
    console.log(`[ProfilePictureCache] ✅ Invalidated cache for user ${userIdStr}`);
  } catch (error) {
    console.error('[ProfilePictureCache] Failed to invalidate cache:', error);
  }
}

export async function clearProfilePictureCache(): Promise<void> {
  if (!db || !process.client) return;

  try {
    const tx = db.transaction('pictures', 'readwrite');
    await tx.store.clear();
    await tx.done;
    console.log('[ProfilePictureCache] ✅ Cache cleared');
  } catch (error) {
    console.error('[ProfilePictureCache] Failed to clear cache:', error);
  }
}
