import type { APIRoute } from 'astro';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';
import { createStudentSchema } from '@/lib/validation';

export const GET: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const list = await db
      .select({
        studentId: schema.students.id,
        studentNumber: schema.students.studentNumber,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        status: schema.users.status,
        classId: schema.students.classId,
        className: schema.classes.name,
        createdAt: schema.students.createdAt,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .innerJoin(schema.classes, eq(schema.students.classId, schema.classes.id));

    return new Response(JSON.stringify({ students: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Admin students list error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve students list.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { session, response } = requireRole(request, ['admin']);
  if (response) return response;

  try {
    const body = await request.json();
    const result = createStudentSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { name, email, password, studentNumber, classId } = result.data;

    // Check if email already exists
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existingUser[0]) {
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const studentId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create user
    await db.insert(schema.users).values({
      id: userId,
      name,
      email,
      passwordHash,
      role: 'student',
      status: 'active',
    });

    // Create student
    await db.insert(schema.students).values({
      id: studentId,
      userId,
      studentNumber,
      classId,
    });

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: session.id,
      action: 'STUDENT_CREATED',
      entityType: 'students',
      entityId: studentId,
      details: `Admin created student ${name} (${studentNumber})`,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Student created successfully!' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Admin create student error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create student account.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
