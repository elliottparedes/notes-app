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
    // Check if folder with same name already exists for this user under the same parent
    const checkQuery = body.parent_id
      ? 'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id = ?'
      : 'SELECT id FROM folders WHERE user_id = ? AND name = ? AND parent_id IS NULL';
    
    const checkParams = body.parent_id
      ? [userId, body.name.trim(), body.parent_id]
      : [userId, body.name.trim()];
    
    const existing = await executeQuery<any[]>(checkQuery, checkParams);

    if (existing.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A folder with this name already exists in this location'
      });
    }

    // If parent_id is provided, verify it exists and belongs to the user
    if (body.parent_id) {
      const parent = await executeQuery<any[]>(`
        SELECT id FROM folders 
        WHERE id = ? AND user_id = ?
      `, [body.parent_id, userId]);

      if (parent.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Parent folder not found'
        });
      }
    }

    // Create the folder
    const result: any = await executeQuery(`
      INSERT INTO folders (user_id, name, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, [userId, body.name.trim(), body.parent_id || null]);

    // Fetch the created folder
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, name, parent_id, created_at, updated_at
      FROM folders
      WHERE id = ?
    `, [result.insertId]);
    
    const folder = folders[0];

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

