import jwt from 'jsonwebtoken';
import type { User } from '../../models';

export interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export function generateToken(user: User): string {
  const config = useRuntimeConfig();
  const secret = config.jwtSecret as string;

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email
  };

  return jwt.sign(payload, secret, {
    expiresIn: '7d'
  });
}

export function verifyToken(token: string): JwtPayload {
  const config = useRuntimeConfig();
  const secret = config.jwtSecret as string;

  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token'
    });
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return '';
  }

  return authHeader.substring(7);
}

export function extractTokenFromEvent(event: any): string {
  // Try header first
  const authHeader = getHeader(event, 'authorization');
  const headerToken = extractTokenFromHeader(authHeader);
  if (headerToken) return headerToken;

  // Try cookie
  const cookieToken = getCookie(event, 'auth_token');
  if (cookieToken) return cookieToken;

  return '';
}

