import { requireAuth } from '../../utils/auth';
import { updatePageOrder } from '../../utils/order-persistence';

interface UpdatePageOrderDto {
  section_id: number | null;
  page_ids: string[];
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const body = await readBody<UpdatePageOrderDto>(event);

    if (!body || !Array.isArray(body.page_ids)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid page order data. Requires page_ids array'
      });
    }

    // Validate that all items are strings (UUIDs)
    if (!body.page_ids.every(id => typeof id === 'string')) {
      throw createError({
        statusCode: 400,
        message: 'Page IDs must be an array of strings'
      });
    }

    // section_id can be null for root pages
    const sectionId = body.section_id !== undefined ? body.section_id : null;

    await updatePageOrder(userId, sectionId, body.page_ids);

    return {
      success: true,
      section_id: sectionId,
      page_ids: body.page_ids
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update page order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update page order'
    });
  }
});
