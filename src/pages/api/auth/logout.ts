import type { APIRoute } from 'astro';
import { createClearAuthCookieHeader, getSessionFromRequest } from '@/lib/auth';

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': createClearAuthCookieHeader(),
    },
  });
};
