import bcrypt from 'bcrypt';
import type { H3Event } from 'h3';
import { verifyToken, extractTokenFromEvent } from './jwt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function requireAuth(event: H3Event): Promise<number> {
  const token = extractTokenFromEvent(event);
  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'No token provided'
    });
  }
  const payload = verifyToken(token);
  return payload.userId;
}

