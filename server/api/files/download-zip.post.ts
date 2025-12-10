import { randomUUID } from 'crypto';
import archiver from 'archiver';
import { Readable } from 'stream';
import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { getMinioClient, getConfig, uploadFile, deleteFile, getPresignedUrl } from '../../utils/minio';

interface FileRow {
  id: string;
  user_id: number;
  file_name: string;
  file_path: string;
}

// Helper function to get file stream from MinIO
async function getFileStream(objectName: string): Promise<Readable> {
  const config = getConfig();
  const client = getMinioClient();
  return await client.getObject(config.bucket, objectName);
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody(event);
  const { fileIds } = body;

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'File IDs array is required'
    });
  }

  try {
    // Fetch all files for the user
    const placeholders = fileIds.map(() => '?').join(',');
    const rows = await executeQuery<FileRow[]>(
      `SELECT id, file_name, file_path FROM files 
       WHERE id IN (${placeholders}) AND user_id = ?`,
      [...fileIds, userId]
    );

    if (rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No files found'
      });
    }

    // Verify all requested files belong to the user
    const foundIds = new Set(rows.map(r => r.id));
    const missingIds = fileIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw createError({
        statusCode: 403,
        message: `Access denied for some files`
      });
    }

    // Create zip archive in memory
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    const zipBufferPromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      archive.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      archive.on('error', (err) => {
        reject(err);
      });

      // Add each file to the zip sequentially to avoid stream conflicts
      (async () => {
        try {
          const usedNames = new Map<string, number>();
          
          for (const file of rows) {
            try {
              const fileStream = await getFileStream(file.file_path);
              
              // Handle duplicate file names by appending a number
              let zipFileName = file.file_name;
              if (usedNames.has(file.file_name)) {
                const count = usedNames.get(file.file_name)! + 1;
                usedNames.set(file.file_name, count);
                const extIndex = file.file_name.lastIndexOf('.');
                if (extIndex > 0) {
                  const name = file.file_name.substring(0, extIndex);
                  const ext = file.file_name.substring(extIndex);
                  zipFileName = `${name} (${count})${ext}`;
                } else {
                  zipFileName = `${file.file_name} (${count})`;
                }
              } else {
                usedNames.set(file.file_name, 0);
              }
              
              archive.append(fileStream, { name: zipFileName });
            } catch (error: any) {
              console.error(`Failed to add file ${file.file_name} to zip:`, error);
              // Continue with other files even if one fails
            }
          }
          archive.finalize();
        } catch (error) {
          reject(error);
        }
      })();
    });

    const zipBuffer = await zipBufferPromise;

    // Upload zip file temporarily to MinIO
    const zipId = randomUUID();
    const zipObjectName = `temp/zips/${userId}/${zipId}.zip`;
    let zipUploaded = false;
    
    try {
      await uploadFile(zipBuffer, zipObjectName, 'application/zip');
      zipUploaded = true;

      // Generate presigned URL (valid for 15 minutes - enough time to download)
      const downloadUrl = await getPresignedUrl(zipObjectName, 900);

      // Schedule cleanup after 20 minutes (gives buffer time for download)
      setTimeout(async () => {
        try {
          await deleteFile(zipObjectName);
          console.log(`Cleaned up temporary zip file: ${zipObjectName}`);
        } catch (error) {
          console.error(`Failed to cleanup zip file ${zipObjectName}:`, error);
        }
      }, 20 * 60 * 1000); // 20 minutes

      return {
        downloadUrl,
        fileName: `files-${Date.now()}.zip`,
        fileCount: rows.length,
        zipId
      };
    } catch (uploadError: any) {
      // Clean up the uploaded file if it was successfully uploaded
      if (zipUploaded) {
        try {
          await deleteFile(zipObjectName);
          console.log(`Cleaned up temporary zip file after upload error: ${zipObjectName}`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup zip file ${zipObjectName} after upload error:`, cleanupError);
        }
      }
      throw uploadError;
    }
  } catch (error: any) {
    console.error('Create zip error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create zip file'
    });
  }
});

