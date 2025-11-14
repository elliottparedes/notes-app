import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';
import type { Folder } from '~/models';

interface ReorderDto {
  newIndex: number;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderId = parseInt(event.context.params?.id || '0');
  
  if (!folderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid folder ID'
    });
  }

  try {
    const body = await readBody<ReorderDto>(event);
    
    if (typeof body.newIndex !== 'number' || body.newIndex < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be a non-negative number'
      });
    }

    // Get the folder to reorder (including space_id)
    const folderResults = await executeQuery<Folder[]>(
      'SELECT id, user_id, name, parent_id, space_id FROM folders WHERE id = ? AND user_id = ?',
      [folderId, userId]
    );

    if (folderResults.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Folder not found'
      });
    }

    const folder = folderResults[0];

    // Get all folders in the same space (all folders are root-level now)
    const siblings = await executeQuery<Folder[]>(
      'SELECT id, user_id, name, parent_id, space_id FROM folders WHERE user_id = ? AND space_id = ? AND parent_id IS NULL ORDER BY created_at ASC',
      [userId, folder.space_id]
    );

    // Get user's current folder order
    const userResults = await executeQuery<Array<{ folder_order: string | null }>>(
      'SELECT folder_order FROM users WHERE id = ?',
      [userId]
    );

    let folderOrder = parseJsonField<Record<string, number[]>>(userResults[0]?.folder_order) || {};
    
    // Handle old data format (array of strings) - reset to empty object
    if (Array.isArray(folderOrder)) {
      folderOrder = {};
    }
    
    // All folders are root-level, so use 'root' key
    const levelKey = 'root';
    
    // Get current order for root level or create default order
    let currentOrder = folderOrder[levelKey] || siblings.map(s => s.id);
    
    // Ensure all siblings are in the order array
    siblings.forEach(sibling => {
      if (!currentOrder.includes(sibling.id)) {
        currentOrder.push(sibling.id);
      }
    });
    
    // Remove any IDs that are no longer siblings
    const siblingIds = new Set(siblings.map(s => s.id));
    currentOrder = currentOrder.filter(id => siblingIds.has(id));

    // Find the current index
    const currentIndex = currentOrder.indexOf(folderId);
    
    if (currentIndex === -1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Folder not found in order'
      });
    }

    // Validate new index
    if (body.newIndex < 0 || body.newIndex >= currentOrder.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid newIndex. Must be within bounds of sibling count'
      });
    }

    // Move the folder to the new position
    const [movedFolder] = currentOrder.splice(currentIndex, 1);
    currentOrder.splice(body.newIndex, 0, movedFolder);

    // Update folder order
    folderOrder[levelKey] = currentOrder;

    // Save to database
    await executeQuery(
      'UPDATE users SET folder_order = ? WHERE id = ?',
      [JSON.stringify(folderOrder), userId]
    );

    return {
      success: true,
      message: 'Folder reordered',
      folder_order: folderOrder
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Reorder folder error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder folder'
    });
  }
});

