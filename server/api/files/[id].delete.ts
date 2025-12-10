import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { deleteFile } from '../../utils/minio';

interface FileRow {
  id: string;
  user_id: number;
  file_path: string;
  file_size: number;
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
    // Get file info
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

    // Delete from MinIO
    await deleteFile(file.file_path);

    // Delete from database
    await executeQuery('DELETE FROM files WHERE id = ? AND user_id = ?', [fileId, userId]);

    // Update user storage
    await executeQuery(
      'UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?',
      [file.file_size, userId]
    );

    return { success: true };
  } catch (error: any) {
    console.error('Delete file error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to delete file'
    });
  }
});



