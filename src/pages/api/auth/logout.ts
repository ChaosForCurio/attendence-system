import type { APIRoute } from 'astro';
import { createClearAuthCookieHeader, getSessionFromRequest } from '@/lib/auth';

export const ALL: APIRoute = async () => {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  const clearCookieHeaders = createClearAuthCookieHeader();
  for (const cookieHeader of clearCookieHeaders) {
    headers.append('Set-Cookie', cookieHeader);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
};
