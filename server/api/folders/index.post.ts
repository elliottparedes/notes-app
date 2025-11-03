import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { CreateFolderDto, Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<CreateFolderDto>(event);
  
  // Validation
  if (!body.name || body.name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder name is required'
    });
  }
  
  try {
    // Determine space_id: from body, from parent folder, or from user's first space
    let spaceId: number;
    
    if (body.space_id) {
      // Verify space belongs to user
      const space = await executeQuery<any[]>(`
        SELECT id FROM spaces WHERE id = ? AND user_id = ?
      `, [body.space_id, userId]);
      
      if (space.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Space not found or does not belong to user'
        });
      }
      spaceId = body.space_id;
    } else if (body.parent_id) {
      // Get space_id from parent folder
      const parent = await executeQuery<any[]>(`
        SELECT id, space_id FROM folders 
        WHERE id = ? AND user_id = ?
      `, [body.parent_id, userId]);

      if (parent.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Parent folder not found'
        });
      }
      spaceId = parent[0].space_id;
    } else {
      // Get user's first space as default
      const spaces = await executeQuery<any[]>(`
        SELECT id FROM spaces WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
      `, [userId]);
      
      if (spaces.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'No spaces found. Please create a space first.'
        });
      }
      spaceId = spaces[0].id;
    }

    // Check if folder with same name already exists for this user under the same parent and space
    const checkQuery = body.parent_id
      ? 'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id = ? AND space_id = ?'
      : 'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL AND space_id = ?';
    
    const checkParams = body.parent_id
      ? [userId, body.name.trim(), body.parent_id, spaceId]
      : [userId, body.name.trim(), spaceId];
    
    const existing = await executeQuery<any[]>(checkQuery, checkParams);

    if (existing.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A folder with this name already exists in this location'
      });
    }

    // Verify parent belongs to same space if provided
    if (body.parent_id) {
      const parent = await executeQuery<any[]>(`
        SELECT id, space_id FROM folders 
        WHERE id = ? AND user_id = ?
      `, [body.parent_id, userId]);

      if (parent.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Parent folder not found'
        });
      }
      
      if (parent[0].space_id !== spaceId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Parent folder must be in the same space'
        });
      }
    }

    // Create the folder
    const result: any = await executeQuery(`
      INSERT INTO folders (user_id, space_id, name, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [userId, spaceId, body.name.trim(), body.parent_id || null]);

    // Fetch the created folder
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, space_id, name, parent_id, created_at, updated_at
      FROM folders
      WHERE id = ?
    `, [result.insertId]);
    
    const folder = folders[0];

    // Auto-publish folder if parent space is published
    const publishedSpaceResults = await executeQuery<Array<{ share_id: string }>>(
      'SELECT share_id FROM published_spaces WHERE space_id = ? AND owner_id = ? AND is_active = TRUE',
      [spaceId, userId]
    );

    if (publishedSpaceResults.length > 0) {
      // Auto-publish the new folder
      const { randomUUID } = await import('crypto');
      const folderShareId = randomUUID();
      await executeQuery(
        'INSERT INTO published_folders (folder_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
        [folder.id, folderShareId, userId]
      );
    }

    return folder;
  } catch (error: any) {
    console.error('Error creating folder:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create folder'
    });
  }
});

