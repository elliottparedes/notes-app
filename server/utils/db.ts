import mysql from 'mysql2/promise';
import type { Connection, Pool, PoolOptions } from 'mysql2/promise';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const config = useRuntimeConfig();
    
    const poolConfig: PoolOptions = {
      host: config.dbHost as string,
      port: parseInt(config.dbPort as string),
      user: config.dbUser as string,
      password: config.dbPassword as string,
      database: config.dbName as string,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };

    pool = mysql.createPool(poolConfig);
  }

  return pool;
}

export async function executeQuery<T>(
  query: string,
  params: unknown[] = []
): Promise<T> {
  const pool = getDbPool();
  const [results] = await pool.execute(query, params);
  return results as T;
}

export async function getConnection(): Promise<Connection> {
  const pool = getDbPool();
  return await pool.getConnection();
}

// Helper function to safely parse JSON fields from MySQL
export function parseJsonField<T>(field: string | null): T | null {
  if (!field) return null;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch {
    return null;
  }
}

