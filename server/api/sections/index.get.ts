import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';
import { getAllAccessibleUserIds } from '~/server/utils/sharing';
import type { Folder } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const query = getQuery(event);
  const spaceId = query.notebook_id ? parseInt(query.notebook_id as string) : null;

  try {
    // Get all user IDs that this user can access (self + shared users)
    const accessibleUserIds = await getAllAccessibleUserIds(userId);

    // Get all folders from accessible users, optionally filtered by notebook_id
    const placeholders = accessibleUserIds.map(() => '?').join(',');
    const params = spaceId ? [...accessibleUserIds, spaceId] : accessibleUserIds;
    const folders = await executeQuery<Folder[]>(`
      SELECT id, user_id, name, icon, parent_id, notebook_id, created_at, updated_at
      FROM sections
      WHERE user_id IN (${placeholders})${spaceId ? ' AND notebook_id = ?' : ''}
      ORDER BY created_at ASC
    `, params);

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

    // Create a set of valid folder IDs from the current space for filtering
    const validFolderIds = new Set(folders.map(f => f.id));
    
    // Filter folder_order to only include folders from current space
    const filterOrderBySpace = (order: number[]): number[] => {
      return order.filter(id => validFolderIds.has(id));
    };
    
    // Get custom order for root-level folders (all folders are root-level now)
    let customOrder = folderOrder['root'];
    
    // Filter custom order to only include folders from current space
    if (customOrder && customOrder.length > 0) {
      customOrder = filterOrderBySpace(customOrder);
    }
    
    // Sort folders by custom order if available
    if (customOrder && customOrder.length > 0) {
      const sortedFolders = [...folders].sort((a, b) => {
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
      
      return sortedFolders;
    }
    
    // No custom order, return as-is (by created_at)
    return folders;
  } catch (error) {
    console.error('Error fetching folders:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch folders'
    });
  }
});

