import { randomUUID } from 'crypto';
import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody(event);
  const { folder_name, parent_path = '/' } = body;

  if (!folder_name || !folder_name.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Folder name is required'
    });
  }

  // Sanitize folder name
  const sanitizedName = folder_name.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Build folder path
  const folderPath = parent_path === '/' 
    ? `/${sanitizedName}` 
    : `${parent_path}/${sanitizedName}`;

  try {
    // Check if folder already exists by looking for any files in this path
    const existing = await executeQuery<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM files 
       WHERE user_id = ? AND folder_path = ?`,
      [userId, folderPath]
    );

    if (existing[0]?.count > 0) {
      throw createError({
        statusCode: 400,
        message: 'Folder already exists'
      });
    }

    // Create a marker file to represent the folder
    // This allows empty folders to be detected
    const folderId = randomUUID();
    const markerFileName = '.folder';
    const objectName = `users/${userId}/${folderId}/${markerFileName}`;
    
    // Insert marker entry (no actual file upload needed, just DB entry)
    await executeQuery(
      `INSERT INTO files (id, user_id, file_name, file_path, file_size, mime_type, folder_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [folderId, userId, markerFileName, objectName, 0, 'application/x-folder', folderPath]
    );
    
    return {
      success: true,
      folder_path: folderPath,
      folder_name: sanitizedName,
    };
  } catch (error: any) {
    console.error('Create folder error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create folder'
    });
  }
});

