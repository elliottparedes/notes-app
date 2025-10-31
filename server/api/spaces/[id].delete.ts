import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
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
    // Verify space exists and belongs to user
    const spaces = await executeQuery<Space[]>(`
      SELECT id FROM spaces 
      WHERE id = ? AND user_id = ?
    `, [spaceId, userId]);

    if (spaces.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    // Check if this is the user's only space
    const allSpaces = await executeQuery<any[]>(`
      SELECT id FROM spaces 
      WHERE user_id = ?
    `, [userId]);

    if (allSpaces.length <= 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete the last remaining space'
      });
    }

    // Get all folder IDs in this space (to delete notes in those folders)
    const foldersInSpace = await executeQuery<{ id: number }[]>(`
      SELECT id FROM folders 
      WHERE space_id = ? AND user_id = ?
    `, [spaceId, userId]);
    
    const folderIds = foldersInSpace.map(f => f.id);
    
    // Delete all notes that are in folders of this space
    // Only delete notes that belong to this user and are in these folders
    // First, get note IDs before deleting (for shared_notes cleanup)
    if (folderIds.length > 0) {
      // Get note IDs that will be deleted (for cleaning up shared_notes)
      const notesInFolders = await executeQuery<{ id: string }[]>(`
        SELECT id FROM notes 
        WHERE folder_id IN (${folderIds.map(() => '?').join(',')}) AND user_id = ?
      `, [...folderIds, userId]);
      
      // Delete notes in folders of this space
      await executeQuery(`
        DELETE FROM notes 
        WHERE folder_id IN (${folderIds.map(() => '?').join(',')}) AND user_id = ?
      `, [...folderIds, userId]);
      
      // Also delete shared note entries for these notes
      if (notesInFolders.length > 0) {
        const noteIds = notesInFolders.map(n => n.id);
        await executeQuery(`
          DELETE FROM shared_notes 
          WHERE note_id IN (${noteIds.map(() => '?').join(',')})
        `, noteIds);
      }
    }

    // Delete the space (cascade will delete all folders in this space)
    // Note: We already deleted notes, so cascade will just clean up folders
    await executeQuery(`
      DELETE FROM spaces 
      WHERE id = ? AND user_id = ?
    `, [spaceId, userId]);

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

