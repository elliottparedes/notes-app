import { executeQuery } from '~/server/utils/db';
import { getPresignedUrl } from '~/server/utils/minio';
import { getHeader } from 'h3';

export default defineEventHandler(async (event) => {
  const shareId = getRouterParam(event, 'shareId');
  const attachmentId = getRouterParam(event, 'attachmentId');

  if (!shareId || !attachmentId) {
    throw createError({
      statusCode: 400,
      message: 'Share ID and Attachment ID are required'
    });
  }

  // Verify published note exists
  const publishedRows = await executeQuery<any[]>(
    'SELECT note_id FROM published_notes WHERE share_id = ? AND is_active = TRUE',
    [shareId]
  );

  if (publishedRows.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Published note not found'
    });
  }

  const noteId = publishedRows[0].note_id;

  // Fetch the attachment
  const attachments = await executeQuery<Array<{
    id: number;
    note_id: number;
    user_id: number;
    file_name: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
    created_at: Date;
  }>>(
    'SELECT * FROM attachments WHERE id = ? AND note_id = ?',
    [attachmentId, noteId]
  );

  if (attachments.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Attachment not found'
    });
  }

  const attachment = attachments[0];

  // Generate presigned URL (24 hour expiry)
  const presignedUrl = await getPresignedUrl(attachment.file_path, 86400);

  // Check if this is an image request (from img tag)
  const userAgent = getHeader(event, 'user-agent') || '';
  const referer = getHeader(event, 'referer') || '';
  const isImageRequest = attachment.mime_type?.startsWith('image/') || 
                         userAgent.includes('image') ||
                         referer.includes('/p/');

  // For images in img tags, we need to proxy the content
  // For downloads, redirect is fine
  if (isImageRequest && attachment.mime_type?.startsWith('image/')) {
    // Fetch the image from MinIO and serve it directly
    try {
      const imageResponse = await fetch(presignedUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Set proper headers
      setHeader(event, 'Content-Type', attachment.mime_type || 'image/png');
      setHeader(event, 'Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      setHeader(event, 'Content-Disposition', `inline; filename="${attachment.file_name}"`);
      
      return Buffer.from(imageBuffer);
    } catch (error) {
      console.error('Error fetching image from MinIO:', error);
      // Fallback to redirect
      return sendRedirect(event, presignedUrl);
    }
  }

  // For non-images or explicit downloads, redirect to presigned URL
  return sendRedirect(event, presignedUrl);
});

