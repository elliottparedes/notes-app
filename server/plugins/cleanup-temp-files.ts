/**
 * Periodic cleanup of temporary files in MinIO
 * Runs every hour to clean up old temp files (older than 24 hours)
 */
import { cleanupOldTempFiles } from '../utils/minio';

export default defineNitroPlugin((nitroApp) => {
  // Run cleanup immediately on server start
  cleanupOldTempFiles('temp/zips/', 24).then((count) => {
    if (count > 0) {
      console.log(`[Cleanup] Cleaned up ${count} old temp zip files on server start`);
    }
  }).catch((error) => {
    console.error('[Cleanup] Failed to cleanup temp files on server start:', error);
  });

  // Schedule periodic cleanup every hour
  const cleanupInterval = setInterval(async () => {
    try {
      // Clean up temp zip files older than 24 hours
      const zipCount = await cleanupOldTempFiles('temp/zips/', 24);
      if (zipCount > 0) {
        console.log(`[Cleanup] Cleaned up ${zipCount} old temp zip files`);
      }

      // Clean up incomplete multipart uploads older than 1 hour
      // Note: This would require tracking upload timestamps, so we'll just clean all incomplete uploads
      // In a production environment, you might want to track upload start times
    } catch (error) {
      console.error('[Cleanup] Failed to run periodic cleanup:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Cleanup interval on server shutdown
  nitroApp.hooks.hook('close', () => {
    clearInterval(cleanupInterval);
  });
});



