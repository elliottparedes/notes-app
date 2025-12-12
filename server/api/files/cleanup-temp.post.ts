/**
 * Manual cleanup endpoint for temporary files
 * Can be called to clean up old temp files immediately
 */
import { cleanupOldTempFiles, cleanupIncompleteMultipartUploads } from '../../utils/minio';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  // Only allow authenticated users (or you could restrict to admin)
  await requireAuth(event);
  
  try {
    const query = getQuery(event);
    const maxAgeHours = query.maxAgeHours ? parseInt(query.maxAgeHours as string) : 24;
    const includeMultipart = query.includeMultipart !== 'false'; // Default to true
    
    const results = {
      tempFilesDeleted: 0,
      multipartUploadsAborted: 0,
    };
    
    // Clean up old temp zip files
    results.tempFilesDeleted = await cleanupOldTempFiles('temp/zips/', maxAgeHours);
    
    // Clean up incomplete multipart uploads if requested
    if (includeMultipart) {
      results.multipartUploadsAborted = await cleanupIncompleteMultipartUploads('temp/');
    }
    
    return {
      success: true,
      ...results,
      message: `Cleaned up ${results.tempFilesDeleted} temp files and ${results.multipartUploadsAborted} incomplete multipart uploads`,
    };
  } catch (error: any) {
    console.error('Cleanup temp files error:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to cleanup temp files',
    });
  }
});




