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
    // Verify folder exists
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id FROM sections
      WHERE id = ?
    `, [folderId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    const folderOwnerId = folders[0].user_id;

    // Check if user has access to this folder
    const hasAccess = await canAccessContent(folderOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      });
    }

    // Delete notes in this folder
    await executeQuery(`
      DELETE FROM pages
      WHERE section_id = ?
    `, [folderId]);

    // Delete the folder
    await executeQuery(`
      DELETE FROM sections
      WHERE id = ?
    `, [folderId]);

    return { success: true, deletedCount: 1 };
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete folder'
    });
  }
});

