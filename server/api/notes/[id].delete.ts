import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface NoteRow {
  id: string;
}

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
    // Check if note exists and belongs to user
    const existingRows = await executeQuery<NoteRow[]>(
      'SELECT id FROM notes WHERE id = ? AND user_id = ?',
      [noteId, userId]
    );

    if (existingRows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    // Delete note (attachments will be cascade deleted)
    await executeQuery(
      'DELETE FROM notes WHERE id = ? AND user_id = ?',
      [noteId, userId]
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

