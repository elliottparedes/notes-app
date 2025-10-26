import type { CreateNoteDto, Note } from '../../../models';
import type { ResultSetHeader } from 'mysql2';
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

export default defineEventHandler(async (event): Promise<Note> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const body = await readBody<CreateNoteDto>(event);

  // Validate input
  if (!body.title || body.title.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Title is required'
    });
  }

  try {
    // Prepare tags as JSON
    const tagsJson = body.tags && body.tags.length > 0 
      ? JSON.stringify(body.tags) 
      : null;

    // Insert note
    const result = await executeQuery<ResultSetHeader>(
      'INSERT INTO notes (user_id, title, content, tags, is_favorite, folder) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        body.title,
        body.content || null,
        tagsJson,
        body.is_favorite || false,
        body.folder || null
      ]
    );

    // Fetch created note
    const rows = await executeQuery<NoteRow[]>(
      'SELECT * FROM notes WHERE id = ?',
      [result.insertId]
    );

    const row = rows[0];
    if (!row) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create note'
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
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    return note;
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Create note error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to create note'
    });
  }
});

