import { randomUUID } from 'crypto';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { uploadFile } from '../../utils/minio';
import type { User } from '../../../models';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for profile picture

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  
  try {
    const formData = await readMultipartFormData(event);
    
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No file provided'
      });
    }

    const filePart = formData.find(part => part.name === 'file');
    if (!filePart || !filePart.filename) {
      throw createError({
        statusCode: 400,
        message: 'No file part found'
      });
    }

    const fileBuffer = filePart.data;
    const fileSize = fileBuffer.length;
    const fileName = filePart.filename;
    const mimeType = filePart.type || 'image/jpeg';

    if (!mimeType.startsWith('image/')) {
      throw createError({
        statusCode: 400,
        message: 'Only image files are allowed'
      });
    }

    if (fileSize > MAX_IMAGE_SIZE) {
      throw createError({
        statusCode: 400,
        message: `Image exceeds maximum size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`
      });
    }

    // Generate unique path for profile picture
    const fileId = randomUUID();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `users/${userId}/profile/${fileId}-${sanitizedFileName}`;

    // Upload to MinIO
    await uploadFile(fileBuffer, objectName, mimeType);

    const profilePictureUrl = `/api/files/raw?path=${encodeURIComponent(objectName)}`;

    // Update user record
    await executeQuery(
      'UPDATE users SET profile_picture_url = ? WHERE id = ?',
      [profilePictureUrl, userId]
    );

    // Fetch updated user
    const users = await executeQuery<any[]>(
      'SELECT id, email, name, profile_picture_url, folder_order, storage_used, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    const result = users[0];
    if (!result) {
      throw createError({ statusCode: 404, message: 'User not found' });
    }

    return {
      ...result,
      folder_order: parseJsonField<string[]>(result.folder_order),
      storage_used: result.storage_used || 0
    } as User;
  } catch (error: any) {
    console.error('Upload profile picture error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to upload profile picture'
    });
  }
});
