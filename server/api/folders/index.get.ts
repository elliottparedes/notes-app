import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';
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

    // Get user's folder order preference
    const userResults = await executeQuery<Array<{ folder_order: string | null }>>(
      'SELECT folder_order FROM users WHERE id = ?',
      [userId]
    );
    
    let folderOrder = parseJsonField<Record<string, number[]>>(userResults[0]?.folder_order) || {};
    
    // Handle old data format (array of strings) - reset to empty object
    if (Array.isArray(folderOrder)) {
      folderOrder = {};
    }

    // Helper function to sort folders by custom order
    const sortFoldersByOrder = (foldersToSort: Folder[], parentId: number | null): Folder[] => {
      const levelKey = parentId === null ? 'root' : `parent_${parentId}`;
      const customOrder = folderOrder[levelKey];
      
      if (!customOrder || customOrder.length === 0) {
        // No custom order, return as-is (by created_at)
        return [...foldersToSort];
      }
      
      // Create a new sorted array based on custom order
      return [...foldersToSort].sort((a, b) => {
        const indexA = customOrder.indexOf(a.id);
        const indexB = customOrder.indexOf(b.id);
        
        // If both are in custom order, use that order
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        
        // If only one is in custom order, prioritize it
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        // Neither in custom order, keep original order
        return 0;
      });
    };

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

    // Third pass: sort each level by custom order
    const sortedRootFolders = sortFoldersByOrder(rootFolders, null);
    
    // Recursively sort children
    const sortChildren = (folder: Folder) => {
      if (folder.children && folder.children.length > 0) {
        folder.children = sortFoldersByOrder(folder.children, folder.id);
        folder.children.forEach(sortChildren);
      }
    };
    
    sortedRootFolders.forEach(sortChildren);

    return sortedRootFolders;
  } catch (error) {
    console.error('Error fetching folders:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch folders'
    });
  }
});

