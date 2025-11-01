import { getDbPool } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    // Basic health check - server is running
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'markdown-notes-app'
    };

    // Optional: Check database connectivity
    try {
      const pool = getDbPool();
      await pool.query('SELECT 1');
      return {
        ...health,
        database: 'connected'
      };
    } catch (dbError) {
      // Database check failed, but server is still running
      return {
        ...health,
        database: 'disconnected',
        warning: 'Database connectivity check failed'
      };
    }
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable'
    });
  }
});

