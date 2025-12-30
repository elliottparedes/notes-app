import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import type { UserInvitationWithUser } from '../../../models/UserInvitation';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    // Get all accepted invitations with user details
    const sharedUsers = await executeQuery<UserInvitationWithUser[]>(
      `SELECT ui.*, u.name, u.email
       FROM user_invitations ui
       JOIN users u ON ui.invited_user_id = u.id
       WHERE ui.owner_id = ? AND ui.status = 'accepted'
       ORDER BY ui.created_at DESC`,
      [userId]
    );

    return sharedUsers;
  } catch (error) {
    console.error('Error fetching shared users:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch shared users'
    });
  }
});
