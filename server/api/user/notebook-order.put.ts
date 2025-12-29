import { requireAuth } from '../../utils/auth';
import { updateNotebookOrder } from '../../utils/order-persistence';

interface UpdateNotebookOrderDto {
  notebook_ids: number[];
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const body = await readBody<UpdateNotebookOrderDto>(event);

    if (!body || !Array.isArray(body.notebook_ids)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid notebook order data. Requires notebook_ids array'
      });
    }

    // Validate that all items are numbers
    if (!body.notebook_ids.every(id => typeof id === 'number')) {
      throw createError({
        statusCode: 400,
        message: 'Notebook IDs must be an array of numbers'
      });
    }

    await updateNotebookOrder(userId, body.notebook_ids);

    return {
      success: true,
      notebook_ids: body.notebook_ids
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update notebook order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update notebook order'
    });
  }
});
