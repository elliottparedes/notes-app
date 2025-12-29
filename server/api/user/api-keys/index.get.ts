import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import type { ApiKeyResponse } from '~/models/ApiKey';

export default defineEventHandler(async (event): Promise<{ keys: ApiKeyResponse[] }> => {
  // Authenticate user
  const userId = await requireAuth(event);

  try {
    const keys = await executeQuery<any[]>(
      `SELECT id, key_name, key_prefix, scopes, request_count, last_used_at, expires_at, is_active, created_at
       FROM user_api_keys
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    console.log('List Keys Result Type:', typeof keys, 'Is Array:', Array.isArray(keys));

    if (!Array.isArray(keys)) {
      console.error('Unexpected result format for keys list:', keys);
      throw new Error('Database returned unexpected format');
    }

    const apiKeys: ApiKeyResponse[] = keys.map(key => ({
      id: key.id,
      key_name: key.key_name,
      key_prefix: key.key_prefix,
      scopes: typeof key.scopes === 'string' ? JSON.parse(key.scopes) : (key.scopes || ['read']),
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      is_active: key.is_active,
      created_at: key.created_at
    }));

    return { keys: apiKeys };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('List API keys error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve API keys'
    });
  }
});
