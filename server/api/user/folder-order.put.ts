import { requireAuth } from '../../utils/auth';
import { updateSectionOrder, getSectionOrder } from '../../utils/order-persistence';
import { executeQuery } from '../../utils/db';

interface UpdateFolderOrderDto {
  folder_order: string[];
}

interface FolderOrderResponse {
  folder_order: string[];
}

export default defineEventHandler(async (event): Promise<FolderOrderResponse> => {
  const userId = await requireAuth(event);

  try {
    const body = await readBody<UpdateFolderOrderDto>(event);

    if (!body || !Array.isArray(body.folder_order)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid folder order data'
      });
    }

    // Validate that all items are strings (for backward compatibility with old format)
    if (!body.folder_order.every(item => typeof item === 'string')) {
      throw createError({
        statusCode: 400,
        message: 'Folder order must be an array of strings'
      });
    }

    // Convert string IDs to numbers (old format used string IDs like "folder_5")
    // Actually the old format just had folder IDs as numbers in an array
    // Parse them if they're numeric strings
    const sectionIds = body.folder_order.map(id => {
      const parsed = parseInt(id);
      return isNaN(parsed) ? id : parsed;
    }).filter(id => typeof id === 'number') as number[];

    // Get all sections to determine their notebook_ids
    const sections = await executeQuery<Array<{ id: number; notebook_id: number }>>(
      'SELECT id, notebook_id FROM sections WHERE user_id = ? AND id IN (?)',
      [userId, sectionIds.length > 0 ? sectionIds : [0]]
    );

    // Group sections by notebook
    const sectionsByNotebook = new Map<number, number[]>();
    sections.forEach(section => {
      if (!sectionsByNotebook.has(section.notebook_id)) {
        sectionsByNotebook.set(section.notebook_id, []);
      }
      sectionsByNotebook.get(section.notebook_id)!.push(section.id);
    });

    // Update order for each notebook
    for (const [notebookId, notebookSectionIds] of sectionsByNotebook) {
      // Preserve the order from the original array
      const orderedSections = sectionIds.filter(id => notebookSectionIds.includes(id));
      await updateSectionOrder(userId, notebookId, orderedSections);
    }

    return {
      folder_order: body.folder_order
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update folder order error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update folder order'
    });
  }
});
