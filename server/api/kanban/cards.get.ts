import { executeQuery, parseJsonField } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import type { KanbanCard } from '~/models/Kanban';

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

export default defineEventHandler(async (event): Promise<KanbanCard[]> => {
  const userId = await requireAuth(event);
  const query = getQuery(event);

  let sql = `SELECT * FROM kanban_cards WHERE user_id = ?`;
  const params: (string | number)[] = [userId];

  if (query.section_id) {
    sql += ` AND section_id = ?`;
    params.push(parseInt(query.section_id as string));
  } else if (query.notebook_id) {
    // If filtering by space, get all folders in that space
    const folderRows = await executeQuery<{ id: number }[]>(
      `SELECT id FROM sections WHERE user_id = ? AND notebook_id = ?`,
      [userId, parseInt(query.notebook_id as string)]
    );
    const folderIds = folderRows.map(row => row.id);
    if (folderIds.length > 0) {
      sql += ` AND section_id IN (${folderIds.map(() => '?').join(',')})`;
      params.push(...folderIds);
    } else {
      // No folders in space, no cards to show for this space
      return [];
    }
  }

  sql += ` ORDER BY card_order ASC`;

  try {
    const rows = await executeQuery<KanbanCardRow[]>(sql, params);

    return rows.map(row => ({
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
    }));
  } catch (error) {
    console.error('Fetch kanban cards error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch kanban cards'
    });
  }
});
