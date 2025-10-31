import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { Space } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  
  try {
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id, name, color, icon, created_at, updated_at
      FROM spaces
      WHERE user_id = ?
      ORDER BY created_at ASC
    `, [userId]);

    return spaces;
  } catch (error) {
    console.error('Error fetching spaces:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch spaces'
    });
  }
});

