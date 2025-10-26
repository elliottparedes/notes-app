import bcrypt from 'bcrypt';
import type { H3Event } from 'h3';
import { verifyToken, extractTokenFromHeader } from './jwt';

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
  const authHeader = getHeader(event, 'authorization');
  const token = extractTokenFromHeader(authHeader);
  const payload = verifyToken(token);
  return payload.userId;
}

