import { requireAuth } from '../../utils/auth';
import { getPageOrder } from '../../utils/order-persistence';
import { executeQuery } from '../../utils/db';

interface NoteOrderResponse {
  note_order: Record<string, string[]> | null;
}

export default defineEventHandler(async (event): Promise<NoteOrderResponse> => {
  const userId = await requireAuth(event);

  try {
    // Get all sections for this user to build the complete note order map
    const sections = await executeQuery<Array<{ id: number }>>(
      'SELECT id FROM sections WHERE user_id = ?',
      [userId]
    );

    const noteOrder: Record<string, string[]> = {};

    // Get root pages (section_id = null)
    const rootOrders = await getPageOrder(userId, null);
    if (rootOrders.length > 0) {
      noteOrder.root = rootOrders
        .sort((a, b) => a.position - b.position)
        .map(o => o.page_id);
    }

    // Get pages for each section
    for (const section of sections) {
      const sectionOrders = await getPageOrder(userId, section.id);
      if (sectionOrders.length > 0) {
        noteOrder[`folder_${section.id}`] = sectionOrders
          .sort((a, b) => a.position - b.position)
          .map(o => o.page_id);
      }
    }

    return {
      note_order: Object.keys(noteOrder).length > 0 ? noteOrder : null
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Get note order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve note order'
    });
  }
});
