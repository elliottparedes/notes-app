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

    // Prevent moving a folder into itself or its descendants
    if (body.parent_id !== undefined && body.parent_id !== null) {
      const isDescendant = async (parentId: number): Promise<boolean> => {
        if (parentId === folderId) return true;
        
        const parents = await executeQuery<any[]>(`
          SELECT parent_id FROM folders WHERE id = ?
        `, [parentId]);
        
        if (parents.length === 0 || parents[0].parent_id === null) return false;
        return isDescendant(parents[0].parent_id);
      };

      if (await isDescendant(body.parent_id)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot move a folder into itself or its descendants'
        });
      }

      // Verify parent folder exists, belongs to user, and is in the same space
      const parentFolders = await executeQuery<any[]>(`
        SELECT id, space_id FROM folders WHERE id = ? AND user_id = ?
      `, [body.parent_id, userId]);

      if (parentFolders.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Parent folder not found'
        });
      }
      
      // Ensure parent is in the same space as the folder being moved
      if (parentFolders[0].space_id !== folder.space_id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Parent folder must be in the same space'
        });
      }
    }

    // Check for duplicate name in same location and space
    if (body.name && body.name.trim() !== folder.name) {
      const parentId = body.parent_id !== undefined ? body.parent_id : folder.parent_id;
      const spaceId = folder.space_id;
      
      const checkQuery = parentId === null
        ? 'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL AND space_id = ? AND id != ?'
        : 'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id = ? AND space_id = ? AND id != ?';
      
      const checkParams = parentId === null
        ? [userId, body.name.trim(), spaceId, folderId]
        : [userId, body.name.trim(), parentId, spaceId, folderId];
      
      const existing = await executeQuery<any[]>(checkQuery, checkParams);

      if (existing.length > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'A folder with this name already exists in this location'
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

    if (body.parent_id !== undefined) {
      updates.push('parent_id = ?');
      values.push(body.parent_id);
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

