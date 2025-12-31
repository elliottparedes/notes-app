import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { canAccessContent } from '~/server/utils/sharing';
import { logDelete } from '~/server/utils/history-log';
import type { Space } from '~/models';

interface NotebookRow {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  icon: string | null;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const spaceId = parseInt(event.context.params?.id as string);

  if (isNaN(spaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid space ID'
    });
  }

  try {
    // Fetch full notebook data (for history logging)
    const notebooks = await executeQuery<NotebookRow[]>(`
      SELECT id, user_id, name, color, icon FROM notebooks
      WHERE id = ?
    `, [spaceId]);

    if (notebooks.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    const notebook = notebooks[0];
    const spaceOwnerId = notebook.user_id;

    // Check if user has access to this space
    const hasAccess = await canAccessContent(spaceOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      });
    }

    // Check if this is the owner's only space (only prevent if deleting own space)
    if (spaceOwnerId === userId) {
      const ownedSpaces = await executeQuery<any[]>(`
        SELECT id FROM notebooks
        WHERE user_id = ?
      `, [userId]);

      if (ownedSpaces.length <= 1) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot delete the last remaining space'
        });
      }
    }

    // Get all folder IDs in this space
    const foldersInSpace = await executeQuery<{ id: number }[]>(`
      SELECT id FROM sections
      WHERE notebook_id = ?
    `, [spaceId]);

    const folderIds = foldersInSpace.map(f => f.id);

    // Delete all notes in this space's folders
    if (folderIds.length > 0) {
      // Delete notes in folders of this space
      await executeQuery(`
        DELETE FROM pages
        WHERE section_id IN (${folderIds.map(() => '?').join(',')})
      `, folderIds);
    }

    // Get user's name for history logging
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Delete the space (cascade will delete all folders in this space)
    // Note: We already deleted notes, so cascade will just clean up folders
    await executeQuery(`
      DELETE FROM notebooks
      WHERE id = ?
    `, [spaceId]);

    // Log deletion to history (fire and forget)
    logDelete('notebook', String(spaceId), userId, userName, spaceOwnerId, {
      name: notebook.name,
      color: notebook.color,
      icon: notebook.icon
    }).catch(err => console.error('History log error:', err));

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting space:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete space'
    });
  }
});

