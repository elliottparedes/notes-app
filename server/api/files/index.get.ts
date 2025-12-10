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
  const userId = await requireAuth(event);
  const query = getQuery(event);
  const folderPath = (query.folder as string) || '/';

  try {
    const rows = await executeQuery<FileRow[]>(
      `SELECT * FROM files 
       WHERE user_id = ? AND folder_path = ? AND file_name != '.folder'
       ORDER BY created_at DESC`,
      [userId, folderPath]
    );

    // Generate presigned URLs for each file
    const files = await Promise.all(
      rows.map(async (row) => {
        try {
          const downloadUrl = await getPresignedUrl(row.file_path, 3600);
          return {
            id: row.id,
            file_name: row.file_name,
            file_path: row.file_path,
            file_size: row.file_size,
            mime_type: row.mime_type,
            folder_path: row.folder_path,
            download_url: downloadUrl,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        } catch (error) {
          console.error(`Failed to generate presigned URL for ${row.file_path}:`, error);
          return {
            id: row.id,
            file_name: row.file_name,
            file_path: row.file_path,
            file_size: row.file_size,
            mime_type: row.mime_type,
            folder_path: row.folder_path,
            download_url: null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        }
      })
    );

    return { files };
  } catch (error: unknown) {
    console.error('Fetch files error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch files'
    });
  }
});

