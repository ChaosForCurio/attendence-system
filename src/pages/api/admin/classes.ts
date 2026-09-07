import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { requireRole } from '@/lib/permissions';
import { createClassSchema } from '@/lib/validation';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  try {
    const list = await db.select().from(schema.classes);
    return new Response(JSON.stringify({ classes: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve classes.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const result = createClassSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const classId = `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(schema.classes).values({
      id: classId,
      ...result.data,
      status: 'active',
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Class created successfully!' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to create class.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
