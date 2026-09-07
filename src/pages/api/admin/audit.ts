import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const logs = await db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        entityType: schema.auditLogs.entityType,
        entityId: schema.auditLogs.entityId,
        details: schema.auditLogs.details,
        userName: schema.users.name,
        userEmail: schema.users.email,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100);

    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve audit logs.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
