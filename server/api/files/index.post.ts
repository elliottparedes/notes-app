import { randomUUID } from 'crypto';
import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { uploadFile, createMultipartUpload, uploadPart, completeMultipartUpload, abortMultipartUpload, deleteFile } from '../../utils/minio';
import { Readable } from 'stream';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file
const STORAGE_QUOTA = 500 * 1024 * 1024; // 500MB total quota
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // Use multipart upload for files > 50MB
const MULTIPART_PART_SIZE = 10 * 1024 * 1024; // 10MB per part

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  
  try {
    // Check current storage usage
    const userResult = await executeQuery<{ storage_used: number }[]>(
      'SELECT storage_used FROM users WHERE id = ?',
      [userId]
    );
    
    const currentStorage = userResult[0]?.storage_used || 0;
    
    // Parse multipart form data with error handling
    let formData;
    try {
      // Add a timeout and size check
      const contentLength = getHeader(event, 'content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_FILE_SIZE * 2) { // Allow some overhead for multipart encoding
          throw createError({
            statusCode: 413,
            message: `Request too large. Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
          });
        }
      }
      
      formData = await readMultipartFormData(event);
    } catch (parseError: any) {
      console.error('Multipart form data parse error:', parseError);
      
      // Provide more specific error messages
      if (parseError.message?.includes('Invalid array length') || parseError.message?.includes('array')) {
        throw createError({
          statusCode: 400,
          message: 'File upload failed. The file may be corrupted or too large. Please try uploading files individually.'
        });
      }
      
      if (parseError.statusCode) {
        throw parseError;
      }
      
      throw createError({
        statusCode: 400,
        message: parseError.message || 'Invalid file upload format. Please try uploading files individually or in smaller batches.'
      });
    }
    
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No file provided'
      });
    }

    const uploadedFiles = [];
    
    // Extract folder_path from form data (if provided)
    let folderPath = '/'; // Default to root
    for (const part of formData) {
      if (part.name === 'folder_path' && part.data) {
        folderPath = part.data.toString();
        break;
      }
    }

    // Process all file parts
    for (const part of formData) {
      if (!part.filename) continue;

      const fileBuffer = part.data;
      const fileSize = fileBuffer.length;
      const fileName = part.filename;
      const mimeType = part.type || 'application/octet-stream';

      // Validate file size
      if (fileSize > MAX_FILE_SIZE) {
        throw createError({
          statusCode: 400,
          message: `File ${fileName} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
        });
      }

      // Check quota
      if (currentStorage + fileSize > STORAGE_QUOTA) {
        throw createError({
          statusCode: 400,
          message: 'Storage quota exceeded'
        });
      }

      // Generate unique file path
      const fileId = randomUUID();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectName = `users/${userId}/${fileId}/${sanitizedFileName}`;

      // Use multipart upload for large files, regular upload for smaller files
      let multipartUploadInfo: { uploadId: string; objectName: string } | null = null;
      const uploadedParts: Array<{ etag: string; partNumber: number }> = [];
      
      try {
        if (fileSize > MULTIPART_THRESHOLD) {
          // Use multipart upload for large files
          multipartUploadInfo = await createMultipartUpload(objectName, mimeType);
          
          // Split file into parts
          const totalParts = Math.ceil(fileSize / MULTIPART_PART_SIZE);
          
          for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * MULTIPART_PART_SIZE;
            const end = Math.min(start + MULTIPART_PART_SIZE, fileSize);
            const partBuffer = fileBuffer.subarray(start, end);
            
            const { etag } = await uploadPart(
              objectName,
              multipartUploadInfo.uploadId,
              partNumber,
              partBuffer
            );
            
            uploadedParts.push({ etag, partNumber });
          }
          
          // Complete multipart upload
          await completeMultipartUpload(
            objectName,
            multipartUploadInfo.uploadId,
            uploadedParts
          );
        } else {
          // Use regular upload for smaller files
          await uploadFile(fileBuffer, objectName, mimeType);
        }

        // Save metadata to database with the provided folder path
        try {
          await executeQuery(
            `INSERT INTO files (id, user_id, file_name, file_path, file_size, mime_type, folder_path)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [fileId, userId, fileName, objectName, fileSize, mimeType, folderPath]
          );

          // Update user storage
          await executeQuery(
            'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
            [fileSize, userId]
          );
        } catch (dbError: any) {
          // If database insert fails, clean up the uploaded file from MinIO
          try {
            await deleteFile(objectName);
            console.log(`Cleaned up file from MinIO after database insert failure: ${objectName}`);
          } catch (cleanupError) {
            console.error(`Failed to cleanup file ${objectName} after database error:`, cleanupError);
          }
          throw dbError;
        }

        uploadedFiles.push({
          id: fileId,
          file_name: fileName,
          file_path: objectName,
          file_size: fileSize,
          mime_type: mimeType,
          folder_path: folderPath,
        });
      } catch (uploadError: any) {
        // Clean up multipart upload if it was started
        if (multipartUploadInfo) {
          try {
            await abortMultipartUpload(objectName, multipartUploadInfo.uploadId);
            console.log(`Cleaned up failed multipart upload: ${objectName}, uploadId: ${multipartUploadInfo.uploadId}`);
          } catch (cleanupError) {
            console.error(`Failed to cleanup multipart upload ${multipartUploadInfo.uploadId}:`, cleanupError);
          }
        }
        
        // Re-throw the error to be handled by outer catch
        throw uploadError;
      }
    }

    return { files: uploadedFiles };
  } catch (error: any) {
    console.error('Upload file error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to upload file'
    });
  }
});
