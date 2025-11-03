import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

interface FolderOwnerRow {
  user_id: number;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const folderId = parseInt(getRouterParam(event, 'id') || '0');

  if (!folderId) {
    throw createError({
      statusCode: 400,
      message: 'Folder ID is required'
    });
  }

  // Verify folder ownership
  const [folder] = await executeQuery<FolderOwnerRow[]>(
    'SELECT user_id FROM folders WHERE id = ?',
    [folderId]
  );

  if (!folder || folder.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to unpublish this folder'
    });
  }

  // Deactivate publishing (soft delete)
  await executeQuery(
    'UPDATE published_folders SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ? AND owner_id = ?',
    [folderId, userId]
  );

  return { success: true, message: 'Folder unpublished successfully' };
});

