import { Client } from 'minio';

let minioClient: Client | null = null;

/**
 * Get or create MinIO client instance
 */
function getMinioClient(): Client {
  if (minioClient) {
    return minioClient;
  }

  const config = useRuntimeConfig();
  
  const endpoint = process.env.MINIO_ENDPOINT || '';
  const accessKey = process.env.MINIO_ACCESS_KEY || '';
  const secretKey = process.env.MINIO_SECRET_KEY || '';
  const bucketName = process.env.MINIO_BUCKET || '';
  // Default to SSL/HTTPS for cloud endpoints
  const envUseSSL = process.env.MINIO_USE_SSL !== 'false';

  if (!endpoint || !accessKey || !secretKey || !bucketName) {
    throw new Error('MinIO configuration is missing. Please set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET environment variables.');
  }

  // Parse endpoint to extract host and port
  // Try HTTPS first if no protocol specified (common for cloud endpoints)
  let parsedEndpoint = endpoint;
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    parsedEndpoint = `https://${endpoint}`;
  }
  
  const url = new URL(parsedEndpoint);
  const host = url.hostname;
  const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 9000);
  const useSSL = url.protocol === 'https:' || port === 443 || envUseSSL;

  minioClient = new Client({
    endPoint: host,
    port: port,
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey,
  });

  return minioClient;
}

/**
 * Ensure the bucket exists, create it if it doesn't
 */
export async function ensureBucketExists(): Promise<void> {
  const config = useRuntimeConfig();
  const bucketName = process.env.MINIO_BUCKET || '';
  
  if (!bucketName) {
    throw new Error('MINIO_BUCKET environment variable is not set');
  }

  const client = getMinioClient();
  const exists = await client.bucketExists(bucketName);
  
  if (!exists) {
    await client.makeBucket(bucketName, 'us-east-1'); // Default region
    console.log(`Created MinIO bucket: ${bucketName}`);
  }
}

/**
 * Upload a file to MinIO
 * @param fileBuffer - File content as Buffer
 * @param fileName - Original file name
 * @param mimeType - MIME type of the file
 * @param userId - User ID for organizing files
 * @returns Object key (path) in MinIO
 */
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: number
): Promise<string> {
  const bucketName = process.env.MINIO_BUCKET || '';
  const client = getMinioClient();
  
  // Ensure bucket exists
  await ensureBucketExists();
  
  // Generate unique object key: users/{userId}/attachments/{timestamp}-{filename}
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `users/${userId}/attachments/${timestamp}-${sanitizedFileName}`;
  
  // Upload file
  await client.putObject(bucketName, objectKey, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType,
    'Content-Disposition': `attachment; filename="${fileName}"`,
  });
  
  return objectKey;
}

/**
 * Delete a file from MinIO
 * @param objectKey - Object key (path) in MinIO
 */
export async function deleteFile(objectKey: string): Promise<void> {
  const bucketName = process.env.MINIO_BUCKET || '';
  const client = getMinioClient();
  
  await client.removeObject(bucketName, objectKey);
}

/**
 * Get a presigned URL for file access
 * @param objectKey - Object key (path) in MinIO
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function getPresignedUrl(
  objectKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const bucketName = process.env.MINIO_BUCKET || '';
  const client = getMinioClient();
  
  return await client.presignedGetObject(bucketName, objectKey, expiresIn);
}

