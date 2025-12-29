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
      SELECT id FROM sections
      WHERE id = ? AND user_id = ?
    `, [folderId, userId]);

    if (folders.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    // Get note IDs that will be deleted (for cleaning up shared_notes)
    const notesInFolder = await executeQuery<{ id: string }[]>(`
      SELECT id FROM pages 
      WHERE section_id = ? AND user_id = ?
    `, [folderId, userId]);

    // Delete notes in this folder
    await executeQuery(`
      DELETE FROM pages 
      WHERE section_id = ? AND user_id = ?
    `, [folderId, userId]);

    // Delete shared note entries for these notes (if any)
    if (notesInFolder.length > 0) {
      const noteIds = notesInFolder.map(n => n.id);
      await executeQuery(`
        DELETE FROM shared_notes 
        WHERE page_id IN (${noteIds.map(() => '?').join(',')})
      `, noteIds);
    }

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

