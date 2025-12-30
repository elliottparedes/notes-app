import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { canAccessContent } from '~/server/utils/sharing';
import type { Space } from '~/models';

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
    // Verify space exists
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id FROM notebooks
      WHERE id = ?
    `, [spaceId]);

    if (spaces.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    const spaceOwnerId = spaces[0].user_id;

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

    // Delete the space (cascade will delete all folders in this space)
    // Note: We already deleted notes, so cascade will just clean up folders
    await executeQuery(`
      DELETE FROM notebooks
      WHERE id = ?
    `, [spaceId]);

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

