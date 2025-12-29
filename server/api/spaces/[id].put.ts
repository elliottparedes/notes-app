import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { UpdateSpaceDto, Space } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const spaceId = parseInt(event.context.params?.id as string);
  const body = await readBody<UpdateSpaceDto>(event);
  
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
    // Verify space exists and belongs to user
    const existing = await executeQuery<Space[]>(`
      SELECT id FROM notebooks 
      WHERE id = ? AND user_id = ?
    `, [spaceId, userId]);

    if (existing.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    // Check if name change would conflict with another space
    if (body.name) {
      const nameConflict = await executeQuery<any[]>(`
        SELECT id FROM notebooks 
        WHERE user_id = ? AND name = ? AND id != ?
      `, [userId, body.name.trim(), spaceId]);

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
    values.push(spaceId, userId);

    // Update the space
    await executeQuery(`
      UPDATE notebooks 
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `, values);

    // Fetch the updated space
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id, name, color, icon, created_at, updated_at
      FROM notebooks
      WHERE id = ?
    `, [spaceId]);
    
    return spaces[0];
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

