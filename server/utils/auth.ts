import bcrypt from 'bcrypt';
import type { H3Event } from 'h3';
import { verifyToken, extractTokenFromEvent } from './jwt';
import { verifyApiKey, validateScope, checkRateLimit, getRateLimitResetTime } from './api-keys';

const SALT_ROUNDS = 10;

export interface AuthContext {
  userId: number;
  authType: 'jwt' | 'api_key';
  scopes?: string[];
  keyId?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Extracts API key from request headers
 */
function extractApiKeyFromEvent(event: H3Event): string | null {
  // Try Authorization header: "Bearer na_xxx"
  const authHeader = getHeader(event, 'authorization');
  if (authHeader?.startsWith('Bearer na_')) {
    return authHeader.substring(7);
  }

  // Try X-API-Key header
  const apiKeyHeader = getHeader(event, 'x-api-key');
  if (apiKeyHeader?.startsWith('na_')) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Get full authentication context with type and scopes
 */
export async function getAuthContext(event: H3Event): Promise<AuthContext> {
  // Debug logging
  const authHeader = getHeader(event, 'authorization');
  const apiKeyHeader = getHeader(event, 'x-api-key');
  console.log('[Auth] Headers - Authorization:', authHeader?.substring(0, 20) + '...', '| X-API-Key:', apiKeyHeader?.substring(0, 20) + '...');

  // Check for API key FIRST - if explicitly provided, use it
  // This ensures API integrations work even if a JWT cookie exists
  const apiKey = extractApiKeyFromEvent(event);
  console.log('[Auth] Extracted API key:', apiKey ? 'yes (' + apiKey.substring(0, 10) + '...)' : 'no');
  if (apiKey) {
    const keyData = await verifyApiKey(apiKey);
    console.log('[Auth] API key verified:', keyData ? 'yes, userId=' + keyData.userId : 'no');

    if (!keyData) {
      throw createError({
        statusCode: 401,
        message: 'Invalid API key'
      });
    }

    // Check rate limit
    if (!checkRateLimit(keyData.keyId)) {
      const resetTime = getRateLimitResetTime(keyData.keyId);
      const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 3600;

      throw createError({
        statusCode: 429,
        statusMessage: 'Rate limit exceeded',
        data: {
          retryAfter
        }
      });
    }

    console.log('[Auth] Returning authType: api_key');
    return {
      userId: keyData.userId,
      authType: 'api_key',
      scopes: keyData.scopes,
      keyId: keyData.keyId
    };
  }

  // Try JWT (from header or cookie)
  const token = extractTokenFromEvent(event);
  if (token) {
    try {
      const payload = verifyToken(token);
      return {
        userId: payload.userId,
        authType: 'jwt',
        scopes: ['read', 'write'] // JWT has full access
      };
    } catch (error) {
      // JWT verification failed
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      });
    }
  }

  throw createError({
    statusCode: 401,
    message: 'Authentication required'
  });
}

/**
 * Legacy requireAuth - returns userId only (backward compatible)
 */
export async function requireAuth(event: H3Event): Promise<number> {
  const context = await getAuthContext(event);
  return context.userId;
}

/**
 * Require specific scope for API key requests
 */
export async function requireScope(event: H3Event, requiredScope: 'read' | 'write'): Promise<number> {
  const context = await getAuthContext(event);

  // JWT always has all scopes
  if (context.authType === 'jwt') {
    return context.userId;
  }

  // Check API key scopes
  const hasScope = context.scopes && validateScope(requiredScope, context.scopes);

  if (!hasScope) {
    throw createError({
      statusCode: 403,
      message: `Insufficient permissions. Required scope: ${requiredScope}`
    });
  }

  return context.userId;
}

