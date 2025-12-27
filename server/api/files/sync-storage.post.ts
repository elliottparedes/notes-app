import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const startTime = Date.now();
  console.log('[SYNC STORAGE] Starting sync storage...');

  const userId = await requireAuth(event);
  console.log(`[SYNC STORAGE] Auth complete (${Date.now() - startTime}ms), userId: ${userId}`);

  try {
    // Calculate actual storage used from files table
    const queryStart = Date.now();
    const result = await executeQuery<{ total_size: number }[]>(
      `SELECT COALESCE(SUM(file_size), 0) as total_size
       FROM files
       WHERE user_id = ?`,
      [userId]
    );
    console.log(`[SYNC STORAGE] SUM query complete (${Date.now() - queryStart}ms), total_size: ${result[0]?.total_size || 0}`);

    const actualStorageUsed = result[0]?.total_size || 0;

    // Update user's storage_used to match actual files
    const updateStart = Date.now();
    await executeQuery(
      'UPDATE users SET storage_used = ? WHERE id = ?',
      [actualStorageUsed, userId]
    );
    console.log(`[SYNC STORAGE] UPDATE query complete (${Date.now() - updateStart}ms)`);

    console.log(`[SYNC STORAGE] Total time: ${Date.now() - startTime}ms`);
    return {
      success: true,
      storage_used: actualStorageUsed,
      storage_used_mb: Math.round((actualStorageUsed / 1024 / 1024) * 100) / 100,
    };
  } catch (error: any) {
    console.error('Sync storage error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to sync storage'
    });
  }
});






