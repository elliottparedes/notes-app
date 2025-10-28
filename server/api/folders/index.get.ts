import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  
  try {
    // Get all folders for the user
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, name, parent_id, created_at, updated_at
      FROM folders
      WHERE user_id = ?
      ORDER BY created_at ASC
    `, [userId]);

    // Build folder tree structure
    const folderMap = new Map<number, Folder>();
    const rootFolders: Folder[] = [];

    // First pass: create map
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Second pass: build tree
    folders.forEach(folder => {
      const folderWithChildren = folderMap.get(folder.id);
      if (!folderWithChildren) return;

      if (folder.parent_id === null) {
        rootFolders.push(folderWithChildren);
      } else {
        const parent = folderMap.get(folder.parent_id);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(folderWithChildren);
        }
      }
    });

    return rootFolders;
  } catch (error) {
    console.error('Error fetching folders:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch folders'
    });
  }
});

