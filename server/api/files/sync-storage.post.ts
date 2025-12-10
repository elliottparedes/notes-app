import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    // Calculate actual storage used from files table
    const result = await executeQuery<{ total_size: number }[]>(
      `SELECT COALESCE(SUM(file_size), 0) as total_size 
       FROM files 
       WHERE user_id = ?`,
      [userId]
    );

    const actualStorageUsed = result[0]?.total_size || 0;

    // Update user's storage_used to match actual files
    await executeQuery(
      'UPDATE users SET storage_used = ? WHERE id = ?',
      [actualStorageUsed, userId]
    );

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

