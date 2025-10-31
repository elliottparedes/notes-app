import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderId = parseInt(event.context.params?.id as string);
  
  if (isNaN(folderId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid folder ID'
    });
  }
  
  try {
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, space_id, name, parent_id, created_at, updated_at
      FROM folders
      WHERE id = ? AND user_id = ?
    `, [folderId, userId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    return folders[0];
  } catch (error: any) {
    console.error('Error fetching folder:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch folder'
    });
  }
});

