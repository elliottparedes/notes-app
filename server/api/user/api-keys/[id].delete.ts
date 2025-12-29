import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event): Promise<{ success: boolean; message: string }> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const keyId = parseInt(getRouterParam(event, 'id') || '0');

  if (!keyId || isNaN(keyId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid API key ID'
    });
  }

  try {
    // Verify key belongs to user
    const keys = await executeQuery<any[]>(
      'SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?',
      [keyId, userId]
    );

    if (keys.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'API key not found'
      });
    }

    // Delete the API key
    await executeQuery('DELETE FROM user_api_keys WHERE id = ?', [keyId]);

    return {
      success: true,
      message: 'API key revoked successfully'
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Delete API key error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to revoke API key'
    });
  }
});
