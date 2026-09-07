import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { requireRole } from '@/lib/permissions';
import { createSubjectSchema } from '@/lib/validation';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin', 'teacher']);
  if (response) return response;

  try {
    const list = await db.select().from(schema.subjects);
    return new Response(JSON.stringify({ subjects: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve subjects.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const result = createSubjectSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subjectId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(schema.subjects).values({
      id: subjectId,
      ...result.data,
      status: 'active',
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Subject created successfully!' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to create subject.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
