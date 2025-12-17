import { getFileStream } from '../../utils/minio';

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path');
  if (!path) {
    throw createError({ statusCode: 404, message: 'Icon not found' });
  }

  try {
    const stream = await getFileStream(path);
    
    // Infer content-type from extension
    const ext = path.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'svg') contentType = 'image/svg+xml';
    
    setHeader(event, 'Content-Type', contentType);
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    
    return sendStream(event, stream);
  } catch (error: any) {
    if (error.code === 'NoSuchKey' || error.message?.includes('NoSuchKey')) {
      throw createError({ statusCode: 404, message: 'Icon not found' });
    }
    console.error('Error serving icon:', error);
    throw createError({ statusCode: 500, message: 'Failed to fetch icon' });
  }
});
