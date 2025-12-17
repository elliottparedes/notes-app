import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { getPresignedUrl } from '../../utils/minio';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    const users = await executeQuery<{ profile_picture_url: string | null }[]>(
      'SELECT profile_picture_url FROM users WHERE id = ?',
      [userId]
    );

    const profilePictureUrl = users[0]?.profile_picture_url;

    if (!profilePictureUrl) {
      throw createError({
        statusCode: 404,
        message: 'Profile picture not found'
      });
    }

    // If it's a proxy URL, we need to extract the path and get a presigned URL
    if (profilePictureUrl.startsWith('/api/files/download-raw')) {
      const url = new URL(profilePictureUrl, 'http://localhost');
      const path = url.searchParams.get('path');
      
      if (path) {
        const downloadUrl = await getPresignedUrl(path, 3600);
        return sendRedirect(event, downloadUrl);
      }
    }

    // If it's already a full URL, redirect to it
    if (profilePictureUrl.startsWith('http')) {
      return sendRedirect(event, profilePictureUrl);
    }

    throw createError({
      statusCode: 404,
      message: 'Invalid profile picture URL'
    });
  } catch (error: any) {
    console.error('Get profile picture error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to get profile picture'
    });
  }
});
