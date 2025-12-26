import { executeQuery } from './db';

/**
 * Renames a storage folder and all its contents
 * @param userId The user ID
 * @param currentFolderPath The current folder path (e.g., "/old-name" or "/parent/old-name")
 * @param newFolderName The new folder name (not the full path)
 */
export async function renameStorageFolder(userId: number, currentFolderPath: string, newFolderName: string): Promise<void> {
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
  const filesToUpdate = await executeQuery<Array<{ id: string; folder_path: string; file_path: string }>>(
    `SELECT id, folder_path, file_path FROM files 
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