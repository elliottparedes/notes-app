import { requireAuth } from '../../utils/auth';
import { getPageOrder } from '../../utils/order-persistence';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const query = getQuery(event);

    // section_id can be null for root pages
    let sectionId: number | null = null;
    if (query.section_id) {
      const parsed = parseInt(query.section_id as string);
      sectionId = isNaN(parsed) ? null : parsed;
    }

    const orders = await getPageOrder(userId, sectionId);

    return {
      pages: orders
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Get page order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve page order'
    });
  }
});
