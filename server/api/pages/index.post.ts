import type { CreatePageDto, Page } from '../../../models';
import type { ResultSetHeader } from 'mysql2';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { canAccessContent } from '../../utils/sharing';
import { randomUUID } from 'crypto';

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
  modified_by_id: number | null;
  modified_by_name: string | null;
}

export default defineEventHandler(async (event): Promise<Page> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const body = await readBody<CreatePageDto>(event);

  // Validate input
  let title = body.title;
  if (!title || title.trim() === '') {
    title = 'Untitled';
  }

  try {
    // If section_id is provided, validate access and get section owner
    let noteOwnerId = userId;
    if (body.section_id) {
      const sections = await executeQuery<Array<{ user_id: number }>>(
        'SELECT user_id FROM sections WHERE id = ?',
        [body.section_id]
      );

      if (sections.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Section not found'
        });
      }

      const sectionOwnerId = sections[0].user_id;

      // Check if user has access to this section
      const hasAccess = await canAccessContent(sectionOwnerId, userId);
      if (!hasAccess) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Access denied to this section'
        });
      }

      // Use section owner's ID for the note to maintain consistency
      noteOwnerId = sectionOwnerId;
    }

    // Get user's name for modification tracking
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Generate UUID for the new note
    const noteId = randomUUID();

    // Prepare tags as JSON
    const tagsJson = body.tags && body.tags.length > 0
      ? JSON.stringify(body.tags)
      : null;

    // Insert note with UUID and modification tracking
    await executeQuery<ResultSetHeader>(
      'INSERT INTO pages (id, user_id, title, content, tags, section_id, modified_by_id, modified_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        noteId,
        noteOwnerId,
        title,
        body.content || null,
        tagsJson,
        body.section_id || null,
        userId,
        userName
      ]
    );

    // Fetch created note
    const rows = await executeQuery<NoteRow[]>(
      'SELECT * FROM pages WHERE id = ?',
      [noteId]
    );

    const row = rows[0];
    if (!row) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create note'
      });
    }

    // Transform to Page object
    const note: Page = {
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
      modified_by_id: row.modified_by_id || undefined,
      modified_by_name: row.modified_by_name || undefined
    };

    // Track note creation in analytics (fire and forget)
    try {
      await executeQuery(
        `INSERT INTO analytics_events (user_id, event_type, event_data, created_at) 
         VALUES (?, ?, ?, NOW())`,
        [
          userId,
          'note_created',
          JSON.stringify({ 
            page_id: note.id, 
            title: note.title,
            section_id: note.section_id || null
          })
        ]
      );
    } catch (error) {
      // Ignore analytics errors - don't break note creation
      console.error('Analytics tracking error:', error);
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

