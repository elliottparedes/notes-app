import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { canAccessContent } from '~/server/utils/sharing';
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
      SELECT id, user_id, notebook_id, name, parent_id, created_at, updated_at
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

    return folder;
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

