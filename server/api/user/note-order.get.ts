import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface NoteOrderResponse {
  note_order: Record<string, string[]> | null;
}

export default defineEventHandler(async (event): Promise<NoteOrderResponse> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Fetch note order (handle missing column gracefully)
    let results: Array<{ note_order?: string | null }>;
    
    try {
      results = await executeQuery<Array<{ note_order: string | null }>>(
        'SELECT note_order FROM users WHERE id = ?',
        [userId]
      );
    } catch (err: any) {
      // If column doesn't exist yet, return null
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message?.includes('Unknown column')) {
        console.warn('note_order column not found, returning null. Run migration 004_add_note_order.sql');
        return {
          note_order: null
        };
      }
      throw err;
    }

    const result = results[0];
    
    if (!result) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

    return {
      note_order: parseJsonField<Record<string, string[]>>(result.note_order)
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Fetch note order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch note order'
    });
  }
});

