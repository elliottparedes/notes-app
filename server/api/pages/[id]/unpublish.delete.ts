import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

interface NoteOwnerRow {
  user_id: number;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  // Verify note ownership
  const note = await executeQuery<NoteOwnerRow[]>(
    'SELECT user_id FROM pages WHERE id = ?',
    [noteId]
  );

  if (!note || note.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to unpublish this note'
    });
  }

  // Deactivate publishing (soft delete)
  await executeQuery(
    'UPDATE published_pages SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND owner_id = ?',
    [noteId, userId]
  );

  return { success: true, message: 'Note unpublished successfully' };
});

