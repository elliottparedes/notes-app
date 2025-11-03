import { executeQuery } from '~/server/utils/db';
import { getPresignedUrl } from '~/server/utils/minio';
import type { Attachment } from '~/models';

export default defineEventHandler(async (event) => {
  const shareId = getRouterParam(event, 'shareId');

  if (!shareId) {
    throw createError({
      statusCode: 400,
      message: 'Share ID is required'
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

  // Fetch all attachments for the note
  const attachments = await executeQuery<Array<{
    id: number;
    note_id: string; // UUID
    user_id: number;
    file_name: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
    created_at: Date;
  }>>(
    'SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at DESC',
    [noteId]
  );
  
  console.log(`[Published Attachments API] Found ${attachments.length} attachments for published note ${noteId}`);

  // Generate presigned URLs for each attachment
  const attachmentsWithUrls: Attachment[] = await Promise.all(
    attachments.map(async (att) => {
      const presignedUrl = await getPresignedUrl(att.file_path, 3600); // 1 hour expiry
      
      return {
        id: att.id,
        note_id: att.note_id,
        user_id: att.user_id,
        file_name: att.file_name,
        file_path: att.file_path,
        file_size: att.file_size,
        mime_type: att.mime_type,
        created_at: att.created_at,
        presigned_url: presignedUrl,
      };
    })
  );

  return attachmentsWithUrls;
});

