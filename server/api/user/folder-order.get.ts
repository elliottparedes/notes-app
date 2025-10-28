import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface FolderOrderResponse {
  folder_order: string[] | null;
}

export default defineEventHandler(async (event): Promise<FolderOrderResponse> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Fetch folder order
    const results = await executeQuery<Array<{ folder_order: string | null }>>(
      'SELECT folder_order FROM users WHERE id = ?',
      [userId]
    );

    const result = results[0];
    
    if (!result) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

    return {
      folder_order: parseJsonField<string[]>(result.folder_order)
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Fetch folder order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch folder order'
    });
  }
});

