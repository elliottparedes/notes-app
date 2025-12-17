import { randomUUID } from 'crypto';
import { requireAuth } from '../../utils/auth';
import { uploadFile } from '../../utils/minio';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

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

    const file = formData.find(p => p.name === 'file' && p.filename);
    if (!file) {
      throw createError({
        statusCode: 400,
        message: 'No file found in request'
      });
    }

    if (file.data.length > MAX_FILE_SIZE) {
      throw createError({
        statusCode: 400,
        message: `File size exceeds 2MB limit`
      });
    }

    const mimeType = file.type || 'application/octet-stream';
    const extension = file.filename?.split('.').pop()?.toLowerCase() || '';
    
    // Allow if mime type matches OR if extension matches (fallback for misconfigured clients)
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !ALLOWED_EXTENSIONS.includes(extension)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid file type. Only images (JPG, PNG, GIF, WEBP, SVG) are allowed.'
      });
    }

    const fileId = randomUUID();
    // Use the actual extension from the filename, defaulting to png if missing
    const finalExtension = extension || 'png';
    const objectName = `users/${userId}/icons/${fileId}.${finalExtension}`;

    await uploadFile(file.data, objectName, mimeType);

    // Return the relative URL that the proxy route will handle
    // We'll serve this via /icons/...
    const url = `/icons/${objectName}`;

    return {
      url,
      objectName
    };

  } catch (error: any) {
    console.error('Icon upload error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to upload icon'
    });
  }
});
