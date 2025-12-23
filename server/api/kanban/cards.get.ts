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
  folder_id: number | null;
  space_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export default defineEventHandler(async (event): Promise<KanbanCard[]> => {
  const userId = await requireAuth(event);
  const query = getQuery(event);

  let sql = `SELECT * FROM kanban_cards WHERE user_id = ?`;
  const params: (string | number)[] = [userId];

  if (query.folder_id) {
    sql += ` AND folder_id = ?`;
    params.push(parseInt(query.folder_id as string));
  } else if (query.space_id) {
    // If filtering by space, get all folders in that space
    const folderRows = await executeQuery<{ id: number }[]>(
      `SELECT id FROM folders WHERE user_id = ? AND space_id = ?`,
      [userId, parseInt(query.space_id as string)]
    );
    const folderIds = folderRows.map(row => row.id);
    if (folderIds.length > 0) {
      sql += ` AND folder_id IN (${folderIds.map(() => '?').join(',')})`;
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
      folder_id: row.folder_id,
      space_id: row.space_id,
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
