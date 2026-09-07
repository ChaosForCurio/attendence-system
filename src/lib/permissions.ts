import { getSessionFromRequest, type UserSession } from './auth';

export function requireAuth(request: Request): { session: UserSession; response?: Response } {
  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      session: null as any,
      response: new Response(JSON.stringify({ error: 'Unauthorized. Please login.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return { session };
}

export function requireRole(
  request: Request,
  allowedRoles: Array<'student' | 'teacher' | 'admin'>
): { session: UserSession; response?: Response } {
  const { session, response } = requireAuth(request);
  if (response) return { session: null as any, response };

  if (!allowedRoles.includes(session.role)) {
    return {
      session: null as any,
      response: new Response(
        JSON.stringify({ error: `Forbidden. Role '${session.role}' cannot perform this action.` }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { session };
}
