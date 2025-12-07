import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';
import type { Space } from '~/models';

interface ReorderDto {
  newIndex: number;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const spaceId = parseInt(event.context.params?.id || '0');
  
  if (!spaceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid space ID'
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

    // Get the space to verify ownership
    const spaceResults = await executeQuery<Space[]>(
      'SELECT id FROM spaces WHERE id = ? AND user_id = ?',
      [spaceId, userId]
    );

    if (spaceResults.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    // Get all spaces for the user
    const spaces = await executeQuery<Space[]>(
      'SELECT id FROM spaces WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );

    // Get user's current space order
    const userResults = await executeQuery<Array<{ space_order: string | null }>>(
      'SELECT space_order FROM users WHERE id = ?',
      [userId]
    );

    let currentOrder = parseJsonField<number[]>(userResults[0]?.space_order) || [];
    
    // Ensure it's an array
    if (!Array.isArray(currentOrder)) {
      currentOrder = [];
    }
    
    // Ensure all spaces are in the order array
    spaces.forEach(space => {
      if (!currentOrder.includes(space.id)) {
        currentOrder.push(space.id);
      }
    });
    
    // Remove any IDs that are no longer spaces
    const spaceIds = new Set(spaces.map(s => s.id));
    currentOrder = currentOrder.filter(id => spaceIds.has(id));

    // Find the current index
    const currentIndex = currentOrder.indexOf(spaceId);
    
    if (currentIndex === -1) {
      // Should not happen due to logic above
      currentOrder.push(spaceId);
    }

    // Validate new index
    if (body.newIndex < 0 || body.newIndex >= currentOrder.length) {
       // Cap it if out of bounds, or throw error. 
       // For robustness, let's just clamp it or throw if wildly off.
       // Throwing is safer to catch bugs.
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be within bounds of space count'
      });
    }

    // Move the space to the new position
    if (currentIndex !== -1) {
      const [movedSpace] = currentOrder.splice(currentIndex, 1);
      currentOrder.splice(body.newIndex, 0, movedSpace);
    }

    // Save to database
    await executeQuery(
      'UPDATE users SET space_order = ? WHERE id = ?',
      [JSON.stringify(currentOrder), userId]
    );

    return {
      success: true,
      message: 'Space reordered',
      space_order: currentOrder
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Reorder space error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder space'
    });
  }
});




