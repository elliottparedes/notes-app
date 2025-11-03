import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';

interface PublishStatusRow {
  share_id: string;
  is_active: number;
  created_at: Date;
}

interface SpacePublishStatusRow {
  share_id: string;
  is_active: number;
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
  const [folder] = await executeQuery<Array<{ user_id: number; space_id: number }>>(
    'SELECT user_id, space_id FROM folders WHERE id = ?',
    [folderId]
  );

  if (!folder || folder.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized'
    });
  }

  // Check if parent space is published
  const [spacePublished] = await executeQuery<SpacePublishStatusRow[]>(
    'SELECT share_id, is_active FROM published_spaces WHERE space_id = ? AND owner_id = ? AND is_active = TRUE',
    [folder.space_id, userId]
  );

  // Get folder publish status
  const [published] = await executeQuery<PublishStatusRow[]>(
    'SELECT share_id, is_active, created_at FROM published_folders WHERE folder_id = ? AND owner_id = ?',
    [folderId, userId]
  );

  const config = useRuntimeConfig();
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || config.public?.baseUrl || 'http://localhost:3000';
  
  const result: {
    is_published: boolean;
    share_url?: string;
    parent_space_published?: boolean;
  } = {
    is_published: false,
    parent_space_published: !!spacePublished
  };

  if (published && published.is_active) {
    result.is_published = true;
    result.share_url = `${baseUrl}/p/folder/${published.share_id}`;
  }

  return result;
});

