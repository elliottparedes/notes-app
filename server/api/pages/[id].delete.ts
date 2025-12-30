import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { canAccessContent } from '../../utils/sharing';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  try {
    // Check if note exists
    const existingRows = await executeQuery<Array<{ id: string; user_id: number }>>(
      'SELECT id, user_id FROM pages WHERE id = ?',
      [noteId]
    );

    if (existingRows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    const noteOwnerId = existingRows[0].user_id;

    // Check if user has access to this note
    const hasAccess = await canAccessContent(noteOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    // Delete note (attachments will be cascade deleted)
    await executeQuery(
      'DELETE FROM pages WHERE id = ?',
      [noteId]
    );

    return { success: true };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Delete note error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to delete note'
    });
  }
});

