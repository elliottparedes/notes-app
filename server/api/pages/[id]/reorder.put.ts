import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { getPageOrder, updatePageOrder } from '~/server/utils/order-persistence';

interface ReorderDto {
  newIndex: number;
  section_id: number | null; // null for root level pages
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const pageId = getRouterParam(event, 'id');

  if (!pageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid page ID'
    });
  }

  try {
    const body = await readBody<ReorderDto>(event);

    if (typeof body.newIndex !== 'number' || body.newIndex < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be a non-negative number'
      });
    }

    // Verify page exists and belongs to user
    const pageResults = await executeQuery<any[]>(
      'SELECT id, user_id, section_id FROM pages WHERE id = ? AND user_id = ?',
      [pageId, userId]
    );

    if (pageResults.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Page not found'
      });
    }

    const page = pageResults[0];
    const currentSectionId = page.section_id;

    // Validate section_id matches (page must be in the section we're reordering)
    if (body.section_id !== currentSectionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Page section_id does not match provided section_id'
      });
    }

    // Get all pages in this section
    const sectionCondition = body.section_id === null
      ? 'section_id IS NULL'
      : 'section_id = ?';

    const sectionParams = body.section_id === null ? [userId] : [userId, body.section_id];

    const sectionPages = await executeQuery<any[]>(
      `SELECT id FROM pages WHERE user_id = ? AND ${sectionCondition} ORDER BY created_at ASC`,
      sectionParams
    );

    // Get current order from normalized table
    const currentOrderData = await getPageOrder(userId, body.section_id);
    let currentOrder = currentOrderData.map(item => item.page_id);

    console.log('[reorder] currentOrderData from DB:', currentOrderData);

    // If no order data exists, use default order from database
    if (currentOrder.length === 0) {
      console.log('[reorder] No order data found, using default order from pages table');
      currentOrder = sectionPages.map(p => p.id);
    }

    console.log('[reorder] Current order:', currentOrder);
    console.log('[reorder] Requested newIndex:', body.newIndex);
    console.log('[reorder] Page being moved:', pageId);

    // Ensure all pages in section are in the order array
    sectionPages.forEach(sectionPage => {
      if (!currentOrder.includes(sectionPage.id)) {
        currentOrder.push(sectionPage.id);
      }
    });

    // Remove any IDs that are no longer in this section
    const sectionPageIds = new Set(sectionPages.map(p => p.id));
    currentOrder = currentOrder.filter(id => sectionPageIds.has(id));

    // Find the current index
    const currentIndex = currentOrder.indexOf(pageId);

    console.log('[reorder] currentIndex of page:', currentIndex);

    if (currentIndex === -1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Page not found in order'
      });
    }

    // Validate new index
    // Allow newIndex to equal currentOrder.length (append to end)
    if (body.newIndex < 0 || body.newIndex > currentOrder.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be within bounds of section page count'
      });
    }

    console.log('[reorder] Moving from index', currentIndex, 'to index', body.newIndex);

    // Move the page to the new position
    const [movedPage] = currentOrder.splice(currentIndex, 1);

    // When moving DOWN (to higher index), we need to adjust by -1
    // because removing the item shifted everything up
    let finalIndex = body.newIndex;
    if (body.newIndex > currentIndex) {
      finalIndex = body.newIndex - 1;
      console.log('[reorder] Moving DOWN, adjusting index from', body.newIndex, 'to', finalIndex);
    }

    // Clamp to valid range after removal
    finalIndex = Math.max(0, Math.min(finalIndex, currentOrder.length));

    console.log('[reorder] After removal, inserting at index:', finalIndex);

    currentOrder.splice(finalIndex, 0, movedPage);

    console.log('[reorder] Final order:', currentOrder);

    // Update order in normalized table
    await updatePageOrder(userId, body.section_id, currentOrder);

    return {
      success: true,
      message: 'Page reordered',
      page_ids: currentOrder
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Reorder page error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder page'
    });
  }
});

