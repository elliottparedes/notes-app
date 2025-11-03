import type { CreateNoteDto, Note } from '../../../models';
import type { ResultSetHeader } from 'mysql2';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { randomUUID } from 'crypto';

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
    // Generate UUID for the new note
    const noteId = randomUUID();

    // Prepare tags as JSON
    const tagsJson = body.tags && body.tags.length > 0 
      ? JSON.stringify(body.tags) 
      : null;

    // Insert note with UUID
    await executeQuery<ResultSetHeader>(
      'INSERT INTO notes (id, user_id, title, content, tags, is_favorite, folder, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        noteId,
        userId,
        body.title,
        body.content || null,
        tagsJson,
        body.is_favorite || false,
        body.folder || null,
        body.folder_id || null
      ]
    );

    // Fetch created note
    const rows = await executeQuery<NoteRow[]>(
      'SELECT * FROM notes WHERE id = ?',
      [noteId]
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
      folder_id: row.folder_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_shared: false, // New notes are not shared by default
      share_permission: undefined // Creator has full ownership, not a shared permission
    };

    // Auto-publish note if parent folder or space is published
    if (body.folder_id) {
      // Check if folder is published
      const [publishedFolder] = await executeQuery<Array<{ share_id: string }>>(
        'SELECT share_id FROM published_folders WHERE folder_id = ? AND owner_id = ? AND is_active = TRUE',
        [body.folder_id, userId]
      );

      if (publishedFolder.length > 0) {
        // Auto-publish the note
        const { randomUUID } = await import('crypto');
        const noteShareId = randomUUID();
        await executeQuery(
          'INSERT INTO published_notes (note_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
          [noteId, noteShareId, userId]
        );
      } else {
        // Check if parent space is published
        const [folder] = await executeQuery<Array<{ space_id: number }>>(
          'SELECT space_id FROM folders WHERE id = ?',
          [body.folder_id]
        );

        if (folder && folder.space_id) {
          const [publishedSpace] = await executeQuery<Array<{ share_id: string }>>(
            'SELECT share_id FROM published_spaces WHERE space_id = ? AND owner_id = ? AND is_active = TRUE',
            [folder.space_id, userId]
          );

          if (publishedSpace.length > 0) {
            // Auto-publish the note
            const { randomUUID } = await import('crypto');
            const noteShareId = randomUUID();
            await executeQuery(
              'INSERT INTO published_notes (note_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
              [noteId, noteShareId, userId]
            );
          }
        }
      }
    } else {
      // Note without folder - check if current space is published
      const spacesStore = await import('~/stores/spaces').then(m => m.useSpacesStore());
      // We can't easily access store here, so we'll check via user's current space
      // For now, skip auto-publish for root notes without folders
      // This can be enhanced if needed
    }

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

