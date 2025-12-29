import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import type { CreateKanbanCardDto, KanbanCard } from '~/models/Kanban';
import type { ResultSetHeader } from 'mysql2';

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
  const body = await readBody<CreateKanbanCardDto>(event);

  const { title, content, status, section_id, notebook_id } = body;

  if (!title || !status) {
    throw createError({
      statusCode: 400,
      message: 'Title and status are required'
    });
  }

  try {
    // Determine the next order for the card in the given status/folder/space
    const maxOrderRow = await executeQuery<{ max_order: number }[]>(
      `SELECT MAX(card_order) as max_order FROM kanban_cards WHERE user_id = ? AND status = ? AND section_id ${section_id ? '= ?' : 'IS NULL'} AND notebook_id ${notebook_id ? '= ?' : 'IS NULL'}`,
      [userId, status, ...(section_id ? [section_id] : []), ...(notebook_id ? [notebook_id] : [])]
    );
    const nextOrder = (maxOrderRow?.max_order || 0) + 1;

    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO kanban_cards (user_id, title, content, status, card_order, section_id, notebook_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, content || null, status, nextOrder, section_id || null, notebook_id || null]
    );

    const insertedId = result.insertId;

    const row = await executeQuery<KanbanCardRow[]>(
      `SELECT * FROM kanban_cards WHERE id = ?`,
      [insertedId]
    );

    if (!row) {
      throw createError({ statusCode: 500, message: 'Failed to retrieve created kanban card' });
    }

    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      status: row.status,
      card_order: row.card_order,
      section_id: row.section_id,
      notebook_id: row.notebook_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (error) {
    console.error('Create kanban card error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to create kanban card'
    });
  }
});
