import { requireAuth } from '../../utils/auth';
import { getPresignedUrl } from '../../utils/minio';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const query = getQuery(event);
  const path = query.path as string;

  if (!path) {
    throw createError({
      statusCode: 400,
      message: 'Path is required'
    });
  }

  // Security check: Ensure the user is accessing their own files
  if (!path.startsWith(`users/${userId}/`)) {
    throw createError({
      statusCode: 403,
      message: 'Forbidden'
    });
  }

  try {
    const downloadUrl = await getPresignedUrl(path, 3600);
    return sendRedirect(event, downloadUrl);
  } catch (error: any) {
    console.error('Raw file access error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to access file'
    });
  }
});
