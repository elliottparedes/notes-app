import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import type { UserInvitation } from '../../../models/UserInvitation';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    // Get all pending invitations sent by this user
    const invitations = await executeQuery<UserInvitation[]>(
      'SELECT * FROM user_invitations WHERE owner_id = ? AND status = "pending" ORDER BY created_at DESC',
      [userId]
    );

    return invitations;
  } catch (error) {
    console.error('Error fetching invitations:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch invitations'
    });
  }
});
