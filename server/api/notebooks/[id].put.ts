import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { canAccessContent } from '~/server/utils/sharing';
import { logMultipleFieldChanges } from '~/server/utils/history-log';
import type { UpdateNotebookDto, Space } from '~/models';

interface NotebookRow {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  icon: string | null;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const spaceId = parseInt(event.context.params?.id as string);
  const body = await readBody<UpdateNotebookDto>(event);
  
  if (isNaN(spaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid space ID'
    });
  }
  
  // Validation - at least one field must be provided
  if (!body.name && body.color === undefined && body.icon === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one field must be provided for update'
    });
  }

  if (body.name !== undefined && body.name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Space name cannot be empty'
    });
  }
  
  try {
    // Fetch existing notebook (for ownership check and history logging)
    const existing = await executeQuery<NotebookRow[]>(`
      SELECT id, user_id, name, color, icon FROM notebooks
      WHERE id = ?
    `, [spaceId]);

    if (existing.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    const oldNotebook = existing[0];
    const spaceOwnerId = oldNotebook.user_id;

    // Check if user has access to this space
    const hasAccess = await canAccessContent(spaceOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      });
    }

    // Check if name change would conflict with another space
    if (body.name) {
      const nameConflict = await executeQuery<any[]>(`
        SELECT id FROM notebooks
        WHERE user_id = ? AND name = ? AND id != ?
      `, [spaceOwnerId, body.name.trim(), spaceId]);

      if (nameConflict.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'A space with this name already exists'
        });
      }
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      values.push(body.color || null);
    }
    if (body.icon !== undefined) {
      updates.push('icon = ?');
      values.push(body.icon || null);
    }

    updates.push('updated_at = NOW()');
    values.push(spaceId);

    // Update the space
    await executeQuery(`
      UPDATE notebooks
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    // Fetch the updated space
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id, name, color, icon, created_at, updated_at
      FROM notebooks
      WHERE id = ?
    `, [spaceId]);

    const updatedNotebook = spaces[0];

    // Get user's name for history logging
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Log changes to history (fire and forget)
    logMultipleFieldChanges(
      'notebook',
      String(spaceId),
      userId,
      userName,
      spaceOwnerId,
      { name: oldNotebook.name, color: oldNotebook.color, icon: oldNotebook.icon },
      { name: updatedNotebook.name, color: updatedNotebook.color, icon: updatedNotebook.icon },
      ['name', 'color', 'icon']
    ).catch(err => console.error('History log error:', err));

    return updatedNotebook;
  } catch (error: any) {
    console.error('Error updating space:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update space'
    });
  }
});

