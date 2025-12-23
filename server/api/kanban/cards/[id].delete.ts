import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const cardId = parseInt(getRouterParam(event, 'id') as string);

  if (isNaN(cardId)) {
    throw createError({
      statusCode: 400,
      message: 'Card ID is required and must be a number'
    });
  }

  try {
    const result = await executeQuery<{ affectedRows: number }>(
      `DELETE FROM kanban_cards WHERE id = ? AND user_id = ?`,
      [cardId, userId]
    );

    if (result.affectedRows === 0) {
      throw createError({
        statusCode: 404,
        message: 'Kanban card not found or unauthorized'
      });
    }

    return { message: 'Kanban card deleted successfully' };
  } catch (error) {
    console.error('Delete kanban card error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to delete kanban card'
    });
  }
});