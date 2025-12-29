import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { executeQuery } from './db';
import type { ApiKey } from '~/models/ApiKey';

const SALT_ROUNDS = 10;
const KEY_PREFIX = 'na_'; // notes-app prefix
const KEY_LENGTH = 32;

/**
 * Generates a new API key with format: na_<32_random_chars>
 */
export function generateApiKey(): string {
  const randomString = crypto
    .randomBytes(24)
    .toString('base64url')
    .slice(0, KEY_LENGTH);

  return `${KEY_PREFIX}${randomString}`;
}

/**
 * Hashes an API key using bcrypt
 */
export async function hashApiKey(key: string): Promise<string> {
  return await bcrypt.hash(key, SALT_ROUNDS);
}

/**
 * Compares a plain API key with its hash
 */
export async function compareApiKey(key: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(key, hash);
}

/**
 * Extracts the prefix from an API key (first 12 characters)
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, Math.min(key.length, 12));
}

/**
 * Verifies an API key and returns associated user data
 */
export async function verifyApiKey(key: string): Promise<{
  userId: number;
  scopes: string[];
  keyId: number;
} | null> {
  if (!key || !key.startsWith(KEY_PREFIX)) {
    return null;
  }

  const prefix = getKeyPrefix(key);

  // Find potential matches by prefix
  const keys = await executeQuery<Array<{
    id: number;
    user_id: number;
    key_hash: string;
    scopes: string;
    is_active: boolean;
    expires_at: Date | null;
  }>>(
    `SELECT id, user_id, key_hash, scopes, is_active, expires_at
     FROM user_api_keys
     WHERE key_prefix = ? AND is_active = TRUE`,
    [prefix]
  );

  // Check each potential match
  for (const keyData of keys) {
    const isValid = await compareApiKey(key, keyData.key_hash);

    if (isValid) {
      // Check expiration
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        throw createError({
          statusCode: 401,
          message: 'API key has expired'
        });
      }

      // Parse scopes
      let scopes: string[];
      try {
        scopes = JSON.parse(keyData.scopes) as string[];
      } catch {
        scopes = ['read'];
      }

      // Update last_used_at and increment request_count (async, don't wait)
      executeQuery(
        'UPDATE user_api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = ?',
        [keyData.id]
      ).catch(err => console.error('Failed to update last_used_at:', err));

      return {
        userId: keyData.user_id,
        scopes,
        keyId: keyData.id
      };
    }
  }

  return null;
}

/**
 * Validates scopes - checks if required scope is in the key's scopes
 */
export function validateScope(
  requiredScope: 'read' | 'write',
  keyScopes: string[]
): boolean {
  // 'write' scope includes 'read' permissions
  if (requiredScope === 'read') {
    return keyScopes.includes('read') || keyScopes.includes('write');
  }
  return keyScopes.includes('write');
}

/**
 * Rate limiter for API keys
 */
const rateLimits = new Map<number, { count: number; resetAt: number }>();

export function checkRateLimit(keyId: number, maxRequests = 1000, windowMs = 3600000): boolean {
  const limit = rateLimits.get(keyId);
  const now = Date.now();

  if (!limit || now > limit.resetAt) {
    rateLimits.set(keyId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (limit.count >= maxRequests) {
    return false; // Rate limit exceeded
  }

  limit.count++;
  return true;
}

/**
 * Gets the reset time for a rate-limited key
 */
export function getRateLimitResetTime(keyId: number): number | null {
  const limit = rateLimits.get(keyId);
  return limit ? limit.resetAt : null;
}

/**
 * Clears rate limit for a key (useful for testing or admin override)
 */
export function clearRateLimit(keyId: number): void {
  rateLimits.delete(keyId);
}

/**
 * Cleanup function to remove expired rate limits (call periodically)
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  for (const [keyId, limit] of rateLimits.entries()) {
    if (now > limit.resetAt) {
      rateLimits.delete(keyId);
    }
  }
}

// Cleanup expired rate limits every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRateLimits, 5 * 60 * 1000);
}
