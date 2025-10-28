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

    // Update all notes in these folders to have no folder
    if (allFolderIds.length > 0) {
      await executeQuery(`
        UPDATE notes 
        SET folder_id = NULL, folder = NULL
        WHERE folder_id IN (${allFolderIds.map(() => '?').join(',')})
      `, allFolderIds);

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

