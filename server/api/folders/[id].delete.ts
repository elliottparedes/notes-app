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
    // Verify folder exists and belongs to user
    const folders = await executeQuery<Folder[]>(`
      SELECT id FROM folders
      WHERE id = ? AND user_id = ?
    `, [folderId, userId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    // Get all descendant folder IDs (for cascade deletion)
    const getDescendants = async (parentId: number): Promise<number[]> => {
      const children = await executeQuery<{ id: number }[]>(`
        SELECT id FROM folders WHERE parent_id = ?
      `, [parentId]);
      
      let descendants = children.map(c => c.id);
      
      for (const child of children) {
        const childDescendants = await getDescendants(child.id);
        descendants = descendants.concat(childDescendants);
      }
      
      return descendants;
    };

    const descendantIds = await getDescendants(folderId);
    const allFolderIds = [folderId, ...descendantIds];

    // Delete all notes in these folders
    if (allFolderIds.length > 0) {
      // Get note IDs that will be deleted (for cleaning up shared_notes)
      const notesInFolders = await executeQuery<{ id: string }[]>(`
        SELECT id FROM notes 
        WHERE folder_id IN (${allFolderIds.map(() => '?').join(',')}) AND user_id = ?
      `, [...allFolderIds, userId]);

      // Delete notes in these folders
      await executeQuery(`
        DELETE FROM notes 
        WHERE folder_id IN (${allFolderIds.map(() => '?').join(',')}) AND user_id = ?
      `, [...allFolderIds, userId]);

      // Delete shared note entries for these notes (if any)
      if (notesInFolders.length > 0) {
        const noteIds = notesInFolders.map(n => n.id);
        await executeQuery(`
          DELETE FROM shared_notes 
          WHERE note_id IN (${noteIds.map(() => '?').join(',')})
        `, noteIds);
      }

      // Delete all folders (cascade)
      await executeQuery(`
        DELETE FROM folders 
        WHERE id IN (${allFolderIds.map(() => '?').join(',')})
      `, allFolderIds);
    }

    return { success: true, deletedCount: allFolderIds.length };
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

