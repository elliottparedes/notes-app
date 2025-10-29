import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const shareId = getRouterParam(event, 'shareId');

  if (!shareId) {
    throw createError({
      statusCode: 400,
      message: 'Share ID is required'
    });
  }

  try {
    // Delete share only if the user is the owner
    const result = await executeQuery<any>(
      'DELETE FROM shared_notes WHERE id = ? AND owner_id = ?',
      [shareId, userId]
    );

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      throw createError({
        statusCode: 404,
        message: 'Share not found or not authorized'
      });
    }

    return { success: true, message: 'Share removed successfully' };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Delete share error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to delete share'
    });
  }
});

