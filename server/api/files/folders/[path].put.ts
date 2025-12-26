import { defineEventHandler, getRouterParam, readBody, createError } from 'h3';
import { requireAuth } from '../../../utils/auth';
import { executeQuery } from '../../../utils/db';

interface UpdateFolderBody {
  folder_name: string;
}

/**
 * Renames a storage folder and all its contents
 */
async function renameStorageFolder(userId: number, currentFolderPath: string, newFolderName: string): Promise<void> {
  // Decode the folder path (it might be URL encoded)
  let decodedCurrentPath = currentFolderPath;
  try {
    decodedCurrentPath = decodeURIComponent(currentFolderPath);
  } catch {
    // If decoding fails, use as-is
  }
  
  // Ensure path starts with /
  if (!decodedCurrentPath.startsWith('/')) {
    decodedCurrentPath = '/' + decodedCurrentPath;
  }

  // Validate new folder name (similar to folder creation)
  const sanitizedNewName = newFolderName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Get the parent path
  const pathParts = decodedCurrentPath.split('/').filter(Boolean);
  if (pathParts.length === 0) {
    throw new Error('Invalid folder path');
  }
  
  // Remove the last part (current folder name) to get parent path
  const parentPath = pathParts.length === 1 
    ? '/' 
    : '/' + pathParts.slice(0, -1).join('/');
  
  // Build new folder path
  const newFolderPath = parentPath === '/' 
    ? `/${sanitizedNewName}` 
    : `${parentPath}/${sanitizedNewName}`;
  
  // Check if new folder path already exists
  const existingCheck = await executeQuery<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM files 
     WHERE user_id = ? AND folder_path = ?`,
    [userId, newFolderPath]
  );
  
  if (existingCheck[0]?.count > 0) {
    throw new Error('A folder with this name already exists');
  }
  
  // Get all files in the current folder and subfolders
  const filesToUpdate = await executeQuery<Array<{ id: string; folder_path: string }>>(
    `SELECT id, folder_path FROM files 
     WHERE user_id = ? AND folder_path LIKE ?`,
    [userId, `${decodedCurrentPath}%`]
  );
  
  // Update each file's folder_path
  for (const file of filesToUpdate) {
    // Replace the current folder path prefix with the new folder path
    const newFilePath = file.folder_path.replace(decodedCurrentPath, newFolderPath);
    
    await executeQuery(
      `UPDATE files SET folder_path = ? WHERE id = ? AND user_id = ?`,
      [newFilePath, file.id, userId]
    );
  }
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderPath = getRouterParam(event, 'path');
  const body = await readBody<UpdateFolderBody>(event);

  if (!folderPath) {
    throw createError({
      statusCode: 400,
      message: 'Folder path is required'
    });
  }

  if (!body.folder_name || !body.folder_name.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Folder name is required'
    });
  }

  const newFolderName = body.folder_name.trim();

  try {
    // Rename the folder in storage
    await renameStorageFolder(userId, folderPath, newFolderName);
    
    return { success: true, message: 'Folder renamed successfully' };
  } catch ( error: any ) {
    console.error('Error renaming folder:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to rename folder'
    });
  }
});