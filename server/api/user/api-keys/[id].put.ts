import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import type { UpdateApiKeyDto, ApiKeyResponse } from '~/models/ApiKey';

interface RequestBody extends UpdateApiKeyDto {}

export default defineEventHandler(async (event): Promise<ApiKeyResponse> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const keyId = parseInt(getRouterParam(event, 'id') || '0');

  if (!keyId || isNaN(keyId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid API key ID'
    });
  }

  try {
    const body = await readBody<RequestBody>(event);

    if (!body || Object.keys(body).length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No update data provided'
      });
    }

    // Verify key belongs to user
    const keys = await executeQuery<any[]>(
      'SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?',
      [keyId, userId]
    );

    if (keys.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'API key not found'
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (body.key_name !== undefined) {
      if (body.key_name.trim().length === 0) {
        throw createError({
          statusCode: 400,
          message: 'API key name cannot be empty'
        });
      }
      updates.push('key_name = ?');
      values.push(body.key_name.trim());
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active);
    }

    if (body.scopes !== undefined) {
      const validScopes = ['read', 'write'];
      for (const scope of body.scopes) {
        if (!validScopes.includes(scope)) {
          throw createError({
            statusCode: 400,
            message: `Invalid scope: ${scope}`
          });
        }
      }
      updates.push('scopes = ?');
      values.push(JSON.stringify(body.scopes));
    }

    if (updates.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No valid update fields provided'
      });
    }

    values.push(keyId);

    await executeQuery(
      `UPDATE user_api_keys SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated key
    const updatedKeys = await executeQuery<any[]>(
      `SELECT id, key_name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at
       FROM user_api_keys
       WHERE id = ?`,
      [keyId]
    );

    const updatedKey = updatedKeys[0];

    return {
      id: updatedKey.id,
      key_name: updatedKey.key_name,
      key_prefix: updatedKey.key_prefix,
      scopes: JSON.parse(updatedKey.scopes),
      last_used_at: updatedKey.last_used_at,
      expires_at: updatedKey.expires_at,
      is_active: updatedKey.is_active,
      created_at: updatedKey.created_at
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Update API key error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to update API key'
    });
  }
});
