import type { Note } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface NoteRow {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string | null;
  is_favorite: number;
  folder: string | null;
  section_id: number | null;
  created_at: Date;
  updated_at: Date;
  share_permission: 'viewer' | 'editor' | null;
  is_shared: number;
}

export default defineEventHandler(async (event): Promise<Note[]> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Fetch all notes for the user (owned + shared with them)
    const rows = await executeQuery<NoteRow[]>(
      `SELECT DISTINCT n.*, 
        sn.permission as share_permission,
        (SELECT COUNT(*) FROM shared_pages WHERE page_id = n.id) > 0 as is_shared
       FROM pages n
       LEFT JOIN shared_pages sn ON n.id = sn.page_id AND sn.shared_with_user_id = ?
       WHERE n.user_id = ? OR sn.shared_with_user_id IS NOT NULL
       ORDER BY n.updated_at DESC`,
      [userId, userId]
    );

    if (!Array.isArray(rows)) {
      console.error('Fetch notes error: Expected array, got:', typeof rows);
      throw new Error('Database returned unexpected format');
    }

    // Transform database rows to Note objects
    const notes: Note[] = rows.map((row: NoteRow) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      tags: parseJsonField<string[]>(row.tags),
      is_favorite: Boolean(row.is_favorite),
      folder: row.folder,
      section_id: row.section_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_shared: Boolean(row.is_shared),
      share_permission: row.share_permission || undefined
    }));

    return notes;
  } catch (error: any) {
    console.error('Fetch notes error:', error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch notes: ${error.message}`
    });
  }
});

