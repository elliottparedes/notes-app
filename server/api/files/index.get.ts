import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { getPresignedUrl } from '../../utils/minio';

interface FileRow {
  id: string;
  user_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  folder_path: string;
  created_at: Date;
  updated_at: Date;
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now();
  console.log('[FILES API] Starting fetch files...');

  const userId = await requireAuth(event);
  const query = getQuery(event);
  const folderPath = (query.folder as string) || '/';

  console.log(`[FILES API] Auth complete (${Date.now() - startTime}ms), userId: ${userId}, folder: ${folderPath}`);

  try {
    const queryStart = Date.now();
    const rows = await executeQuery<FileRow[]>(
      `SELECT * FROM files
       WHERE user_id = ? AND folder_path = ? AND file_name != '.folder'
       ORDER BY created_at DESC`,
      [userId, folderPath]
    );
    console.log(`[FILES API] Database query complete (${Date.now() - queryStart}ms), found ${rows.length} files`);

    // Don't generate presigned URLs on list - only when needed for download/preview
    const files = rows.map((row) => ({
      id: row.id,
      file_name: row.file_name,
      file_path: row.file_path,
      file_size: row.file_size,
      mime_type: row.mime_type,
      folder_path: row.folder_path,
      download_url: null, // Generate on-demand when needed
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    console.log(`[FILES API] Total time: ${Date.now() - startTime}ms`);
    return { files };
  } catch (error: unknown) {
    console.error('Fetch files error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch files'
    });
  }
});

