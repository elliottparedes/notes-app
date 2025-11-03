import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { deleteFile } from '~/server/utils/minio';
import { updateUserStorage } from '~/server/utils/storage';
import type { ResultSetHeader } from 'mysql2/promise';

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

  // Verify note exists and user has permission (must be owner or editor)
  const noteRows = await executeQuery<any[]>(
    `SELECT n.id, n.user_id 
     FROM notes n
     LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
     WHERE n.id = ? AND (n.user_id = ? OR sn.permission = 'editor')`,
    [userId, noteId, userId]
  );

  if (noteRows.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Note not found or you do not have permission to delete attachments'
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

  // Allow deletion if:
  // 1. User owns the attachment, OR
  // 2. User is the note owner, OR
  // 3. User is an editor (already verified in note permission check above)
  // The noteRows query already verified the user is either the note owner or has editor permission,
  // so we don't need additional checks here - editors can delete any attachment on shared notes

  try {
    // Delete file from MinIO
    await deleteFile(attachment.file_path);

    // Delete attachment record from database
    await executeQuery<ResultSetHeader>(
      'DELETE FROM attachments WHERE id = ?',
      [attachmentId]
    );

    // Update storage quota (subtract file size from attachment owner's quota)
    const fileSize = attachment.file_size || 0;
    await updateUserStorage(attachment.user_id, -fileSize);

    return { success: true, message: 'Attachment deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to delete attachment'
    });
  }
});

