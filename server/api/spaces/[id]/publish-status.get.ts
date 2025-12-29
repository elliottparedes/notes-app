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
  const spaceId = parseInt(getRouterParam(event, 'id') || '0');

  if (!spaceId) {
    throw createError({
      statusCode: 400,
      message: 'Space ID is required'
    });
  }

  // Verify space ownership
  const space = await executeQuery<Array<{ user_id: number }>>(
    'SELECT user_id FROM notebooks WHERE id = ?',
    [spaceId]
  );

  if (!space || space.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized'
    });
  }

  // Get space publish status
  const published = await executeQuery<PublishStatusRow[]>(
    'SELECT share_id, is_active, created_at FROM published_spaces WHERE notebook_id = ? AND owner_id = ?',
    [spaceId, userId]
  );

  const baseUrl = getBaseUrl(event);
  
  const result: {
    is_published: boolean;
    share_url?: string;
  } = {
    is_published: false
  };

  if (published && published.is_active) {
    result.is_published = true;
    result.share_url = `${baseUrl}/p/space/${published.share_id}`;
  }

  return result;
});

