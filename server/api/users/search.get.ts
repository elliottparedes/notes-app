import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface UserSearchResult {
  id: number;
  email: string;
  name: string | null;
}

export default defineEventHandler(async (event): Promise<UserSearchResult[]> => {
  const userId = await requireAuth(event);
  const query = getQuery(event);
  const searchTerm = query.q as string;

  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  try {
    // Search for users by email or name, excluding the current user
    const users = await executeQuery<UserSearchResult[]>(
      `SELECT id, email, name 
       FROM users 
       WHERE (email LIKE ? OR name LIKE ?) AND id != ? 
       LIMIT 10`,
      [`%${searchTerm}%`, `%${searchTerm}%`, userId]
    );

    return users;
  } catch (error: unknown) {
    console.error('User search error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to search users'
    });
  }
});

