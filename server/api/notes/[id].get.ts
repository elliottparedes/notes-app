import type { Note } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { getAuthContext } from '../../utils/auth';
import { canAccessContent } from '../../utils/sharing';
import { transformContentForApiResponse } from '../../utils/markdown';

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

export default defineEventHandler(async (event): Promise<Note> => {
  // Authenticate user and get auth context
  const authContext = await getAuthContext(event);
  const userId = authContext.userId;
  const isApiKeyRequest = authContext.authType === 'api_key';
  const noteId = getRouterParam(event, 'id');

  console.log('[Notes API - Single] Auth type:', authContext.authType, '| isApiKeyRequest:', isApiKeyRequest);

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  try {
    // Fetch note
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
        statusCode: 404,
        message: 'Note not found'
      });
    }

    // Check if user has access to this note
    const hasAccess = await canAccessContent(row.user_id, userId);
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: 'Access denied'
      });
    }

    // Transform to Note object
    const note: Note = {
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

