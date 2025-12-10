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
  folder_path: string;
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
  const { folderPath } = body;

  if (!folderPath || typeof folderPath !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Folder path is required'
    });
  }

  try {
    // Fetch all files in the folder and subfolders
    // Files in subfolders will have folder_path starting with the requested folder path
    let query: string;
    let params: any[];
    
    if (folderPath === '/') {
      // For root folder, get all files
      query = `SELECT id, file_name, file_path, folder_path FROM files 
               WHERE user_id = ? 
               AND file_name != '.folder'
               ORDER BY folder_path, file_name`;
      params = [userId];
    } else {
      // For specific folder, get files in folder and subfolders
      query = `SELECT id, file_name, file_path, folder_path FROM files 
               WHERE user_id = ? 
               AND (folder_path = ? OR folder_path LIKE ?)
               AND file_name != '.folder'
               ORDER BY folder_path, file_name`;
      params = [userId, folderPath, `${folderPath}/%`];
    }
    
    const rows = await executeQuery<FileRow[]>(query, params);

    if (rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Folder is empty or not found'
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
              
              // Create relative path within zip
              // If folderPath is '/', use the full folder_path
              // Otherwise, remove the folderPath prefix
              let relativePath = file.folder_path;
              if (folderPath !== '/') {
                // Remove the folder path prefix and leading slash
                relativePath = file.folder_path.replace(folderPath, '').replace(/^\//, '');
              } else {
                // Remove leading slash for root folder
                relativePath = file.folder_path.replace(/^\//, '');
              }
              
              // Build zip file path: folder/subfolder/filename or just filename for root
              const zipFileName = relativePath 
                ? `${relativePath}/${file.file_name}`
                : file.file_name;
              
              // Handle duplicate file names
              let finalZipFileName = zipFileName;
              if (usedNames.has(zipFileName)) {
                const count = usedNames.get(zipFileName)! + 1;
                usedNames.set(zipFileName, count);
                const extIndex = zipFileName.lastIndexOf('.');
                if (extIndex > 0) {
                  const name = zipFileName.substring(0, extIndex);
                  const ext = zipFileName.substring(extIndex);
                  finalZipFileName = `${name} (${count})${ext}`;
                } else {
                  finalZipFileName = `${zipFileName} (${count})`;
                }
              } else {
                usedNames.set(zipFileName, 0);
              }
              
              archive.append(fileStream, { name: finalZipFileName });
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

      // Get folder name for zip filename
      const folderParts = folderPath.split('/').filter(Boolean);
      const folderName = folderParts.length > 0 ? folderParts[folderParts.length - 1] : 'storage';

      return {
        downloadUrl,
        fileName: `${folderName}-${Date.now()}.zip`,
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
    console.error('Create folder zip error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create folder zip file'
    });
  }
});

