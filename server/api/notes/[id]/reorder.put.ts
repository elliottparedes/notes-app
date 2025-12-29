import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';

interface ReorderDto {
  newIndex: number;
  folderId: number | null; // null for root level notes
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
    const body = await readBody<ReorderDto>(event);

    if (typeof body.newIndex !== 'number' || body.newIndex < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be a non-negative number'
      });
    }

    // Verify note exists and belongs to user
    const noteResults = await executeQuery<any[]>(
      'SELECT id, user_id, section_id FROM pages WHERE id = ? AND user_id = ?',
      [noteId, userId]
    );

    if (noteResults.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Note not found'
      });
    }

    const note = noteResults[0];
    const currentFolderId = note.section_id;

    // Validate section_id matches (note must be in the folder we're reordering)
    if (body.folderId !== currentFolderId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Note section_id does not match provided folderId'
      });
    }

    // Get all notes in this folder (excluding shared notes)
    const folderCondition = body.folderId === null 
      ? 'section_id IS NULL' 
      : 'section_id = ?';
    
    const folderParams = body.folderId === null ? [userId] : [userId, body.folderId];
    
    const folderNotes = await executeQuery<any[]>(
      `SELECT id FROM pages WHERE user_id = ? AND ${folderCondition} ORDER BY created_at ASC`,
      folderParams
    );

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

    // Create a key for this folder
    const folderKey = body.folderId === null ? 'root' : `folder_${body.folderId}`;

    // Get current order for this folder or create default order
    let currentOrder = noteOrder[folderKey] || folderNotes.map(n => n.id);

    // Ensure all notes in folder are in the order array
    folderNotes.forEach(folderNote => {
      if (!currentOrder.includes(folderNote.id)) {
        currentOrder.push(folderNote.id);
      }
    });

    // Remove any IDs that are no longer in this folder
    const folderNoteIds = new Set(folderNotes.map(n => n.id));
    currentOrder = currentOrder.filter(id => folderNoteIds.has(id));

    // Find the current index
    const currentIndex = currentOrder.indexOf(noteId);

    if (currentIndex === -1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Note not found in order'
      });
    }

    // Validate new index
    if (body.newIndex < 0 || body.newIndex >= currentOrder.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be within bounds of folder note count'
      });
    }

    // Move the note to the new position
    const [movedNote] = currentOrder.splice(currentIndex, 1);
    currentOrder.splice(body.newIndex, 0, movedNote);

    // Update note order
    noteOrder[folderKey] = currentOrder;

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

    return {
      success: true,
      message: 'Note reordered',
      note_order: noteOrder
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Reorder note error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder note'
    });
  }
});

