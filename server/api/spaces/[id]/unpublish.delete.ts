import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

interface SpaceOwnerRow {
  user_id: number;
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
  const [space] = await executeQuery<SpaceOwnerRow[]>(
    'SELECT user_id FROM spaces WHERE id = ?',
    [spaceId]
  );

  if (!space || space.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to unpublish this space'
    });
  }

  // Deactivate publishing (soft delete)
  await executeQuery(
    'UPDATE published_spaces SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE space_id = ? AND owner_id = ?',
    [spaceId, userId]
  );

  return { success: true, message: 'Space unpublished successfully' };
});

