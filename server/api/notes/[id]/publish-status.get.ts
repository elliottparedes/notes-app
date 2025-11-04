import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { getBaseUrl } from '~/server/utils/url';

interface PublishStatusRow {
  share_id: string;
  is_active: number;
  created_at: Date;
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
  const [note] = await executeQuery<Array<{ user_id: number }>>(
    'SELECT user_id FROM notes WHERE id = ?',
    [noteId]
  );

  if (!note || note.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized'
    });
  }

  // Get publish status
  const [published] = await executeQuery<PublishStatusRow[]>(
    'SELECT share_id, is_active, created_at FROM published_notes WHERE note_id = ? AND owner_id = ?',
    [noteId, userId]
  );

  if (!published || !published.is_active) {
    return { is_published: false };
  }

  const baseUrl = getBaseUrl(event);
  const shareUrl = `${baseUrl}/p/${published.share_id}`;

  return {
    is_published: true,
    share_id: published.share_id,
    share_url: shareUrl,
    published_at: published.created_at
  };
});

