import type { APIRoute } from 'astro';
import { requireRole } from '@/lib/permissions';
import { generateQrToken } from '@/lib/attendance';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['teacher', 'admin']);
  if (response) return response;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: 'sessionId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { token, expiresAt } = generateQrToken(sessionId, 20); // 20-second dynamic expiration

  return new Response(
    JSON.stringify({
      sessionId,
      token,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 20,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
