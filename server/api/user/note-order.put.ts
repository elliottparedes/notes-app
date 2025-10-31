import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface UpdateNoteOrderDto {
  note_order: Record<string, string[]>;
}

interface NoteOrderResponse {
  note_order: Record<string, string[]>;
}

export default defineEventHandler(async (event): Promise<NoteOrderResponse> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Parse request body
    const body = await readBody<UpdateNoteOrderDto>(event);

    if (!body || typeof body.note_order !== 'object' || Array.isArray(body.note_order)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid note order data'
      });
    }

    // Validate that all values are arrays of strings
    for (const [key, value] of Object.entries(body.note_order)) {
      if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw createError({
          statusCode: 400,
          message: 'Note order must be an object with string arrays as values'
        });
      }
    }

    // Convert object to JSON string for MySQL
    const noteOrderJson = JSON.stringify(body.note_order);

    // Update note order (handle missing column gracefully)
    try {
      await executeQuery(
        'UPDATE users SET note_order = ? WHERE id = ?',
        [noteOrderJson, userId]
      );
    } catch (err: any) {
      // If column doesn't exist yet, throw error asking to run migration
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        throw createError({
          statusCode: 500,
          message: 'note_order column not found. Please run migration 004_add_note_order.sql'
        });
      }
      throw err;
    }

    return {
      note_order: body.note_order
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update note order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update note order'
    });
  }
});

