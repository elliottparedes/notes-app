import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { canAccessContent } from '../../utils/sharing';
import { logDelete } from '../../utils/history-log';

interface NoteRow {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string | null;
  is_favorite: number;
  section_id: number | null;
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
    // Fetch full note data (for history logging)
    const existingRows = await executeQuery<NoteRow[]>(
      'SELECT id, user_id, title, content, tags, is_favorite, section_id FROM pages WHERE id = ?',
      [noteId]
    );

    if (existingRows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    const note = existingRows[0];
    const noteOwnerId = note.user_id;

    // Check if user has access to this note
    const hasAccess = await canAccessContent(noteOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    // Get user's name for history logging
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Delete note (attachments will be cascade deleted)
    await executeQuery(
      'DELETE FROM pages WHERE id = ?',
      [noteId]
    );

    // Log deletion to history (fire and forget)
    logDelete('page', noteId, userId, userName, noteOwnerId, {
      title: note.title,
      content: note.content,
      tags: parseJsonField<string[]>(note.tags),
      is_favorite: Boolean(note.is_favorite),
      section_id: note.section_id
    }).catch(err => console.error('History log error:', err));

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

