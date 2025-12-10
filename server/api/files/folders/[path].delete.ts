import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import { deleteFile } from '../../../utils/minio';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderPath = getRouterParam(event, 'path');

  if (!folderPath) {
    throw createError({
      statusCode: 400,
      message: 'Folder path is required'
    });
  }

  // Decode the folder path (it might be URL encoded)
  let decodedPath = folderPath;
  try {
    decodedPath = decodeURIComponent(folderPath);
  } catch {
    // If decoding fails, use as-is
  }
  
  // Ensure path starts with /
  if (!decodedPath.startsWith('/')) {
    decodedPath = '/' + decodedPath;
  }

  try {
    // Get all files in this folder and subfolders
    const files = await executeQuery<Array<{ id: string; file_path: string; file_size: number }>>(
      `SELECT id, file_path, file_size FROM files 
       WHERE user_id = ? AND folder_path LIKE ?`,
      [userId, `${decodedPath}%`]
    );

    let totalSizeDeleted = 0;
    const errors: string[] = [];

    // Delete each file from MinIO and database
    for (const file of files) {
      try {
        // Delete from MinIO
        await deleteFile(file.file_path);
        
        // Delete from database
        await executeQuery('DELETE FROM files WHERE id = ? AND user_id = ?', [file.id, userId]);
        
        totalSizeDeleted += file.file_size;
      } catch (error: any) {
        console.error(`Failed to delete file ${file.id}:`, error);
        errors.push(file.id);
        // Continue deleting other files even if one fails
      }
    }

    // Update user storage
    if (totalSizeDeleted > 0) {
      await executeQuery(
        'UPDATE users SET storage_used = GREATEST(0, storage_used - ?) WHERE id = ?',
        [totalSizeDeleted, userId]
      );
    }

    if (errors.length > 0) {
      return {
        success: true,
        deleted_count: files.length - errors.length,
        total_count: files.length,
        errors: errors.length,
        message: `Deleted ${files.length - errors.length} of ${files.length} files`
      };
    }

    return {
      success: true,
      deleted_count: files.length,
      total_count: files.length,
    };
  } catch (error: any) {
    console.error('Delete folder error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to delete folder'
    });
  }
});

