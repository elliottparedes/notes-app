import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../../../utils/api-keys';
import type { CreateApiKeyDto, ApiKeyWithToken } from '~/models/ApiKey';

interface RequestBody extends CreateApiKeyDto {}

export default defineEventHandler(async (event): Promise<ApiKeyWithToken> => {
  // Authenticate user (JWT only - can't create API keys with API keys)
  const userId = await requireAuth(event);

  try {
    const body = await readBody<RequestBody>(event);

    if (!body || !body.key_name || body.key_name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: 'API key name is required'
      });
    }

    // Validate scopes
    const scopes = body.scopes || ['read'];
    const validScopes = ['read', 'write'];

    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        throw createError({
          statusCode: 400,
          message: `Invalid scope: ${scope}. Valid scopes are: ${validScopes.join(', ')}`
        });
      }
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = getKeyPrefix(apiKey);

    // Validate expiration date if provided
    let expiresAt = null;
    if (body.expires_at) {
      const expDate = new Date(body.expires_at);
      if (expDate <= new Date()) {
        throw createError({
          statusCode: 400,
          message: 'Expiration date must be in the future'
        });
      }
      expiresAt = expDate;
    }

    // Insert API key into database
    let result = await executeQuery<any>(
      `INSERT INTO user_api_keys (user_id, key_name, key_hash, key_prefix, scopes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, body.key_name.trim(), keyHash, keyPrefix, JSON.stringify(scopes), expiresAt]
    );

    console.log('API Key Insert Result:', result);
    
    // Handle potential array return (some mysql2 versions/configs)
    if (Array.isArray(result)) {
      result = result[0];
    }

    const keyId = result.insertId;
    console.log('New Key ID:', keyId);

    // Fetch the created key
    const keys = await executeQuery<any[]>(
      `SELECT id, key_name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at
       FROM user_api_keys
       WHERE id = ?`,
      [keyId]
    );

    if (keys.length === 0) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create API key'
      });
    }

    const createdKey = keys[0];

    return {
      id: createdKey.id,
      key_name: createdKey.key_name,
      key_prefix: createdKey.key_prefix,
      scopes: typeof createdKey.scopes === 'string' ? JSON.parse(createdKey.scopes) : (createdKey.scopes || ['read']),
      last_used_at: createdKey.last_used_at,
      expires_at: createdKey.expires_at,
      is_active: createdKey.is_active,
      created_at: createdKey.created_at,
      key: apiKey // Full key - only shown ONCE
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Create API key error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to create API key'
    });
  }
});
