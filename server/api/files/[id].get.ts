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
  const fileId = getRouterParam(event, 'id');

  if (!fileId) {
    throw createError({
      statusCode: 400,
      message: 'File ID is required'
    });
  }

  try {
    const rows = await executeQuery<FileRow[]>(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, userId]
    );

    if (rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'File not found'
      });
    }

    const file = rows[0];
    const downloadUrl = await getPresignedUrl(file.file_path, 3600);

    return {
      id: file.id,
      file_name: file.file_name,
      file_path: file.file_path,
      file_size: file.file_size,
      mime_type: file.mime_type,
      folder_path: file.folder_path,
      download_url: downloadUrl,
      created_at: file.created_at,
      updated_at: file.updated_at,
    };
  } catch (error: any) {
    console.error('Get file error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to get file'
    });
  }
});




