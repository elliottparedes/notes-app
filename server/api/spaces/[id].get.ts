import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { Space } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const spaceId = parseInt(event.context.params?.id as string);
  
  if (isNaN(spaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid space ID'
    });
  }
  
  try {
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id, name, color, icon, created_at, updated_at
      FROM spaces
      WHERE id = ? AND user_id = ?
    `, [spaceId, userId]);

    if (spaces.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    return spaces[0];
  } catch (error: any) {
    console.error('Error fetching space:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch space'
    });
  }
});

