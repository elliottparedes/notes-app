import { getHeader, type H3Event } from 'h3';

/**
 * Gets the base URL from the request headers.
 * Works automatically in production by reading from request headers.
 * Falls back to localhost in development.
 */
export function getBaseUrl(event: H3Event): string {
  // In production, hosting providers (Netlify, Vercel, etc.) set these headers
  const forwardedHost = getHeader(event, 'x-forwarded-host');
  const forwardedProto = getHeader(event, 'x-forwarded-proto');
  const host = getHeader(event, 'host');
  
  // Determine protocol - prefer x-forwarded-proto, default to https if forwarded, otherwise http
  const protocol = forwardedProto || (forwardedHost ? 'https' : 'http');
  
  // Determine host - prefer x-forwarded-host, then host header, fallback to localhost
  const hostname = forwardedHost || host || 'localhost:3000';
  
  // Construct base URL
  const baseUrl = `${protocol}://${hostname}`;
  
  return baseUrl;
}

