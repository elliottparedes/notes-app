import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import type { User } from '../../../models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<{ name?: string, profile_picture_url?: string }>(event);

  if (!body.name && body.profile_picture_url === undefined) {
    throw createError({
      statusCode: 400,
      message: 'Name or profile picture URL is required'
    });
  }

  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (body.name) {
      updates.push('name = ?');
      params.push(body.name);
    }

    if (body.profile_picture_url !== undefined) {
      updates.push('profile_picture_url = ?');
      params.push(body.profile_picture_url);
    }

    params.push(userId);

    await executeQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated user
    const users = await executeQuery<any[]>(
      'SELECT id, email, name, profile_picture_url, folder_order, storage_used, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const result = users[0];
    if (!result) {
      throw createError({ statusCode: 404, message: 'User not found' });
    }

    return {
      ...result,
      folder_order: parseJsonField<string[]>(result.folder_order),
      storage_used: result.storage_used || 0
    } as User;
  } catch (error) {
    console.error('Update profile error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update profile'
    });
  }
});
