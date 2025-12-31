import type { Note } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { getAuthContext } from '../../utils/auth';
import { getAllAccessibleUserIds } from '../../utils/sharing';
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

export default defineEventHandler(async (event): Promise<Note[]> => {
  // Authenticate user and get auth context
  const authContext = await getAuthContext(event);
  const userId = authContext.userId;
  const isApiKeyRequest = authContext.authType === 'api_key';

  console.log('[Notes API] Auth type:', authContext.authType, '| isApiKeyRequest:', isApiKeyRequest);

  try {
    // Get all user IDs that this user can access (self + shared users)
    const accessibleUserIds = await getAllAccessibleUserIds(userId);

    // Fetch all notes from accessible users
    const placeholders = accessibleUserIds.map(() => '?').join(',');
    const rows = await executeQuery<NoteRow[]>(
      `SELECT id, user_id, title, content, tags, is_favorite, folder, section_id,
              created_at, updated_at, modified_by_id, modified_by_name
       FROM pages
       WHERE user_id IN (${placeholders})
       ORDER BY updated_at DESC`,
      accessibleUserIds
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

