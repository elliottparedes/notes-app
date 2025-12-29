import { requireAuth } from '../../utils/auth';
import { getSectionOrder } from '../../utils/order-persistence';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const query = getQuery(event);
    const notebookId = query.notebook_id ? parseInt(query.notebook_id as string) : undefined;

    const orders = await getSectionOrder(userId, notebookId);

    return {
      sections: orders
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Get section order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve section order'
    });
  }
});
