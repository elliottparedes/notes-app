import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { canAccessContent } from '~/server/utils/sharing';
import { logMultipleFieldChanges } from '~/server/utils/history-log';
import type { UpdateSectionDto, Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderId = parseInt(event.context.params?.id as string);
  
  if (isNaN(folderId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid folder ID'
    });
  }

  const body = await readBody<UpdateSectionDto>(event);
  
  try {
    // Verify folder exists
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, notebook_id, name, icon, parent_id
      FROM sections
      WHERE id = ?
    `, [folderId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    const folder = folders[0];

    // Check if user has access to this folder
    const hasAccess = await canAccessContent(folder.user_id, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      });
    }

    // Check for duplicate name in same space
    if (body.name && body.name.trim() !== folder.name) {
      const existing = await executeQuery<any[]>(`
        SELECT id FROM sections WHERE user_id = ? AND name = ? AND notebook_id = ? AND parent_id IS NULL AND id != ?
      `, [folder.user_id, body.name.trim(), folder.notebook_id, folderId]);

      if (existing.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'A folder with this name already exists in this space'
        });
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }

    if (body.icon !== undefined) {
      updates.push('icon = ?');
      values.push(body.icon);
    }

    if (body.notebook_id !== undefined) {
      // Check if space exists and user has access
      const spaces = await executeQuery<any[]>(`
        SELECT id, user_id FROM notebooks WHERE id = ?
      `, [body.notebook_id]);

      if (spaces.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Space not found'
        });
      }

      // Check if user has access to target space
      const hasAccessToTarget = await canAccessContent(spaces[0].user_id, userId);
      if (!hasAccessToTarget) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Access denied to target space'
        });
      }

      updates.push('notebook_id = ?');
      values.push(body.notebook_id);
    }

    if (updates.length === 0) {
      // No updates, just return current folder
      return folder;
    }

    updates.push('updated_at = NOW()');
    values.push(folderId);

    await executeQuery(`
      UPDATE sections
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    // Fetch and return updated folder
    const updatedFolders = await executeQuery<Folder[]>(`
      SELECT id, user_id, notebook_id, name, icon, parent_id, created_at, updated_at
      FROM sections
      WHERE id = ?
    `, [folderId]);

    const updatedFolder = updatedFolders[0];

    // Get user's name for history logging
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Log changes to history (fire and forget)
    logMultipleFieldChanges(
      'section',
      String(folderId),
      userId,
      userName,
      folder.user_id,
      { name: folder.name, icon: folder.icon, notebook_id: folder.notebook_id },
      { name: updatedFolder.name, icon: updatedFolder.icon, notebook_id: updatedFolder.notebook_id },
      ['name', 'icon', 'notebook_id']
    ).catch(err => console.error('History log error:', err));

    return updatedFolder;
  } catch (error: any) {
    console.error('Error updating folder:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update folder'
    });
  }
});

