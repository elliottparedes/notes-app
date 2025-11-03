import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { getPresignedUrl } from '~/server/utils/minio';
import { getHeader } from 'h3';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');
  const attachmentId = getRouterParam(event, 'attachmentId');

  if (!noteId || !attachmentId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID and Attachment ID are required'
    });
  }

  // Verify note exists and user has permission
  const noteRows = await executeQuery<any[]>(
    `SELECT n.id, n.user_id 
     FROM notes n
     LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
     WHERE n.id = ? AND (n.user_id = ? OR sn.permission IN ('viewer', 'editor'))`,
    [userId, noteId, userId]
  );

  if (noteRows.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Note not found or you do not have permission'
    });
  }

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
                         referer.includes('/notes/');

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

