import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { getPresignedUrl } from '~/server/utils/minio';
import type { Attachment } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
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
  
  console.log(`[Attachments API] Found ${attachments.length} attachments for note ${noteId}`);

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

