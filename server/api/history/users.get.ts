import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { getAllAccessibleUserIds } from '../../utils/sharing';
import type { ContributingUser } from '../../../models/HistoryLog';

export default defineEventHandler(async (event): Promise<ContributingUser[]> => {
  const userId = await requireAuth(event);

  try {
    const accessibleUserIds = await getAllAccessibleUserIds(userId);
    const placeholders = accessibleUserIds.map(() => '?').join(',');

    const users = await executeQuery<ContributingUser[]>(
      `SELECT user_id, user_name, COUNT(*) as change_count
       FROM history_log
       WHERE owner_id IN (${placeholders})
       GROUP BY user_id, user_name
       ORDER BY change_count DESC`,
      accessibleUserIds
    );

    return users;
  } catch (error) {
    console.error('Error fetching contributing users:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch contributing users'
    });
  }
});
