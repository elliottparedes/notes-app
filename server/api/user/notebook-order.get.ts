import { requireAuth } from '../../utils/auth';
import { getNotebookOrder } from '../../utils/order-persistence';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const notebookIds = await getNotebookOrder(userId);

    return {
      notebook_ids: notebookIds
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Get notebook order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve notebook order'
    });
  }
});
