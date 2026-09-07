import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';
import { createTeacherSchema } from '@/lib/validation';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const list = await db
      .select({
        teacherId: schema.teachers.id,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        status: schema.users.status,
        createdAt: schema.teachers.createdAt,
      })
      .from(schema.teachers)
      .innerJoin(schema.users, eq(schema.teachers.userId, schema.users.id));

    return new Response(JSON.stringify({ teachers: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Admin teachers list error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve teachers list.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const result = createTeacherSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { name, email, password } = result.data;

    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existingUser[0]) {
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const teacherId = `tch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.insert(schema.users).values({
      id: userId,
      name,
      email,
      passwordHash,
      role: 'teacher',
      status: 'active',
    });

    await db.insert(schema.teachers).values({
      id: teacherId,
      userId,
    });

    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'TEACHER_CREATED',
      entityType: 'teachers',
      entityId: teacherId,
      details: `Admin created teacher ${name}`,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Teacher created successfully!' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Admin create teacher error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create teacher account.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
