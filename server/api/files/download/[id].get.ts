import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import { getPresignedUrl } from '../../../utils/minio';

interface FileRow {
  id: string;
  user_id: number;
  file_name: string;
  file_path: string;
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
    
    // Generate presigned URL (valid for 1 hour)
    const downloadUrl = await getPresignedUrl(file.file_path, 3600);

    // Return the presigned URL and filename as JSON so the client can use it with auth headers
    return { 
      downloadUrl,
      fileName: file.file_name
    };
  } catch (error: any) {
    console.error('Download file error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to generate download URL'
    });
  }
});

