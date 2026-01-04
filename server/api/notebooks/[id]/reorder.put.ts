import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';
import { canAccessContent, getAllAccessibleUserIds } from '~/server/utils/sharing';
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

    // Get the space to verify it exists
    const spaceResults = await executeQuery<Array<{ id: number; user_id: number }>>(
      'SELECT id, user_id FROM notebooks WHERE id = ?',
      [spaceId]
    );

    if (spaceResults.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Space not found'
      });
    }

    // Check if user has access to this space
    const spaceOwnerId = spaceResults[0].user_id;
    const hasAccess = await canAccessContent(spaceOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      });
    }

    // Get all spaces the user can access
    const accessibleUserIds = await getAllAccessibleUserIds(userId);
    const placeholders = accessibleUserIds.map(() => '?').join(',');
    const spaces = await executeQuery<Space[]>(
      `SELECT id FROM notebooks WHERE user_id IN (${placeholders}) ORDER BY created_at ASC`,
      accessibleUserIds
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




