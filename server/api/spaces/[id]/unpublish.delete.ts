import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

interface SpaceOwnerRow {
  user_id: number;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const spaceId = parseInt(getRouterParam(event, 'id') || '0');

  if (!spaceId) {
    throw createError({
      statusCode: 400,
      message: 'Space ID is required'
    });
  }

  try {
    // Verify space ownership
    const spaceResults = await executeQuery<SpaceOwnerRow[]>(
      'SELECT user_id FROM notebooks WHERE id = ?',
      [spaceId]
    );

    const space = spaceResults[0];

    if (!space || space.user_id !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized to unpublish this space'
      });
    }

    // Function to unpublish folder and all its notes (no subfolders)
    async function unpublishFolder(folderId: number) {
      // Unpublish all notes in this folder
      const notesInFolder = await executeQuery<Array<{ id: string }>>(
        'SELECT id FROM pages WHERE section_id = ? AND user_id = ?',
        [folderId, userId]
      );

      for (const note of notesInFolder) {
        await executeQuery(
          'UPDATE published_notes SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND owner_id = ?',
          [note.id, userId]
        );
      }
    }

    // Get all folders in this space
    const foldersInSpace = await executeQuery<Array<{ id: number }>>(
      'SELECT id FROM sections WHERE notebook_id = ? AND user_id = ?',
      [spaceId, userId]
    );

    // Unpublish all folders (no recursion needed)
    for (const folder of foldersInSpace) {
      // First unpublish the folder itself
      await executeQuery(
        'UPDATE published_folders SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE section_id = ? AND owner_id = ?',
        [folder.id, userId]
      );
      // Then unpublish its notes
      await unpublishFolder(folder.id);
    }

    // Unpublish all notes without folders in this space
    const rootNotes = await executeQuery<Array<{ id: string }>>(
      `SELECT n.id FROM pages n
       WHERE n.section_id IS NULL AND n.user_id = ?
       AND EXISTS (
         SELECT 1 FROM sections f WHERE f.notebook_id = ? AND f.user_id = ?
       )`,
      [userId, spaceId, userId]
    );

    for (const note of rootNotes) {
      await executeQuery(
        'UPDATE published_notes SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND owner_id = ?',
        [note.id, userId]
      );
    }

    // Unpublish the space itself
    await executeQuery(
      'UPDATE published_spaces SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE notebook_id = ? AND owner_id = ?',
      [spaceId, userId]
    );

    return { success: true, message: 'Space and all its contents unpublished successfully' };
  } catch (error: any) {
    console.error('Error unpublishing space:', error);
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to unpublish space'
    });
  }
});

