import type { UpdatePageDto, Page } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { getAuthContext } from '../../utils/auth';
import { canAccessContent } from '../../utils/sharing';
import { logMultipleFieldChanges } from '../../utils/history-log';
import { transformContentFromApiRequest, transformContentForApiResponse } from '../../utils/markdown';

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
  // Authenticate user and get auth context
  const authContext = await getAuthContext(event);
  const userId = authContext.userId;
  const isApiKeyRequest = authContext.authType === 'api_key';
  const noteId = getRouterParam(event, 'id');
  const body = await readBody<UpdatePageDto>(event);

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  try {
    // Fetch existing note (for ownership check and history logging)
    const existingRows = await executeQuery<NoteRow[]>(
      'SELECT * FROM pages WHERE id = ?',
      [noteId]
    );

    if (existingRows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Note not found'
      });
    }

    const oldNote = existingRows[0];
    const noteOwnerId = oldNote.user_id;

    // Check if user has access to this note
    const hasAccess = await canAccessContent(noteOwnerId, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    // Get user's name for modification tracking
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.title !== undefined) {
      if (body.title.trim() === '') {
        throw createError({
          statusCode: 400,
          message: 'Title cannot be empty'
        });
      }
      updates.push('title = ?');
      values.push(body.title);
    }

    if (body.content !== undefined) {
      updates.push('content = ?');
      // Convert markdown to HTML for API key requests
      const content = isApiKeyRequest
        ? transformContentFromApiRequest(body.content)
        : body.content;
      values.push(content);
    }

    if (body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(body.tags && body.tags.length > 0 ? JSON.stringify(body.tags) : null);
    }

    if (body.is_favorite !== undefined) {
      updates.push('is_favorite = ?');
      values.push(body.is_favorite);
    }

    if (body.folder !== undefined) {
      updates.push('folder = ?');
      values.push(body.folder);
    }

    if (body.section_id !== undefined) {
      updates.push('section_id = ?');
      values.push(body.section_id);
    }

    if (updates.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No fields to update'
      });
    }

    // Add modification tracking
    updates.push('modified_by_id = ?');
    values.push(userId);
    updates.push('modified_by_name = ?');
    values.push(userName);

    // Add WHERE clause parameters
    values.push(noteId);

    // Execute update
    await executeQuery(
      `UPDATE pages SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated note
    const rows = await executeQuery<NoteRow[]>(
      `SELECT id, user_id, title, content, tags, is_favorite, folder, section_id,
              created_at, updated_at, modified_by_id, modified_by_name
       FROM pages
       WHERE id = ?
       LIMIT 1`,
      [noteId]
    );

    const row = rows[0];
    if (!row) {
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch updated note'
      });
    }

    // Transform to Page object
    const note: Page = {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      // Convert HTML to Markdown for API key requests
      content: isApiKeyRequest
        ? transformContentForApiResponse(row.content)
        : row.content,
      tags: parseJsonField<string[]>(row.tags),
      is_favorite: Boolean(row.is_favorite),
      folder: row.folder,
      section_id: row.section_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      modified_by_id: row.modified_by_id || undefined,
      modified_by_name: row.modified_by_name || undefined
    };

    // Log changes to history (fire and forget)
    logMultipleFieldChanges(
      'page',
      noteId,
      userId,
      userName,
      noteOwnerId,
      {
        title: oldNote.title,
        content: oldNote.content,
        tags: parseJsonField<string[]>(oldNote.tags),
        is_favorite: Boolean(oldNote.is_favorite),
        section_id: oldNote.section_id
      },
      {
        title: note.title,
        content: note.content,
        tags: note.tags,
        is_favorite: note.is_favorite,
        section_id: note.section_id
      },
      ['title', 'content', 'tags', 'is_favorite', 'section_id']
    ).catch(err => console.error('History log error:', err));

    return note;
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update note error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update note'
    });
  }
});

