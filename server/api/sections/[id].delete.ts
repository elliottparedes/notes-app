import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { canAccessContent } from '~/server/utils/sharing';
import { logDelete } from '~/server/utils/history-log';
import type { Folder } from '~/models';

interface SectionRow {
  id: number;
  user_id: number;
  name: string;
  icon: string | null;
  notebook_id: number;
}

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
    // Fetch full folder data (for history logging)
    const folders = await executeQuery<SectionRow[]>(`
      SELECT id, user_id, name, icon, notebook_id FROM sections
      WHERE id = ?
    `, [folderId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    const section = folders[0];
    const folderOwnerId = section.user_id;

    // Check if user has access to this folder
    const hasAccess = await canAccessContent(folderOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      });
    }

    // Get user's name for history logging
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

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

    // Log deletion to history (fire and forget)
    logDelete('section', String(folderId), userId, userName, folderOwnerId, {
      name: section.name,
      icon: section.icon,
      notebook_id: section.notebook_id
    }).catch(err => console.error('History log error:', err));

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

