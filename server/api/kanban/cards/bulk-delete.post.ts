import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<{ cardIds?: number[] }>(event);

  if (!body.cardIds || !Array.isArray(body.cardIds) || body.cardIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'An array of cardIds is required.',
    });
  }

  // Ensure all IDs are numbers
  const cardIds = body.cardIds.map(id => parseInt(id as any, 10)).filter(id => !isNaN(id));

  if (cardIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Invalid card IDs provided.',
    });
  }

  try {
    const placeholders = cardIds.map(() => '?').join(',');
    
    const result = await executeQuery<{ affectedRows: number }>(
      `DELETE FROM kanban_cards WHERE id IN (${placeholders}) AND user_id = ?`,
      [...cardIds, userId]
    );

    if (result.affectedRows === 0) {
      // This isn't necessarily an error, could be that cards were already deleted
      console.warn(`Bulk delete attempted, but no matching cards found for user ${userId}.`);
    }

    return { message: `${result.affectedRows} card(s) deleted successfully.` };
  } catch (error) {
    console.error('Bulk delete kanban cards error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to delete kanban cards',
    });
  }
});
