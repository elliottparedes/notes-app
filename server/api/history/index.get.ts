import { executeQuery, getDbPool } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { getAllAccessibleUserIds } from '../../utils/sharing';
import type { HistoryLogResponse, HistoryLogWithEntity } from '../../../models/HistoryLog';

interface HistoryLogRow {
  id: number;
  entity_type: 'page' | 'notebook' | 'section';
  entity_id: string;
  user_id: number;
  user_name: string;
  owner_id: number;
  action: 'create' | 'update' | 'delete';
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
  entity_title: string | null;
}

export default defineEventHandler(async (event): Promise<HistoryLogResponse> => {
  const userId = await requireAuth(event);
  const query = getQuery(event);

  // Parse filters
  const entityType = query.entity_type as string | undefined;
  const entityId = query.entity_id as string | undefined;
  const filterUserId = query.user_id ? parseInt(query.user_id as string) : undefined;
  const action = query.action as string | undefined;
  const limit = Math.min(parseInt(query.limit as string) || 50, 100);
  const offset = parseInt(query.offset as string) || 0;

  try {
    // Get all user IDs whose content this user can access
    const accessibleUserIds = await getAllAccessibleUserIds(userId);
    const placeholders = accessibleUserIds.map(() => '?').join(',');

    // Build query conditions
    const conditions: string[] = [`owner_id IN (${placeholders})`];
    const params: unknown[] = [...accessibleUserIds];

    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }
    if (entityId) {
      conditions.push('entity_id = ?');
      params.push(entityId);
    }
    if (filterUserId) {
      conditions.push('user_id = ?');
      params.push(filterUserId);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }

    const whereClause = conditions.join(' AND ');

    // Use query() instead of execute() for dynamic IN clause
    const pool = getDbPool();

    // Get total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM history_log WHERE ${whereClause}`,
      params
    );
    const total = (countRows as any)[0].total;

    // Get logs
    const [logRows] = await pool.query(
      `SELECT id, entity_type, entity_id, user_id, user_name, owner_id, action, field_name, old_value, new_value, created_at
       FROM history_log
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const logs = logRows as HistoryLogRow[];

    // Add entity_title property
    logs.forEach(log => { (log as any).entity_title = null; });

    // Fetch entity titles separately to avoid collation issues
    for (const log of logs) {
      try {
        if (log.entity_type === 'page') {
          const [page] = await executeQuery<[{ title: string }]>(
            'SELECT title FROM pages WHERE id = ?',
            [log.entity_id]
          );
          if (page) log.entity_title = page.title;
        } else if (log.entity_type === 'notebook') {
          const [notebook] = await executeQuery<[{ name: string }]>(
            'SELECT name FROM notebooks WHERE id = ?',
            [parseInt(log.entity_id)]
          );
          if (notebook) log.entity_title = notebook.name;
        } else if (log.entity_type === 'section') {
          const [section] = await executeQuery<[{ name: string }]>(
            'SELECT name FROM sections WHERE id = ?',
            [parseInt(log.entity_id)]
          );
          if (section) log.entity_title = section.name;
        }
      } catch (e) {
        // Entity may have been deleted, ignore
      }
    }

    // Transform to response format
    const transformedLogs: HistoryLogWithEntity[] = logs.map(log => ({
      id: log.id,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      user_id: log.user_id,
      user_name: log.user_name,
      owner_id: log.owner_id,
      action: log.action,
      field_name: log.field_name,
      old_value: log.old_value,
      new_value: log.new_value,
      created_at: log.created_at,
      entity_title: log.entity_title || undefined
    }));

    return {
      logs: transformedLogs,
      total,
      hasMore: offset + logs.length < total
    };
  } catch (error) {
    console.error('Error fetching history logs:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch history logs'
    });
  }
});
