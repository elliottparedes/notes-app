import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

interface UpdateFolderOrderDto {
  folder_order: string[];
}

interface FolderOrderResponse {
  folder_order: string[];
}

export default defineEventHandler(async (event): Promise<FolderOrderResponse> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    // Parse request body
    const body = await readBody<UpdateFolderOrderDto>(event);

    if (!body || !Array.isArray(body.folder_order)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid folder order data'
      });
    }

    // Validate that all items are strings
    if (!body.folder_order.every(item => typeof item === 'string')) {
      throw createError({
        statusCode: 400,
        message: 'Folder order must be an array of strings'
      });
    }

    // Convert array to JSON string for MySQL
    const folderOrderJson = JSON.stringify(body.folder_order);

    // Update folder order
    await executeQuery(
      'UPDATE users SET folder_order = ? WHERE id = ?',
      [folderOrderJson, userId]
    );

    return {
      folder_order: body.folder_order
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
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

