import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { UpdateFolderDto, Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderId = parseInt(event.context.params?.id as string);
  
  if (isNaN(folderId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid folder ID'
    });
  }

  const body = await readBody<UpdateFolderDto>(event);
  
  try {
    // Verify folder exists and belongs to user
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, space_id, name, parent_id
      FROM folders
      WHERE id = ? AND user_id = ?
    `, [folderId, userId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }
    
    const folder = folders[0];
    
    if (!folder) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    // Check for duplicate name in same space
    if (body.name && body.name.trim() !== folder.name) {
      const existing = await executeQuery<any[]>(`
        SELECT id FROM folders WHERE user_id = ? AND name = ? AND space_id = ? AND parent_id IS NULL AND id != ?
      `, [userId, body.name.trim(), folder.space_id, folderId]);

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

    if (body.space_id !== undefined) {
      // Check if space exists and belongs to user
      const spaces = await executeQuery<any[]>(`
        SELECT id FROM spaces WHERE id = ? AND user_id = ?
      `, [body.space_id, userId]);

      if (spaces.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Space not found'
        });
      }

      updates.push('space_id = ?');
      values.push(body.space_id);
    }

    if (updates.length === 0) {
      // No updates, just return current folder
      return folder;
    }

    updates.push('updated_at = NOW()');
    values.push(folderId);

    await executeQuery(`
      UPDATE folders
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    // Fetch and return updated folder
    const updatedFolders = await executeQuery<Folder[]>(`
      SELECT id, user_id, space_id, name, parent_id, created_at, updated_at
      FROM folders
      WHERE id = ?
    `, [folderId]);
    
    const updatedFolder = updatedFolders[0];

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

