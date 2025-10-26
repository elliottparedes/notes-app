import type { Note } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface NoteRow {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  tags: string | null;
  is_favorite: number;
  folder: string | null;
  created_at: Date;
  updated_at: Date;
}

export default defineEventHandler(async (event): Promise<Note[]> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Fetch all notes for the user
    const rows = await executeQuery<NoteRow[]>(
      'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );

    // Transform database rows to Note objects
    const notes: Note[] = rows.map((row: NoteRow) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      tags: parseJsonField<string[]>(row.tags),
      is_favorite: Boolean(row.is_favorite),
      folder: row.folder,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return notes;
  } catch (error: unknown) {
    console.error('Fetch notes error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch notes'
    });
  }
});

