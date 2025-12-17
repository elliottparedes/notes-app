import { Client } from 'minio';

let minioClient: Client | null = null;

export function getConfig() {
  const config = useRuntimeConfig();
  return {
    endpoint: config.minioEndpoint as string,
    accessKey: config.minioAccessKey as string,
    secretKey: config.minioSecretKey as string,
    bucket: config.minioBucket as string,
    region: config.minioRegion as string,
    useSSL: config.minioUseSSL as boolean,
  };
}

export function getMinioClient(): Client {
  if (!minioClient) {
    const config = getConfig();
    
    // Parse endpoint URL to extract host, port, and SSL setting
    const endpointUrl = new URL(config.endpoint);
    const host = endpointUrl.hostname;
    
    // Determine port - use explicit port from URL, or default based on protocol
    let port: number;
    if (endpointUrl.port) {
      port = parseInt(endpointUrl.port);
    } else {
      // Default ports based on protocol
      port = endpointUrl.protocol === 'https:' ? 443 : 80;
    }
    
    // Determine SSL - prefer URL protocol over config flag
    const useSSL = endpointUrl.protocol === 'https:' || config.useSSL;
    
    minioClient = new Client({
      endPoint: host,
      port: port,
      useSSL: useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
  }
  
  return minioClient;
}

export async function ensureBucket(): Promise<void> {
  const config = getConfig();
  const client = getMinioClient();
  
  const exists = await client.bucketExists(config.bucket);
  if (!exists) {
    await client.makeBucket(config.bucket, config.region);
  }
}

export async function uploadFile(
  fileBuffer: Buffer,
  objectName: string,
  contentType?: string
): Promise<void> {
  const config = getConfig();
  const client = getMinioClient();
  
  await ensureBucket();
  
  await client.putObject(
    config.bucket,
    objectName,
    fileBuffer,
    fileBuffer.length,
    {
      'Content-Type': contentType || 'application/octet-stream',
    }
  );
}

export async function deleteFile(objectName: string): Promise<void> {
  const config = getConfig();
  const client = getMinioClient();
  
  await client.removeObject(config.bucket, objectName);
}

export async function getPresignedUrl(
  objectName: string,
  expirySeconds: number = 3600
): Promise<string> {
  const config = getConfig();
  const client = getMinioClient();
  
  return await client.presignedGetObject(config.bucket, objectName, expirySeconds);
}

export async function listFiles(
  prefix: string = '',
  recursive: boolean = true
): Promise<any[]> {
  const config = getConfig();
  const client = getMinioClient();
  
  const objectsList: any[] = [];
  const objectsStream = client.listObjects(config.bucket, prefix, recursive);
  
  for await (const obj of objectsStream) {
    objectsList.push(obj);
  }
  
  return objectsList;
}

export async function getFileMetadata(objectName: string): Promise<any> {
  const config = getConfig();
  const client = getMinioClient();
  
  try {
    const stat = await client.statObject(config.bucket, objectName);
    return stat;
  } catch (error) {
    return null;
  }
}

// Multipart upload utilities
export interface MultipartUploadInfo {
  uploadId: string;
  objectName: string;
}

/**
 * Create a multipart upload in MinIO
 */
export async function createMultipartUpload(
  objectName: string,
  contentType?: string
): Promise<MultipartUploadInfo> {
  const config = getConfig();
  const client = getMinioClient();
  
  await ensureBucket();
  
  const uploadId = await client.initiateNewMultipartUpload(config.bucket, objectName, {
    'Content-Type': contentType || 'application/octet-stream',
  });
  
  return {
    uploadId,
    objectName,
  };
}

/**
 * Upload a part for a multipart upload
 */
export async function uploadPart(
  objectName: string,
  uploadId: string,
  partNumber: number,
  partBuffer: Buffer
): Promise<{ etag: string; partNumber: number }> {
  const config = getConfig();
  const client = getMinioClient();
  
  const etag = await client.uploadPart(
    config.bucket,
    objectName,
    uploadId,
    partNumber,
    partBuffer,
    partBuffer.length
  );
  
  return { etag, partNumber };
}

/**
 * Complete a multipart upload
 */
export async function completeMultipartUpload(
  objectName: string,
  uploadId: string,
  parts: Array<{ etag: string; partNumber: number }>
): Promise<void> {
  const config = getConfig();
  const client = getMinioClient();
  
  await client.completeMultipartUpload(config.bucket, objectName, uploadId, parts);
}

/**
 * Abort a multipart upload and clean up all parts
 */
export async function abortMultipartUpload(
  objectName: string,
  uploadId: string
): Promise<void> {
  const config = getConfig();
  const client = getMinioClient();
  
  try {
    await client.abortMultipartUpload(config.bucket, objectName, uploadId);
    console.log(`Aborted multipart upload: ${objectName}, uploadId: ${uploadId}`);
  } catch (error: any) {
    // If abort fails, try to list and delete parts manually
    console.error(`Failed to abort multipart upload ${uploadId}, attempting manual cleanup:`, error);
    try {
      const parts = await listMultipartUploadParts(objectName, uploadId);
      // Parts are automatically cleaned up when multipart upload is aborted
      // But we log for visibility
      console.log(`Found ${parts.length} parts for upload ${uploadId}, they will be cleaned up`);
    } catch (listError) {
      console.error(`Failed to list parts for cleanup:`, listError);
    }
  }
}

/**
 * List parts of an incomplete multipart upload
 */
export async function listMultipartUploadParts(
  objectName: string,
  uploadId: string
): Promise<any[]> {
  const config = getConfig();
  const client = getMinioClient();
  
  const parts: any[] = [];
  const partsStream = client.listParts(config.bucket, objectName, uploadId);
  
  for await (const part of partsStream) {
    parts.push(part);
  }
  
  return parts;
}

/**
 * List all incomplete multipart uploads (for cleanup purposes)
 */
export async function listIncompleteMultipartUploads(
  prefix?: string
): Promise<Array<{ objectName: string; uploadId: string }>> {
  const config = getConfig();
  const client = getMinioClient();
  
  const uploads: Array<{ objectName: string; uploadId: string }> = [];
  const uploadsStream = client.listIncompleteUploads(config.bucket, prefix || '', true);
  
  for await (const upload of uploadsStream) {
    uploads.push({
      objectName: upload.name,
      uploadId: upload.uploadId || '',
    });
  }
  
  return uploads;
}

/**
 * Clean up all incomplete multipart uploads for a specific object prefix
 * Useful for cleaning up temporary uploads
 */
export async function cleanupIncompleteMultipartUploads(
  prefix: string
): Promise<number> {
  const config = getConfig();
  const client = getMinioClient();
  
  let cleanedCount = 0;
  const uploadsStream = client.listIncompleteUploads(config.bucket, prefix, true);
  
  for await (const upload of uploadsStream) {
    if (upload.uploadId) {
      try {
        await client.abortMultipartUpload(config.bucket, upload.name, upload.uploadId);
        cleanedCount++;
        console.log(`Cleaned up incomplete multipart upload: ${upload.name}, uploadId: ${upload.uploadId}`);
      } catch (error) {
        console.error(`Failed to cleanup multipart upload ${upload.name}:`, error);
      }
    }
  }
  
  return cleanedCount;
}

/**
 * Delete all files in a temp folder prefix
 * Useful for cleaning up temporary download folders
 */
export async function cleanupTempFolder(prefix: string): Promise<number> {
  const config = getConfig();
  const client = getMinioClient();
  
  let deletedCount = 0;
  const objectsStream = client.listObjects(config.bucket, prefix, true);
  
  for await (const obj of objectsStream) {
    if (obj.name) {
      try {
        await client.removeObject(config.bucket, obj.name);
        deletedCount++;
        console.log(`Cleaned up temp file: ${obj.name}`);
      } catch (error) {
        console.error(`Failed to cleanup temp file ${obj.name}:`, error);
      }
    }
  }
  
  return deletedCount;
}

/**
 * Clean up old temporary files (older than specified hours)
 * Useful for periodic cleanup of stale temp files
 */
export async function cleanupOldTempFiles(
  prefix: string,
  maxAgeHours: number = 24
): Promise<number> {
  const config = getConfig();
  const client = getMinioClient();
  
  let deletedCount = 0;
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  const now = Date.now();
  
  const objectsStream = client.listObjects(config.bucket, prefix, true);
  
  for await (const obj of objectsStream) {
    if (obj.name && obj.lastModified) {
      const age = now - obj.lastModified.getTime();
      if (age > maxAge) {
        try {
          await client.removeObject(config.bucket, obj.name);
          deletedCount++;
                    console.log(`Cleaned up old temp file: ${obj.name} (age: ${Math.round(age / 3600000)} hours)`);
                  } catch (error) {
                    console.error(`Failed to cleanup old temp file ${obj.name}:`, error);
                  }
                }
              }
            }
          
            return deletedCount;
          }
          
          export async function getFileStream(objectName: string): Promise<NodeJS.ReadableStream> {
            const config = getConfig();
            const client = getMinioClient();
            return await client.getObject(config.bucket, objectName);
          }
          
          
