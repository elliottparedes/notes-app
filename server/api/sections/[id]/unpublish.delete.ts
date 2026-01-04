import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { canAccessContent } from '~/server/utils/sharing';

interface FolderOwnerRow {
  user_id: number;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderId = parseInt(getRouterParam(event, 'id') || '0');

  if (!folderId) {
    throw createError({
      statusCode: 400,
      message: 'Folder ID is required'
    });
  }

  try {
    // Verify folder exists
    const folderResults = await executeQuery<FolderOwnerRow[]>(
      'SELECT user_id FROM sections WHERE id = ?',
      [folderId]
    );

    const folder = folderResults[0];

    if (!folder) {
      throw createError({
        statusCode: 404,
        message: 'Folder not found'
      });
    }

    // Check if user has access to this folder
    const hasAccess = await canAccessContent(folder.user_id, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized to unpublish this folder'
      });
    }

    const folderOwnerId = folder.user_id;

    // Unpublish all notes in this folder (no subfolders)
    const notesInFolder = await executeQuery<Array<{ id: string }>>(
      'SELECT id FROM pages WHERE section_id = ? AND user_id = ?',
      [folderId, folderOwnerId]
    );

    for (const note of notesInFolder) {
      await executeQuery(
        'UPDATE published_notes SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND owner_id = ?',
        [note.id, folderOwnerId]
      );
    }

    // Unpublish the folder itself
    await executeQuery(
      'UPDATE published_sections SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE section_id = ? AND owner_id = ?',
      [folderId, folderOwnerId]
    );

    return { success: true, message: 'Folder and all its contents unpublished successfully' };
  } catch (error: any) {
    console.error('Error unpublishing folder:', error);
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to unpublish folder'
    });
  }
});

