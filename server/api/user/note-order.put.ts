import { requireAuth } from '../../utils/auth';
import { updatePageOrder } from '../../utils/order-persistence';

interface UpdateNoteOrderDto {
  note_order: Record<string, string[]>;
}

interface NoteOrderResponse {
  note_order: Record<string, string[]>;
}

export default defineEventHandler(async (event): Promise<NoteOrderResponse> => {
  const userId = await requireAuth(event);

  try {
    const body = await readBody<UpdateNoteOrderDto>(event);

    if (!body || typeof body.note_order !== 'object') {
      throw createError({
        statusCode: 400,
        message: 'Invalid note order data'
      });
    }

    // Update orders for each folder/root context
    for (const [key, pageIds] of Object.entries(body.note_order)) {
      if (!Array.isArray(pageIds)) continue;

      // Determine section_id: "root" → null, "folder_N" → N
      let sectionId: number | null = null;
      if (key !== 'root') {
        const match = key.match(/folder_(\d+)/);
        if (match) {
          sectionId = parseInt(match[1]);
        }
      }

      // Update the order for this section
      await updatePageOrder(userId, sectionId, pageIds);
    }

    return {
      note_order: body.note_order
    };
  } catch (error: unknown) {
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
