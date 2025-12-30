import { executeQuery } from './db';

/**
 * Get IDs of users who have invited this user (bidirectional sharing)
 * Returns users whose content this user can access
 */
export async function getSharedUserIds(userId: number): Promise<number[]> {
  // Get IDs of users who have invited this user
  const rows = await executeQuery<Array<{ owner_id: number }>>(
    'SELECT owner_id FROM user_invitations WHERE invited_user_id = ? AND status = "accepted"',
    [userId]
  );
  return rows.map(r => r.owner_id);
}

/**
 * Get all user IDs whose content this user can access
 * Includes own ID + IDs of users who invited them
 */
export async function getAllAccessibleUserIds(userId: number): Promise<number[]> {
  const sharedUserIds = await getSharedUserIds(userId);
  return [userId, ...sharedUserIds];
}

/**
 * Check if a user can access content owned by another user
 * Returns true if:
 * - User owns the content
 * - Content owner has invited the user
 */
export async function canAccessContent(
  contentUserId: number,
  requestUserId: number
): Promise<boolean> {
  // User can always access their own content
  if (contentUserId === requestUserId) return true;

  // Check if content owner invited request user
  const invitation = await executeQuery(
    'SELECT id FROM user_invitations WHERE owner_id = ? AND invited_user_id = ? AND status = "accepted"',
    [contentUserId, requestUserId]
  );

  return invitation && invitation.length > 0;
}
