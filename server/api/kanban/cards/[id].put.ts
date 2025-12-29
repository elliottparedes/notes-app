import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import type { UpdateKanbanCardDto, KanbanCard } from '~/models/Kanban';

interface KanbanCardRow {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  status: string;
  card_order: number;
  section_id: number | null;
  notebook_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export default defineEventHandler(async (event): Promise<KanbanCard> => {
  const userId = await requireAuth(event);
  const cardId = parseInt(getRouterParam(event, 'id') as string);
  const body = await readBody<UpdateKanbanCardDto>(event);

  if (isNaN(cardId)) {
    throw createError({
      statusCode: 400,
      message: 'Card ID is required and must be a number'
    });
  }

  // Check if card exists and belongs to the user
  const existingCard = await executeQuery<KanbanCardRow[]>(
    `SELECT id FROM kanban_cards WHERE id = ? AND user_id = ?`,
    [cardId, userId]
  );

  if (!existingCard) {
    throw createError({
      statusCode: 404,
      message: 'Kanban card not found or unauthorized'
    });
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.title !== undefined) {
    if (body.title.trim() === '') {
      throw createError({ statusCode: 400, message: 'Title cannot be empty' });
    }
    updates.push('title = ?');
    values.push(body.title);
  }
  if (body.content !== undefined) {
    updates.push('content = ?');
    values.push(body.content);
  }
  if (body.status !== undefined) {
    updates.push('status = ?');
    values.push(body.status);
  }
  if (body.card_order !== undefined) {
    updates.push('card_order = ?');
    values.push(body.card_order);
  }

  if (updates.length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' });
  }

  await executeQuery(
    `UPDATE kanban_cards SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
    [...values, cardId, userId]
  );

  const updatedRow = await executeQuery<KanbanCardRow[]>(
    `SELECT * FROM kanban_cards WHERE id = ?`,
    [cardId]
  );

  if (!updatedRow) {
    throw createError({ statusCode: 500, message: 'Failed to retrieve updated kanban card' });
  }

  return {
    id: updatedRow.id,
    user_id: updatedRow.user_id,
    title: updatedRow.title,
    content: updatedRow.content,
    status: updatedRow.status,
    card_order: updatedRow.card_order,
    section_id: updatedRow.section_id,
    notebook_id: updatedRow.notebook_id,
    created_at: updatedRow.created_at,
    updated_at: updatedRow.updated_at,
  };
});
