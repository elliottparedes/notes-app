import { requireAuth } from '../../utils/auth';
import { getSectionOrder } from '../../utils/order-persistence';

interface FolderOrderResponse {
  folder_order: string[] | null;
}

export default defineEventHandler(async (event): Promise<FolderOrderResponse> => {
  const userId = await requireAuth(event);

  try {
    // Get all section orders across all notebooks
    const orders = await getSectionOrder(userId);

    // Convert to old format (array of section IDs as strings)
    const folderOrder = orders
      .sort((a, b) => {
        // Sort by notebook first, then by position within notebook
        if (a.notebook_id !== b.notebook_id) {
          return a.notebook_id - b.notebook_id;
        }
        return a.position - b.position;
      })
      .map(order => order.section_id.toString());

    return {
      folder_order: folderOrder.length > 0 ? folderOrder : null
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Get folder order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve folder order'
    });
  }
});
