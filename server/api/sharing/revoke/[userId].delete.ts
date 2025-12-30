import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const currentUserId = await requireAuth(event);
  const targetUserId = getRouterParam(event, 'userId');

  if (!targetUserId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    });
  }

  try {
    // Delete the invitation (both directions for bidirectional sharing)
    await executeQuery(
      'DELETE FROM user_invitations WHERE owner_id = ? AND invited_user_id = ?',
      [currentUserId, parseInt(targetUserId)]
    );

    // Also delete the reverse invitation
    await executeQuery(
      'DELETE FROM user_invitations WHERE owner_id = ? AND invited_user_id = ?',
      [parseInt(targetUserId), currentUserId]
    );

    return {
      success: true,
      message: 'Access revoked successfully'
    };
  } catch (error) {
    console.error('Error revoking access:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to revoke access'
    });
  }
});
