import type { UpdatePageDto, Note } from '../../../models';
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
}

export default defineEventHandler(async (event): Promise<Page> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');
  const body = await readBody<UpdatePageDto>(event);

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  try {
    // Check if note exists and user has permission (owner or shared with editor permission)
    const existingRows = await executeQuery<any[]>(
      `SELECT n.id, n.user_id, sn.permission 
       FROM pages n
       LEFT JOIN shared_pages sn ON n.id = sn.page_id AND sn.shared_with_user_id = ?
       WHERE n.id = ? AND (n.user_id = ? OR sn.permission = 'editor')`,
      [userId, noteId, userId]
    );

    if (existingRows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Note not found or you do not have permission to edit'
      });
    }

    const noteOwnerId = existingRows[0].user_id;

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
      values.push(body.content);
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

    // Add WHERE clause parameters - use noteId only (allow shared editors to update)
    values.push(noteId);

    // Execute update
    await executeQuery(
      `UPDATE pages SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated note WITH sharing information
    const rows = await executeQuery<any[]>(
      `SELECT n.*, 
        sn.permission as share_permission,
        (SELECT COUNT(*) FROM shared_pages WHERE page_id = n.id) > 0 as is_shared
       FROM pages n
       LEFT JOIN shared_pages sn ON n.id = sn.page_id AND sn.shared_with_user_id = ?
       WHERE n.id = ?
       LIMIT 1`,
      [userId, noteId]
    );

    const row = rows[0];
    if (!row) {
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch updated note'
      });
    }

    // Transform to Note object
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
      is_shared: Boolean(row.is_shared),
      share_permission: row.share_permission || undefined
    };

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

