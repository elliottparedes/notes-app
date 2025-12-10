import type { User } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event): Promise<User> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Fetch user
    const users = await executeQuery<Array<Omit<User, 'folder_order'> & { folder_order: string | null; storage_used: number }>>(
      'SELECT id, email, name, folder_order, storage_used, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const result = users[0];
    
    if (!result) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

    // Parse folder_order from JSON
    const user: User = {
      ...result,
      folder_order: parseJsonField<string[]>(result.folder_order),
      storage_used: result.storage_used || 0
    };

    return user;
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Fetch user error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch user'
    });
  }
});

