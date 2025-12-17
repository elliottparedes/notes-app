import { getDbPool } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  // Basic health check object
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'markdown-notes-app',
    uptime: process.uptime()
  };

  try {
    // Check database connectivity but DON'T let it crash the whole health check
    try {
      const pool = getDbPool();
      if (pool) {
        await pool.query('SELECT 1');
        health.database = 'connected';
      } else {
        health.database = 'not_initialized';
      }
    } catch (dbError) {
      // Database check failed, but we still return 200 so Coolify doesn't kill the container
      health.database = 'disconnected';
      health.warning = 'Database connectivity check failed';
      // We log it internally for debugging
      console.warn('[Health Check] Database disconnected:', dbError);
    }

    return health;
  } catch (error) {
    // Even if something fundamental fails, we try to return a 200 with an error status
    // unless the server is literally dying.
    return {
      status: 'unstable',
      timestamp: new Date().toISOString(),
      error: 'Internal health check logic failed'
    };
  }
});

