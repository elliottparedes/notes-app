import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

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
    // Verify folder ownership
    const folderResults = await executeQuery<FolderOwnerRow[]>(
      'SELECT user_id FROM folders WHERE id = ?',
      [folderId]
    );

    const folder = folderResults[0];

    if (!folder || folder.user_id !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized to unpublish this folder'
      });
    }

    // Recursive function to unpublish all notes in folder and subfolders
    async function unpublishFolderRecursive(currentFolderId: number) {
      // Unpublish all notes in this folder
      const notesInFolder = await executeQuery<Array<{ id: string }>>(
        'SELECT id FROM notes WHERE folder_id = ? AND user_id = ?',
        [currentFolderId, userId]
      );

      for (const note of notesInFolder) {
        await executeQuery(
          'UPDATE published_notes SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE note_id = ? AND owner_id = ?',
          [note.id, userId]
        );
      }

      // Get all subfolders
      const subfolders = await executeQuery<Array<{ id: number }>>(
        'SELECT id FROM folders WHERE parent_id = ? AND user_id = ?',
        [currentFolderId, userId]
      );

      // Recursively unpublish subfolders and their contents
      for (const subfolder of subfolders) {
        // First unpublish the subfolder itself
        await executeQuery(
          'UPDATE published_folders SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ? AND owner_id = ?',
          [subfolder.id, userId]
        );
        // Then recursively unpublish its contents
        await unpublishFolderRecursive(subfolder.id);
      }
    }

    // Unpublish the folder itself
    await executeQuery(
      'UPDATE published_folders SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ? AND owner_id = ?',
      [folderId, userId]
    );

    // Recursively unpublish all notes and subfolders
    await unpublishFolderRecursive(folderId);

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

