import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { uploadFile, getPresignedUrl } from '~/server/utils/minio';
import { checkStorageQuota, updateUserStorage } from '~/server/utils/storage';
import type { Attachment } from '~/models';
import type { ResultSetHeader } from 'mysql2/promise';

export default defineEventHandler(async (event): Promise<Attachment> => {
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
     WHERE n.id = ? AND (n.user_id = ? OR sn.permission = 'editor')`,
    [userId, noteId, userId]
  );

  if (noteRows.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Note not found or you do not have permission'
    });
  }

  // Read multipart form data
  const formData = await readMultipartFormData(event);
  
  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file provided'
    });
  }

  // Get the first file from form data
  const fileData = formData.find(item => item.name === 'file' && item.filename);
  
  if (!fileData || !fileData.data || !fileData.filename) {
    throw createError({
      statusCode: 400,
      message: 'No file provided'
    });
  }

  const fileBuffer = fileData.data;
  const fileName = fileData.filename;
  const mimeType = fileData.type || 'application/octet-stream';
  const fileSize = fileBuffer.length;

  // Check storage quota
  await checkStorageQuota(userId, fileSize);

  try {
    // Upload file to MinIO
    const objectKey = await uploadFile(fileBuffer, fileName, mimeType, userId);

    // Create attachment record in database
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO attachments (note_id, user_id, file_name, file_path, file_size, mime_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [noteId, userId, fileName, objectKey, fileSize, mimeType]
    );

    // Update user storage quota
    await updateUserStorage(userId, fileSize);

    // Fetch the created attachment
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
      'SELECT * FROM attachments WHERE id = ?',
      [result.insertId]
    );

    if (attachments.length === 0) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create attachment record'
      });
    }

    const attachment: Attachment = {
      id: attachments[0].id,
      note_id: attachments[0].note_id,
      user_id: attachments[0].user_id,
      file_name: attachments[0].file_name,
      file_path: attachments[0].file_path,
      file_size: attachments[0].file_size,
      mime_type: attachments[0].mime_type,
      created_at: attachments[0].created_at,
    };

    // If it's an image, generate a presigned URL for embedding
    if (attachment.mime_type?.startsWith('image/')) {
      const presignedUrl = await getPresignedUrl(attachment.file_path, 86400); // 24 hours for images
      attachment.presigned_url = presignedUrl;
    }

    return attachment;
  } catch (error: any) {
    // If upload fails, rollback any partial changes
    console.error('File upload error:', error);
    
    if (error.message?.includes('Storage quota')) {
      throw createError({
        statusCode: 413,
        message: error.message
      });
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to upload file'
    });
  }
});

