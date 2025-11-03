import { executeQuery } from './db';

const MAX_STORAGE_BYTES = 500 * 1024 * 1024; // 500MB

/**
 * Get total storage used by a user in bytes
 */
export async function getUserStorageUsed(userId: number): Promise<number> {
  const rows = await executeQuery<Array<{ storage_used: number }>>(
    'SELECT storage_used FROM users WHERE id = ?',
    [userId]
  );
  
  if (rows.length === 0) {
    throw new Error('User not found');
  }
  
  return rows[0].storage_used || 0;
}

/**
 * Check if a file upload would exceed the user's storage quota
 * @param userId - User ID
 * @param fileSize - Size of the file to upload in bytes
 * @throws Error if quota would be exceeded
 */
export async function checkStorageQuota(
  userId: number,
  fileSize: number
): Promise<void> {
  const currentUsed = await getUserStorageUsed(userId);
  const newTotal = currentUsed + fileSize;
  
  if (newTotal > MAX_STORAGE_BYTES) {
    const usedMB = (currentUsed / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0);
    const fileMB = (fileSize / (1024 * 1024)).toFixed(2);
    
    throw new Error(
      `Storage quota exceeded. You have used ${usedMB}MB of ${maxMB}MB. ` +
      `This file (${fileMB}MB) would exceed your limit.`
    );
  }
}

/**
 * Update user's storage quota
 * @param userId - User ID
 * @param deltaBytes - Change in bytes (positive for upload, negative for delete)
 */
export async function updateUserStorage(
  userId: number,
  deltaBytes: number
): Promise<void> {
  await executeQuery(
    'UPDATE users SET storage_used = GREATEST(0, storage_used + ?) WHERE id = ?',
    [deltaBytes, userId]
  );
}

/**
 * Get storage quota information for a user
 */
export async function getStorageQuota(userId: number): Promise<{
  used: number;
  limit: number;
  usedMB: string;
  limitMB: string;
  usedPercent: number;
}> {
  const used = await getUserStorageUsed(userId);
  const usedMB = (used / (1024 * 1024)).toFixed(2);
  const limitMB = (MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0);
  const usedPercent = (used / MAX_STORAGE_BYTES) * 100;
  
  return {
    used,
    limit: MAX_STORAGE_BYTES,
    usedMB,
    limitMB,
    usedPercent: Math.round(usedPercent * 100) / 100,
  };
}

