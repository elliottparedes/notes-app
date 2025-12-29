import { requireAuth } from '../../utils/auth';
import { updateSectionOrder } from '../../utils/order-persistence';

interface UpdateSectionOrderDto {
  notebook_id: number;
  section_ids: number[];
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const body = await readBody<UpdateSectionOrderDto>(event);

    if (!body || !body.notebook_id || !Array.isArray(body.section_ids)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid section order data. Requires notebook_id and section_ids array'
      });
    }

    // Validate that all items are numbers
    if (!body.section_ids.every(id => typeof id === 'number')) {
      throw createError({
        statusCode: 400,
        message: 'Section IDs must be an array of numbers'
      });
    }

    await updateSectionOrder(userId, body.notebook_id, body.section_ids);

    return {
      success: true,
      notebook_id: body.notebook_id,
      section_ids: body.section_ids
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update section order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update section order'
    });
  }
});
