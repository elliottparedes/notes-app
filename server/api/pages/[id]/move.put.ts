import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';

interface MoveDto {
  newFolderId: number | null; // null for root level
  newIndex?: number; // Optional: position within the new folder
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid note ID'
    });
  }

  try {
    const body = await readBody<MoveDto>(event);
    
    console.log('[API] /api/notes/' + noteId + '/move', {
      userId,
      noteId,
      body,
      newFolderId: body.newFolderId,
      newIndex: body.newIndex
    });

    // Verify note exists and belongs to user
    const noteResults = await executeQuery<any[]>(
      'SELECT id, user_id, section_id FROM pages WHERE id = ? AND user_id = ?',
      [noteId, userId]
    );

    if (noteResults.length === 0) {
      console.error('[API] Note not found', { noteId, userId });
      throw createError({
        statusCode: 404,
        statusMessage: 'Note not found'
      });
    }

    const note = noteResults[0];
    const oldFolderId = note.section_id;
    
    console.log('[API] Note found', {
      noteId: note.id,
      oldFolderId,
      newFolderId: body.newFolderId,
      folderChanged: oldFolderId !== body.newFolderId
    });

    // If folder hasn't changed, this is just a reorder (use reorder endpoint instead)
    if (body.newFolderId === oldFolderId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Note is already in this folder. Use reorder endpoint instead.'
      });
    }

    // Verify new folder exists if provided
    // Note: We allow moving notes between folders in different spaces
    // The UI filters folders by space, but the API allows cross-space moves
    if (body.newFolderId !== null) {
      const folderResults = await executeQuery<any[]>(
        'SELECT id, user_id, notebook_id FROM sections WHERE id = ? AND user_id = ?',
        [body.newFolderId, userId]
      );

      if (folderResults.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Target folder not found'
        });
      }
    }

    // Update note's section_id
    console.log('[API] Updating note section_id', {
      noteId,
      oldFolderId,
      newFolderId: body.newFolderId
    });
    
    const updateResult = await executeQuery(
      'UPDATE pages SET section_id = ?, updated_at = NOW() WHERE id = ?',
      [body.newFolderId, noteId]
    );
    
    console.log('[API] Note updated in database', {
      noteId,
      newFolderId: body.newFolderId,
      updateResult
    });

    // Get user's current note order (handle missing column gracefully)
    let noteOrder: Record<string, string[]> = {};
    try {
      const userResults = await executeQuery<Array<{ note_order: string | null }>>(
        'SELECT note_order FROM users WHERE id = ?',
        [userId]
      );
      noteOrder = parseJsonField<Record<string, string[]>>(userResults[0]?.note_order) || {};
    } catch (err: any) {
      // If column doesn't exist yet, use empty object (will be created on save)
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        console.warn('note_order column not found, using empty object. Run migration 004_add_note_order.sql');
        noteOrder = {};
      } else {
        throw err;
      }
    }

    // Remove note from old folder's order
    const oldFolderKey = oldFolderId === null ? 'root' : `folder_${oldFolderId}`;
    if (noteOrder[oldFolderKey]) {
      noteOrder[oldFolderKey] = noteOrder[oldFolderKey].filter(id => id !== noteId);
      // Remove key if folder is now empty
      if (noteOrder[oldFolderKey].length === 0) {
        delete noteOrder[oldFolderKey];
      }
    }

    // Add note to new folder's order
    const newFolderKey = body.newFolderId === null ? 'root' : `folder_${body.newFolderId}`;
    let newFolderOrder = noteOrder[newFolderKey] || [];

    // Get current notes in new folder to initialize order if needed
    const folderCondition = body.newFolderId === null 
      ? 'section_id IS NULL' 
      : 'section_id = ?';
    const folderParams = body.newFolderId === null ? [userId] : [userId, body.newFolderId];
    
    const newFolderNotes = await executeQuery<any[]>(
      `SELECT id FROM pages WHERE user_id = ? AND ${folderCondition} AND id != ? ORDER BY created_at ASC`,
      [...folderParams, noteId]
    );

    // Initialize order with existing notes
    if (!noteOrder[newFolderKey]) {
      newFolderOrder = newFolderNotes.map(n => n.id);
    } else {
      // Ensure all existing notes are in order
      newFolderNotes.forEach(folderNote => {
        if (!newFolderOrder.includes(folderNote.id)) {
          newFolderOrder.push(folderNote.id);
        }
      });
      // Remove notes that are no longer in this folder
      const newFolderNoteIds = new Set([...newFolderNotes.map(n => n.id), noteId]);
      newFolderOrder = newFolderOrder.filter(id => newFolderNoteIds.has(id));
    }

    // Insert note at specified index or append
    if (typeof body.newIndex === 'number' && body.newIndex >= 0 && body.newIndex < newFolderOrder.length) {
      newFolderOrder.splice(body.newIndex, 0, noteId);
    } else {
      // Append to end if no index specified or invalid
      newFolderOrder.push(noteId);
    }

    noteOrder[newFolderKey] = newFolderOrder;

    // Save to database (handle missing column gracefully)
    try {
      await executeQuery(
        'UPDATE users SET note_order = ? WHERE id = ?',
        [JSON.stringify(noteOrder), userId]
      );
    } catch (err: any) {
      // If column doesn't exist yet, log warning but don't fail
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        console.warn('note_order column not found, cannot save order. Run migration 004_add_note_order.sql');
      } else {
        throw err;
      }
    }

    const response = {
      success: true,
      message: 'Note moved',
      note_order: noteOrder
    };
    
    console.log('[API] Move complete, returning response', {
      success: response.success,
      noteOrderKeys: Object.keys(response.note_order),
      noteId,
      newFolderId: body.newFolderId
    });
    
    return response;
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Move note error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to move note'
    });
  }
});

