import type { User } from '../../../models';
import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event): Promise<User> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Fetch user
    const users = await executeQuery<User[]>(
      'SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const user = users[0];
    
    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

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

