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
  folder_id: number | null;
  created_at: Date;
  updated_at: Date;
  share_permission: 'viewer' | 'editor' | null;
  is_shared: number;
}

export default defineEventHandler(async (event): Promise<Note> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  try {
    // Fetch note - include shared notes the user has access to
    const rows = await executeQuery<NoteRow[]>(
      `SELECT n.*, 
        sn.permission as share_permission,
        (SELECT COUNT(*) FROM shared_notes WHERE note_id = n.id) > 0 as is_shared
       FROM notes n
       LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
       WHERE n.id = ? AND (n.user_id = ? OR sn.shared_with_user_id IS NOT NULL)
       LIMIT 1`,
      [userId, noteId, userId]
    );

    const row = rows[0];
    
    if (!row) {
      throw createError({
        statusCode: 404,
        message: 'Note not found or access denied'
      });
    }

    // Transform to Note object
    const note: Note = {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      tags: parseJsonField<string[]>(row.tags),
      is_favorite: Boolean(row.is_favorite),
      folder: row.folder,
      folder_id: row.folder_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_shared: Boolean(row.is_shared),
      share_permission: row.share_permission || undefined
    };

    return note;
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Fetch note error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch note'
    });
  }
});

