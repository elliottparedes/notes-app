import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { CreateSectionDto, Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<CreateSectionDto>(event);
  
  // Validation
  if (!body.name || body.name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Folder name is required'
    });
  }
  
  try {
    // Determine notebook_id: from body or from user's first space
    let spaceId: number;
    
    if (body.notebook_id) {
      // Verify space belongs to user
      const space = await executeQuery<any[]>(`
        SELECT id FROM notebooks WHERE id = ? AND user_id = ?
      `, [body.notebook_id, userId]);
      
      if (space.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Space not found or does not belong to user'
        });
      }
      spaceId = body.notebook_id;
    } else {
      // Get user's first space as default
      const spaces = await executeQuery<any[]>(`
        SELECT id FROM notebooks WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
      `, [userId]);
      
      if (spaces.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'No spaces found. Please create a space first.'
        });
      }
      spaceId = spaces[0].id;
    }

    // Check if folder with same name already exists for this user in the same space
    const existing = await executeQuery<any[]>(`
      SELECT id FROM sections WHERE user_id = ? AND name = ? AND notebook_id = ? AND parent_id IS NULL
    `, [userId, body.name.trim(), spaceId]);

    if (existing.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A folder with this name already exists in this space'
      });
    }

    // Create the folder (always root-level, parent_id is NULL)
    const result: any = await executeQuery(`
      INSERT INTO sections (user_id, notebook_id, name, icon, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, NOW(), NOW())
    `, [userId, spaceId, body.name.trim(), body.icon || null]);

    // Fetch the created folder
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, notebook_id, name, icon, parent_id, created_at, updated_at
      FROM sections
      WHERE id = ?
    `, [result.insertId]);
    
    const folder = folders[0];

    // Auto-publish folder if parent space is published
    const publishedSpaceResults = await executeQuery<Array<{ share_id: string }>>(
      'SELECT share_id FROM published_spaces WHERE notebook_id = ? AND owner_id = ? AND is_active = TRUE',
      [spaceId, userId]
    );

    if (publishedSpaceResults.length > 0) {
      // Auto-publish the new folder
      const { randomUUID } = await import('crypto');
      const folderShareId = randomUUID();
      await executeQuery(
        'INSERT INTO published_sections (section_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
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

